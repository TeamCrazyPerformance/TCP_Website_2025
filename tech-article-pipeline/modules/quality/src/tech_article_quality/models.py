from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class Source(ContractModel):
    source_id: str = Field(alias="sourceId", min_length=1, max_length=128)


class Article(ContractModel):
    title: str = Field(min_length=1, max_length=1_000)
    content: str = Field(min_length=1)
    language: str = Field(min_length=2, max_length=16)
    authors: list[str] = Field(default_factory=list)
    original_published_at: datetime | None = Field(
        alias="originalPublishedAt", default=None
    )

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        return value.lower()

    @field_validator("original_published_at")
    @classmethod
    def require_utc_publication_time(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ValueError("originalPublishedAt must be an explicit UTC timestamp")
        return value.astimezone(UTC)


class QualityPolicy(ContractModel):
    policy_version: str = Field(alias="policyVersion", default="quality-policy-v1")
    minimum_evaluation_score: int = Field(
        alias="minimumEvaluationScore", default=70, ge=0, le=100
    )
    review_lower_bound: int = Field(alias="reviewLowerBound", default=45, ge=0, le=100)
    minimum_content_length: int = Field(
        alias="minimumContentLength", default=200, ge=1
    )
    maximum_content_length: int = Field(
        alias="maximumContentLength", default=2_000_000, ge=1
    )
    allowed_languages: list[str] = Field(
        alias="allowedLanguages", default_factory=lambda: ["ko", "en"]
    )
    reject_spam: bool = Field(alias="rejectSpam", default=True)
    reject_advertisements: bool = Field(alias="rejectAdvertisements", default=True)
    require_admin_review: bool = Field(alias="requireAdminReview", default=False)

    @field_validator("allowed_languages")
    @classmethod
    def normalize_languages(cls, values: list[str]) -> list[str]:
        normalized = [value.lower() for value in values]
        if not normalized or any(not value.strip() for value in normalized):
            raise ValueError("allowedLanguages must contain at least one language")
        return list(dict.fromkeys(normalized))

    @model_validator(mode="after")
    def validate_bounds(self) -> QualityPolicy:
        if self.maximum_content_length < self.minimum_content_length:
            raise ValueError("maximumContentLength must be at least minimumContentLength")
        if self.review_lower_bound > self.minimum_evaluation_score:
            raise ValueError("reviewLowerBound must not exceed minimumEvaluationScore")
        return self


class QualityEvaluationRequest(ContractModel):
    article_id: str = Field(alias="articleId", min_length=1, max_length=64)
    source: Source
    article: Article
    quality_policy: QualityPolicy = Field(alias="qualityPolicy")


class ErrorPayload(ContractModel):
    code: str
    message: str
    retryable: bool
    details: dict[str, Any] = Field(default_factory=dict)


class Signals(ContractModel):
    content_length: int = Field(alias="contentLength", ge=0)
    language: str
    content_complete: bool = Field(alias="contentComplete")
    spam_suspected: bool = Field(alias="spamSuspected")
    advertisement_suspected: bool = Field(alias="advertisementSuspected")


class Dimensions(ContractModel):
    relevance: int = Field(ge=0, le=100)
    timeliness: int = Field(ge=0, le=100)
    source_reliability: int = Field(alias="sourceReliability", ge=0, le=100)


class ScoreScale(ContractModel):
    minimum: int = Field(alias="min", default=0)
    maximum: int = Field(alias="max", default=100)


class ScoreAxis(ContractModel):
    key: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=100)
    value: int = Field(ge=0, le=100)
    weight: float | None = Field(default=None, ge=0, le=1)
    contribution: float | None = None


class Score(ContractModel):
    overall: int = Field(ge=0, le=100)
    dimensions: Dimensions
    scale: ScoreScale = Field(default_factory=ScoreScale)
    axes: list[ScoreAxis] = Field(default_factory=list, max_length=20)


class Evaluation(ContractModel):
    schema_version: str = Field(alias="schemaVersion", default="2.0")
    status: Literal["SUCCESS", "FAILED"]
    decision: Literal["PASS", "REJECT", "REVIEW_REQUIRED"] | None
    evaluated_at: datetime = Field(alias="evaluatedAt")
    evaluator_version: str = Field(alias="evaluatorVersion")
    policy_version: str | None = Field(alias="policyVersion")
    signals: Signals | None
    score: Score | None
    reason: str
    rejection_codes: list[str] = Field(alias="rejectionCodes")
    error: ErrorPayload | None


class QualityEvaluationResult(ContractModel):
    article_id: str = Field(alias="articleId")
    quality_evaluation: Evaluation = Field(alias="qualityEvaluation")
