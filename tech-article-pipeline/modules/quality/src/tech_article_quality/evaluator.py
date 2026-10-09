from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import threading
import time
import urllib.request
from collections import Counter
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from . import keywords_manager
from .keywords_manager import CORE_IMMUTABLE_KEYWORDS, KeywordRefreshError
from .models import (
    Article,
    Dimensions,
    ErrorPayload,
    Evaluation,
    QualityEvaluationRequest,
    QualityEvaluationResult,
    Score,
    ScoreAxis,
    Signals,
)

Clock = Callable[[], datetime]
EVALUATOR_VERSION = "2.4.5"
# 개편된 4대 평가 축 정의 (개발 관련성 35%, 기술적 깊이 30%, 최신성 25%, 기사 품질 10%)
QUALITY_AXES = (
    {"key": "relevance", "label": "개발 관련성", "weight": 0.35},
    {"key": "technicalDepth", "label": "기술적 깊이", "weight": 0.30},
    {"key": "timeliness", "label": "최신성", "weight": 0.25},
    {"key": "articleQuality", "label": "기사 품질", "weight": 0.10},
)

DEVELOPER_KEYWORDS = CORE_IMMUTABLE_KEYWORDS
try:
    KEYWORD_REFRESH_CHECK_SECONDS = max(
        1, int(os.environ.get("QUALITY_KEYWORD_REFRESH_CHECK_SECONDS", "300"))
    )
except ValueError:
    KEYWORD_REFRESH_CHECK_SECONDS = 300

