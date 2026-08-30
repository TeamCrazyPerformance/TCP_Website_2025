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

DEVELOPER_KEYWORDS = frozenset(
    {
        "python",
        "java",
        "javascript",
        "typescript",
        "golang",
        "rust",
        "kotlin",
        "swift",
        "php",
        "ruby",
        "scala",
        "dart",
        "elixir",
        "zig",
        "lua",
        "haskell",
        "clojure",
        "react",
        "vue",
        "next.js",
        "nuxt",
        "angular",
        "svelte",
        "tailwind",
        "webpack",
        "vite",
        "redux",
        "zustand",
        "webassembly",
        "three.js",
        "webgl",
        "docker",
        "kubernetes",
        "k8s",
        "aws",
        "gcp",
        "azure",
        "terraform",
        "ansible",
        "ci/cd",
        "jenkins",
        "github actions",
        "nginx",
        "istio",
        "serverless",
        "helm",
        "prometheus",
        "grafana",
        "postgresql",
        "mysql",
        "redis",
        "mongodb",
        "elasticsearch",
        "kafka",
        "rabbitmq",
        "sqlite",
        "spark",
        "airflow",
        "vector db",
        "milvus",
        "pinecone",
        "cassandra",
        "dynamodb",
        "clickhouse",
        "duckdb",
        "ai",
        "llm",
        "deepmind",
        "openai",
        "gpt",
        "langchain",
        "rag",
        "pytorch",
        "tensorflow",
        "huggingface",
        "machine learning",
        "deep learning",
        "neural network",
        "fine-tuning",
        "transformer",
        "ollama",
        "architecture",
        "refactoring",
        "clean code",
        "design pattern",
        "domain driven design",
        "ddd",
        "test driven development",
        "tdd",
        "code review",
        "security",
        "oauth",
        "performance tuning",
        "memory leak",
        "profiling",
        "concurrency",
        "async",
        "multithreading",
        "pytest",
        "junit",
        "jest",
        "cypress",
        "playwright",
        # [QA 피드백 반영] 대폭 확장된 로우레벨 시스템 / 네트워크 / 성능 최적화 키워드
        "dns",
        "cache",
        "memory",
        "optimization",
        "socket",
        "bpf",
        "ebpf",
        "kernel",
        "linux",
        "buffer",
        "allocation",
        "latency",
        "throughput",
        "tcp",
        "udp",
        "packet",
        "network",
        "process",
        "thread",
        "pointer",
        "struct",
        "algorithm",
        "hash table",
        "lru",
        "trie",
        "system",
        "benchmark",
        "profiling",
        "garbage collection",
        "gc",
        "cpu",
        "concurrency",
        "io",
        "non-blocking",
        "event loop",
        "epoll",
        "kqueue",
        "개발",
        "개발자",
        "프로그래밍",
        "파이썬",
        "자바",
        "자바스크립트",
        "타입스크립트",
        "리액트",
        "데이터베이스",
        "클라우드",
        "컨테이너",
        "쿠버네티스",
        "도커",
        "인공지능",
        "머신러닝",
        "딥러닝",
        "보안",
        "네트워크",
        "아키텍처",
        "오픈소스",
        "배포",
        "테스트",
        "성능",
        "서버",
        "프론트엔드",
        "백엔드",
        "모바일",
        "운영체제",
    }
)

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
                    "Evaluate the technical depth of this engineering article on a scale of 0 to 100 based on these 4 rubrics:\n"
                    "1. Code & Command Precision (0-30 pts): Contains code snippets, shell commands, or config schemas.\n"
                    "2. Systems & Architectural Insight (0-30 pts): Discusses low-level internals, memory, protocols, or architecture.\n"
                    "3. Production Problem-Solving (0-30 pts): Explains root cause analysis, performance tuning, benchmarks, or scalability.\n"
                    "4. Professional Specificity (0-10 pts): Uses precise domain-specific engineering vocabulary instead of marketing hype.\n\n"
                    f"Title: {article.title}\n"
                    f"Content: {article.content[:1500]}\n\n"
                    f'Return JSON only: {{"depth_score": number, "reasoning": "brief explanation"}}'
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
                "Evaluate the technical depth of this engineering article on a scale of 0 to 100 based on these 4 rubrics:\n"
                "1. Code & Command Precision (0-30 pts): Contains code snippets, shell commands, or config schemas.\n"
                "2. Systems & Architectural Insight (0-30 pts): Discusses low-level internals, memory, protocols, or architecture.\n"
                "3. Production Problem-Solving (0-30 pts): Explains root cause analysis, performance tuning, benchmarks, or scalability.\n"
                "4. Professional Specificity (0-10 pts): Uses precise domain-specific engineering vocabulary instead of marketing hype.\n\n"
                f"Title: {article.title}\n"
                f"Content: {article.content[:1500]}\n\n"
                f'Return JSON only: {{"depth_score": number, "reasoning": "brief explanation"}}'
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
