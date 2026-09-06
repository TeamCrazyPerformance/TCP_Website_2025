from __future__ import annotations

import json
import math
import os
import re
import urllib.request
from collections import Counter
from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from .models import (
    Article,
    Dimensions,
    ErrorPayload,
    Evaluation,
    QualityEvaluationRequest,
    QualityEvaluationResult,
    QualityPolicy,
    Score,
    ScoreAxis,
    Signals,
)

Clock = Callable[[], datetime]
EVALUATOR_VERSION = "2.2.6"
# 개편된 4대 평가 축 정의 (개발 관련성 35%, 기술적 깊이 30%, 최신성 25%, 기사 품질 10%)
QUALITY_AXES = (
    {"key": "relevance", "label": "개발 관련성", "weight": 0.35},
    {"key": "technicalDepth", "label": "기술적 깊이", "weight": 0.30},
    {"key": "timeliness", "label": "최신성", "weight": 0.25},
    {"key": "articleQuality", "label": "기사 품질", "weight": 0.10},
)

from .keywords_manager import get_combined_developer_keywords

DEVELOPER_KEYWORDS = get_combined_developer_keywords()

NON_ARTICLE_PATTERN = re.compile(
    r"\b(subscribe|learning center|webinars archives|archive|showcase|landscape|sponsors?)\b",
    re.IGNORECASE,
)
ADVERTISEMENT_PATTERN = re.compile(
    r"(?:sponsored|advertisement|buy now|limited offer|제휴|광고|구매하기|특가)",
    re.IGNORECASE,
)
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_+#.-]+|[가-힣]+")


def _utcnow() -> datetime:
    return datetime.now(UTC)


class QualityEvaluator:
    """Deterministic implementation of the updated 35/30/25/10 scoring policy with LLM depth and 48h half-life."""

    def __init__(self, *, clock: Clock = _utcnow) -> None:
        self._clock = clock

    def evaluate(self, input_data: Mapping[str, Any]) -> dict[str, Any]:
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
        advertisement = bool(ADVERTISEMENT_PATTERN.search(f"{article.title} {article.content}"))
        hard_rejections: list[str] = []
        if content_length < policy.minimum_content_length:
            hard_rejections.append("CONTENT_TOO_SHORT")
        if content_length > policy.maximum_content_length:
            hard_rejections.append("CONTENT_TOO_LONG")
        if article.language not in policy.allowed_languages:
            hard_rejections.append("LANGUAGE_NOT_ALLOWED")
        if policy.reject_spam and spam:
            hard_rejections.append("SPAM_SUSPECTED")
        if policy.reject_advertisements and advertisement:
            hard_rejections.append("ADVERTISEMENT_SUSPECTED")

        # 4대 평가 축 채점
        effective_api_key = request.llm_api_key or policy.llm_api_key
        relevance = self.evaluate_developer_relevance(article)
        technical_depth = self.evaluate_technical_depth_llm(article, api_key=effective_api_key)
        timeliness = self.evaluate_timeliness(article.original_published_at, now)
        article_quality = self.evaluate_article_quality(request)

        dimension_values = {
            "relevance": relevance,
            "technicalDepth": technical_depth,
            "timeliness": timeliness,
            "articleQuality": article_quality,
        }
        bonus = self.calculate_community_engagement_bonus(request)
        overall = round(
            sum(dimension_values[axis["key"]] * float(axis["weight"]) for axis in QUALITY_AXES)
        )
        overall = max(0, min(100, overall + bonus))
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
                if bonus > 0:
                    reason += f" (개발자 호응 보너스 +{bonus}점 적용)"
        else:
            rejection_codes.append("LOW_EVALUATION_SCORE")
            if overall >= policy.review_lower_bound:
                decision = "REVIEW_REQUIRED"
                reason = "품질 점수가 검토 가능 범위에 있어 관리자 판단이 필요합니다."
                if bonus > 0:
                    reason += f" (개발자 호응 보너스 +{bonus}점 적용)"
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

    @staticmethod
    def evaluate_developer_relevance(article: Article) -> int:
        """TF-IDF Sigmoid (math.tanh) 키워드 밀도 알고리즘 (가중치 35%)"""
        if NON_ARTICLE_PATTERN.search(article.title):
            return 0
        if len(article.content.strip()) < 200:
            return 0
        text = f"{article.title} {article.content}".lower()
        tokens = TOKEN_PATTERN.findall(text)
        if not tokens:
            return 0
        tf_sum = 0.0
        for keyword in DEVELOPER_KEYWORDS:
            count = text.count(keyword)
            if count:
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
                    f"Content: {article.content[:1500]}\n\n"
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
                f"Content: {article.content[:1500]}\n\n"
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
    def calculate_community_engagement_bonus(request: QualityEvaluationRequest) -> int:
        """
        개발자 반응 지수 보너스 (+0 ~ +10점)
        - 반응 데이터 미지원 소스(Cloudflare, Tailscale, Rust, DeepMind 등): 0점 (가산 없음)
        - 반응 데이터 지원 소스(GitHub Trending, HuggingFace, InfoQ 등): 정밀 임계값 적용
        """
        source_id = request.source.source_id.strip().lower()
        article = request.article

        # 1. GitHub Trending (starsToday / stars)
        if source_id == "github-trending":
            stars_today = getattr(article, "stars_today", None) or getattr(article, "starsToday", None)
            if stars_today is None and hasattr(article, "extra") and isinstance(article.extra, dict):
                stars_today = article.extra.get("starsToday") or article.extra.get("stars_today")
            if isinstance(stars_today, (int, float)):
                if stars_today >= 300:
                    return 10
                elif stars_today >= 150:
                    return 7
                elif stars_today >= 50:
                    return 4
            return 0

        # 2. Hugging Face Blog (likes)
        if source_id == "hugging-face-blog":
            likes = getattr(article, "likes", None)
            if likes is None and hasattr(article, "extra") and isinstance(article.extra, dict):
                likes = article.extra.get("likes")
            if isinstance(likes, (int, float)):
                if likes >= 50:
                    return 10
                elif likes >= 20:
                    return 7
                elif likes >= 5:
                    return 4
            return 0

        # 3. InfoQ / SD Times (views / comments)
        if source_id in {"infoq", "sdtimes"}:
            views = getattr(article, "views", None)
            comments = getattr(article, "comments", None)
            if hasattr(article, "extra") and isinstance(article.extra, dict):
                views = views or article.extra.get("views")
                comments = comments or article.extra.get("comments")
            v_val = views if isinstance(views, (int, float)) else 0
            c_val = comments if isinstance(comments, (int, float)) else 0
            if v_val >= 5000 or c_val >= 10:
                return 10
            elif v_val >= 2000 or c_val >= 5:
                return 7
            elif v_val >= 800 or c_val >= 2:
                return 4
            return 0

        # 4. 기타 반응 데이터 미지원 소스 -> 0점 (가산 없음)
        return 0

    @staticmethod
    def _spam_suspected(content: str) -> bool:
        tokens = [token.lower() for token in TOKEN_PATTERN.findall(content)]
        if len(tokens) < 20:
            return False
        counts = Counter(tokens)
        return counts.most_common(1)[0][1] / len(tokens) >= 0.35

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