NON_ARTICLE_PATTERN = re.compile(
    r"\b(subscribe|learning center|webinars archives|archive|showcase|landscape|sponsors?)\b",
    re.IGNORECASE,
)
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_+#.-]+|[가-힣]+")
ADVERTISEMENT_PATTERNS = (
    # A bare word such as "sponsored" is intentionally insufficient: technical
    # articles often discuss sponsorship without being promotional themselves.
    ("explicit_sponsorship", re.compile(
        r"\b(?:this|the)\s+(?:article|post|content)\s+(?:is|was)\s+sponsored(?:\s+by)?\b"
        r"|\bsponsored\s+(?:content|post|article)\b",
        re.IGNORECASE,
    )),
    ("paid_or_partner_promotion", re.compile(
        r"\b(?:paid\s+(?:partnership|promotion)|in\s+partnership\s+with)\b",
        re.IGNORECASE,
    )),
    ("affiliate_or_discount", re.compile(
        r"\b(?:affiliate\s+links?|use\s+(?:code|coupon)\s+[A-Z0-9_-]+|save\s+\d{1,2}%|limited\s+time\s+offer)\b",
        re.IGNORECASE,
    )),
    ("purchase_call_to_action", re.compile(
        r"\b(?:buy\s+now|shop\s+now|order\s+now)\b|(?:유료\s*광고|스폰서\s*콘텐츠|제휴\s*링크|할인\s*코드|구매하기|한정\s*특가)",
        re.IGNORECASE,
    )),
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class QualityEvaluator:
    """Deterministic implementation of the updated 35/30/25/10 scoring policy with LLM depth and 48h half-life."""

    def __init__(self, *, clock: Clock = _utcnow) -> None:
        self._clock = clock
        self._keywords = {
            "keywords": CORE_IMMUTABLE_KEYWORDS,
            "loadedAt": datetime.now(UTC).isoformat(),
            "loadedVersion": None,
            "loadedActivatedAt": None,
            "warnings": (),
        }
        self._last_keyword_check = 0.0
        self._keyword_read_lock = threading.Lock()
        self._keyword_state_lock = threading.Lock()
        self._keyword_refresh_lock = threading.Lock()
        self._keyword_generation = 0
        self._refresh_task: asyncio.Task | None = None
        self._unknown_keyword_version: str | None = None

    def keyword_snapshot(self) -> dict[str, Any]:
        self._sync_keywords_if_due()
        snapshot = self._keywords
        keywords = sorted(snapshot["keywords"])
        core = sorted(snapshot["keywords"] & CORE_IMMUTABLE_KEYWORDS)
        dynamic = sorted(snapshot["keywords"] - CORE_IMMUTABLE_KEYWORDS)
        return {
            "loadedAt": snapshot["loadedAt"],
            "loadedVersion": snapshot["loadedVersion"],
            "loadedActivatedAt": snapshot["loadedActivatedAt"],
            "warnings": list(snapshot["warnings"])
            + (["KEYWORD_REFRESH_OUTCOME_UNKNOWN"] if self._unknown_keyword_version else []),
            "fingerprint": hashlib.sha256("\n".join(keywords).encode()).hexdigest(),
            "totalCount": len(keywords),
            "coreKeywords": core,
            "dynamicKeywords": dynamic,
            "refreshPolicy": "READ_ONLY_DATABASE_CHECK",
        }

    def evaluate(self, input_data: Mapping[str, Any]) -> dict[str, Any]:
        self._sync_keywords_if_due()
        keywords = self._keywords["keywords"]
        article_id = input_data.get("articleId", "") if isinstance(input_data, Mapping) else ""
        try:
            request = QualityEvaluationRequest.model_validate(input_data)
        except ValidationError as exc:
            return self._failure(
                str(article_id),
                "INVALID_INPUT",
                "입력 데이터가 품질 평가 계약을 만족하지 않습니다.",
                {
                    "validationErrors": exc.errors(
                        include_url=False, include_input=False, include_context=False
                    )
                },
            )

        now = self._clock().astimezone(UTC)
        policy = request.quality_policy
        article = request.article
        content_length = len(article.content)
        spam = self._spam_suspected(article.content)
        advertisement = bool(self._advertisement_indicators(f"{article.title}\n{article.content}"))
        hard_rejections: list[str] = []
        if content_length < policy.minimum_content_length:
            hard_rejections.append("CONTENT_TOO_SHORT")
        if content_length > policy.maximum_content_length:
            hard_rejections.append("CONTENT_TOO_LONG")
        if article.language not in policy.allowed_languages:
            hard_rejections.append("LANGUAGE_NOT_ALLOWED")
        # The curated-source spam heuristic remains an observation signal only.

        # 4대 평가 축 채점
        effective_api_key = request.llm_api_key or policy.llm_api_key
        relevance = self.evaluate_developer_relevance(article, keywords=keywords)
        technical_depth = self.evaluate_technical_depth_llm(article, api_key=effective_api_key)
        timeliness = self.evaluate_timeliness(article.original_published_at, now)
        article_quality = self.evaluate_article_quality(request)

        dimension_values = {
            "relevance": relevance,
            "technicalDepth": technical_depth,
            "timeliness": timeliness,
            "articleQuality": article_quality,
        }
        overall = round(
            sum(dimension_values[axis["key"]] * float(axis["weight"]) for axis in QUALITY_AXES)
        )
        overall = max(0, min(100, overall))
        axes = [
            ScoreAxis(
                key=str(axis["key"]),
                label=str(axis["label"]),
                value=dimension_values[str(axis["key"])],
                weight=float(axis["weight"]),
                contribution=round(dimension_values[str(axis["key"])] * float(axis["weight"]), 2),
            )
            for axis in QUALITY_AXES
        ]

        rejection_codes = list(hard_rejections)
        if relevance < 30:
            rejection_codes.append("LOW_RELEVANCE")

        if hard_rejections:
            decision = "REJECT"
            reason = "강제 품질 정책을 충족하지 못했습니다."
        elif overall >= policy.minimum_evaluation_score:
            if policy.require_admin_review:
                decision = "REVIEW_REQUIRED"
                reason = "점수 기준은 통과했지만 정책에 따라 관리자 검토가 필요합니다."
            else:
                decision = "PASS"
                reason = f"품질 기준점({policy.minimum_evaluation_score}점) 이상입니다."
        else:
            rejection_codes.append("LOW_EVALUATION_SCORE")
            if overall >= policy.review_lower_bound:
                decision = "REVIEW_REQUIRED"
                reason = "품질 점수가 검토 가능 범위에 있어 관리자 판단이 필요합니다."
            else:
                decision = "REJECT"
                reason = "품질 점수가 최소 검토 범위보다 낮습니다."

        result = QualityEvaluationResult(
            articleId=request.article_id,
            qualityEvaluation=Evaluation(
                status="SUCCESS",
                decision=decision,
                evaluatedAt=now,
                evaluatorVersion=EVALUATOR_VERSION,
                policyVersion=policy.policy_version,
                signals=Signals(
                    contentLength=content_length,
                    language=article.language,
                    contentComplete=not bool(hard_rejections),
                    spamSuspected=spam,
                    advertisementSuspected=advertisement,
                ),
                score=Score(
                    overall=overall,
                    dimensions=Dimensions(
                        relevance=relevance,
                        technicalDepth=technical_depth,
                        timeliness=timeliness,
                        articleQuality=article_quality,
                    ),
                    axes=axes,
                ),
                reason=reason,
                rejectionCodes=list(dict.fromkeys(rejection_codes)),
                error=None,
            ),
        )
        return result.model_dump(by_alias=True, mode="json")

    def _install_keyword_dictionary(self, dictionary: dict[str, Any] | None) -> None:
        self._keywords = {
            "keywords": keywords_manager._snapshot_keywords(dictionary) or CORE_IMMUTABLE_KEYWORDS,
            "loadedAt": datetime.now(UTC).isoformat(),
            "loadedVersion": dictionary.get("versionId") if dictionary else None,
            "loadedActivatedAt": dictionary.get("updatedAt") if dictionary else None,
            "warnings": () if dictionary else ("ACTIVE_KEYWORD_DICTIONARY_MISSING",),
        }
        self._keyword_generation += 1
        if dictionary and dictionary.get("versionId") == self._unknown_keyword_version:
            self._unknown_keyword_version = None

    async def refresh_keyword_dictionary(self) -> dict[str, Any]:
        if not self._keyword_refresh_lock.acquire(blocking=False):
            raise KeywordRefreshError(
                "KEYWORD_REFRESH_BUSY", "Keyword refresh is already running.", status_code=409
            )
        self._refresh_task = asyncio.create_task(self._run_keyword_refresh())
        self._refresh_task.add_done_callback(
            lambda task: task.exception() if not task.cancelled() else None
        )
        return await asyncio.shield(self._refresh_task)

    async def _run_keyword_refresh(self) -> dict[str, Any]:
        try:
            result = await keywords_manager.refresh_keyword_dictionary()
            dictionary = result["dictionary"]
            with self._keyword_state_lock:
                self._install_keyword_dictionary(dictionary)
                self._last_keyword_check = time.monotonic()
                self._unknown_keyword_version = None
            snapshot = self.keyword_snapshot()
            return {
                "status": "SUCCESS",
                "activeVersion": dictionary["versionId"],
                "activatedAt": dictionary["updatedAt"],
                "changed": result["changed"],
                "source": dictionary.get("source"),
                "warnings": result["warnings"],
                "snapshot": snapshot,
            }
        except keywords_manager.KeywordCommitOutcomeUnknown as error:
            self._unknown_keyword_version = error.version_id
            raise
        finally:
            self._keyword_refresh_lock.release()

    def _sync_keywords_if_due(self) -> None:
        now = time.monotonic()
        if (
            self._last_keyword_check
            and now - self._last_keyword_check < KEYWORD_REFRESH_CHECK_SECONDS
        ):
            return
        if not self._keyword_read_lock.acquire(blocking=False):
            return
        try:
            generation = self._keyword_generation
            try:
                dictionary = keywords_manager.load_keyword_dictionary()
                warning = None
            except Exception:
                dictionary = None
                warning = "KEYWORD_DICTIONARY_READ_FAILED"
            with self._keyword_state_lock:
                if generation != self._keyword_generation:
                    return
                self._last_keyword_check = time.monotonic()
                if dictionary:
                    self._install_keyword_dictionary(dictionary)
                else:
                    self._keywords = {
                        **self._keywords,
                        "warnings": (warning or "ACTIVE_KEYWORD_DICTIONARY_MISSING",),
                    }
        finally:
            self._keyword_read_lock.release()

    @staticmethod
    def evaluate_developer_relevance(
        article: Article, *, keywords: frozenset[str] | None = None
    ) -> int:
        """TF-IDF Sigmoid (math.tanh) 토큰 밀도 알고리즘 (가중치 35%)"""
        if NON_ARTICLE_PATTERN.search(article.title):
            return 0
        if len(article.content.strip()) < 200:
            return 0
        text = f"{article.title} {article.content}".lower()
        tokens = [token.lower() for token in TOKEN_PATTERN.findall(text)]
        if not tokens:
            return 0
        token_counts = Counter(tokens)
        tf_sum = 0.0
        for keyword in keywords if keywords is not None else DEVELOPER_KEYWORDS:
            kw = keyword.lower()
            if " " in kw or "-" in kw:
                pattern = re.compile(r"\b" + re.escape(kw) + r"\b", re.IGNORECASE)
                count = len(pattern.findall(text))
            else:
                count = token_counts.get(kw, 0)
            if count > 0:
                tf_sum += 1.0 + math.log(count)
        return round(100.0 * math.tanh(75.0 * (tf_sum / len(tokens))))

    @staticmethod
    def evaluate_technical_depth_llm(article: Article, api_key: str | None = None) -> int:
        """LLM API 연동 기술적 깊이 분석 (Gemini 및 OpenAI 모두 지원, 미설정/실패 시 Fallback 50점)"""
        effective_key = (
            api_key
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("LLM_API_KEY")
            or os.environ.get("OPENAI_API_KEY")
        )
        if not effective_key:
            return 50

        # Gemini API 키 (AIza, AQ 또는 GEMINI/LLM 키)
        if effective_key:
            try:
                model_name = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={effective_key}"
                prompt = (
                    "Evaluate the technical depth and engineering value of this tech article on a scale of 0 to 100 based on these 4 rubrics:\n"
                    "1. Technical Utility & Open-Source/Tooling News (0-30 pts): Discusses useful open-source tools, CLI utilities, libraries, frameworks, or developer productivity announcements.\n"
                    "2. Systems & Architectural Insight (0-30 pts): Explains low-level internals, memory allocation, network protocols, system architecture, or code/config schemas.\n"
                    "3. Production Engineering & Problem-Solving (0-30 pts): Details real-world outage root-cause analysis, performance tuning, benchmarks, or scalability challenges.\n"
                    "4. Engineering Specificity & Rigor (0-10 pts): Uses precise domain-specific engineering vocabulary instead of high-level marketing hype.\n\n"
                    f"Title: {article.title}\n"
                    f"Content: {article.content}\n\n"
                    f'Return JSON format only: {{"depth_score": number, "reasoning": "brief explanation"}}'
                )
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"},
                }
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    res_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(res_text)
                    score = int(parsed.get("depth_score", 50))
                    return max(0, min(100, score))
            except Exception:
                pass

        # OpenAI API 호출 (Fallback)
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {effective_key}",
            }
            prompt = (
                "Evaluate the technical depth and engineering value of this tech article on a scale of 0 to 100 based on these 4 rubrics:\n"
                "1. Technical Utility & Open-Source/Tooling News (0-30 pts): Discusses useful open-source tools, CLI utilities, libraries, frameworks, or developer productivity announcements.\n"
                "2. Systems & Architectural Insight (0-30 pts): Explains low-level internals, memory allocation, network protocols, system architecture, or code/config schemas.\n"
                "3. Production Engineering & Problem-Solving (0-30 pts): Details real-world outage root-cause analysis, performance tuning, benchmarks, or scalability challenges.\n"
                "4. Engineering Specificity & Rigor (0-10 pts): Uses precise domain-specific engineering vocabulary instead of high-level marketing hype.\n\n"
                f"Title: {article.title}\n"
                f"Content: {article.content}\n\n"
                f'Return JSON format only: {{"depth_score": number, "reasoning": "brief explanation"}}'
            )
            payload = {
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "response_format": {"type": "json_object"},
            }
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                res_text = res_data["choices"][0]["message"]["content"]
                parsed = json.loads(res_text)
                score = int(parsed.get("depth_score", 50))
                return max(0, min(100, score))
        except Exception:
            return 50

    @staticmethod
    def evaluate_timeliness(published_at: datetime | None, evaluated_at: datetime) -> int:
        """48시간 반감기(Half-Life) 지수 곡선 수식 적용 (가중치 25%)"""
        if published_at is None:
            return 50
        published = published_at.astimezone(UTC)
        hours = (evaluated_at - published).total_seconds() / 3600
        if hours <= 0:
            return 100
        return round(100.0 * (0.5 ** (hours / 48.0)))

    @staticmethod
    def evaluate_article_quality(request: QualityEvaluationRequest) -> int:
        """기본 메타데이터 충실도 및 본문 분량 충실도 평가 (가중치 10%)"""
        source_id = request.source.source_id.strip()
        authors = request.article.authors
        published_at = request.article.original_published_at
        content_length = len(request.article.content.strip())
        min_length = request.quality_policy.minimum_content_length
        max_length = request.quality_policy.maximum_content_length

        meta_score = 0
        if source_id:
            meta_score += 20
        if authors and any(a.strip() for a in authors):
            meta_score += 15
        if published_at is not None:
            meta_score += 15

        length_score = 0
        if min_length <= content_length <= max_length:
            length_score = 50
        elif content_length > 0:
            length_score = 25

        return min(100, meta_score + length_score)

    @staticmethod
    def _spam_suspected(content: str) -> bool:
        tokens = [token.lower() for token in TOKEN_PATTERN.findall(content)]
        if len(tokens) < 20:
            return False
        counts = Counter(tokens)
        return counts.most_common(1)[0][1] / len(tokens) >= 0.35

    @staticmethod
    def _advertisement_indicators(text: str) -> list[str]:
        """Return explicit commercial-disclosure signals without affecting decision."""
        return [label for label, pattern in ADVERTISEMENT_PATTERNS if pattern.search(text)]

    def _failure(
        self, article_id: str, code: str, message: str, details: dict[str, Any]
    ) -> dict[str, Any]:
        result = QualityEvaluationResult(
            articleId=article_id,
            qualityEvaluation=Evaluation(
                status="FAILED",
                decision=None,
                evaluatedAt=self._clock().astimezone(UTC),
                evaluatorVersion=EVALUATOR_VERSION,
                policyVersion=None,
                signals=None,
                score=None,
                reason="품질 평가를 수행하지 못했습니다.",
                rejectionCodes=[],
                error=ErrorPayload(
                    code=code,
                    message=message,
                    retryable=False,
                    details=details,
                ),
            ),
        )
        return result.model_dump(by_alias=True, mode="json")
