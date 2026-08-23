from __future__ import annotations

import math
import re
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
    Score,
    Signals,
)

Clock = Callable[[], datetime]
EVALUATOR_VERSION = "1.0.0"

DEVELOPER_KEYWORDS = frozenset(
    {
        "python", "java", "javascript", "typescript", "golang", "rust", "kotlin",
        "swift", "react", "vue", "next.js", "angular", "svelte", "docker",
        "kubernetes", "aws", "gcp", "azure", "terraform", "ci/cd", "github actions",
        "postgresql", "mysql", "redis", "mongodb", "elasticsearch", "kafka", "ai",
        "llm", "openai", "machine learning", "deep learning", "transformer", "api",
        "graphql", "grpc", "microservice", "architecture", "refactoring", "security",
        "oauth", "performance", "concurrency", "pytest", "jest", "개발", "개발자",
        "프로그래밍", "파이썬", "자바", "자바스크립트", "타입스크립트", "리액트",
        "데이터베이스", "클라우드", "컨테이너", "쿠버네티스", "도커", "인공지능",
        "머신러닝", "딥러닝", "보안", "네트워크", "아키텍처", "오픈소스", "배포",
        "테스트", "성능", "서버", "프론트엔드", "백엔드", "모바일", "운영체제",
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
    """Deterministic implementation of the supplied 45/30/25 scoring policy."""

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
        advertisement = bool(
            ADVERTISEMENT_PATTERN.search(f"{article.title} {article.content}")
        )
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

        relevance = self.evaluate_developer_relevance(article)
        timeliness = self.evaluate_timeliness(article.original_published_at, now)
        source_reliability = self.evaluate_source_reliability(request)
        overall = round(relevance * 0.45 + timeliness * 0.30 + source_reliability * 0.25)
        overall = max(0, min(100, overall))

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
                        timeliness=timeliness,
                        sourceReliability=source_reliability,
                    ),
                ),
                reason=reason,
                rejectionCodes=list(dict.fromkeys(rejection_codes)),
                error=None,
            ),
        )
        return result.model_dump(by_alias=True, mode="json")

    @staticmethod
    def evaluate_developer_relevance(article: Article) -> int:
        if NON_ARTICLE_PATTERN.search(article.title):
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
        return round(100.0 * math.tanh(55.0 * (tf_sum / len(tokens))))

    @staticmethod
    def evaluate_timeliness(published_at: datetime | None, evaluated_at: datetime) -> int:
        if published_at is None:
            return 50
        published = published_at.astimezone(UTC)
        hours = (evaluated_at - published).total_seconds() / 3600
        if hours <= 0:
            return 100
        if hours >= 24:
            return 0
        return round(100 - hours / 24 * 100)

    @staticmethod
    def evaluate_source_reliability(request: QualityEvaluationRequest) -> int:
        score = 35 if request.source.source_id.strip() else 15
        score += 30 if any(author.strip() for author in request.article.authors) else 10
        score += 35 if request.article.original_published_at is not None else 10
        return min(100, score)

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
