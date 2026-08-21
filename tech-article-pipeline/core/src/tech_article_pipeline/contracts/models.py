from __future__ import annotations

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class Stage(StrEnum):
    ADMISSION = "ADMISSION"
    QUALITY = "QUALITY"
    ENRICHMENT = "ENRICHMENT"


class CrawlJobStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    RETRY = "RETRY"
    SUCCEEDED = "SUCCEEDED"
    DEAD = "DEAD"


class JobStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    RETRY = "RETRY"
    SUCCEEDED = "SUCCEEDED"
    DEAD = "DEAD"


class PublicationPolicy(StrEnum):
    IMMEDIATE = "IMMEDIATE"
    REVIEW = "REVIEW"


class PublicationStatus(StrEnum):
    UNPUBLISHED = "UNPUBLISHED"
    PUBLISHED = "PUBLISHED"
    HIDDEN = "HIDDEN"
    ARCHIVED = "ARCHIVED"


class QualityDecision(StrEnum):
    PASS = "PASS"
    REJECT = "REJECT"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class Source(ContractModel):
    source_id: str = Field(alias="sourceId", min_length=1, max_length=128)
    source_type: str = Field(alias="sourceType", default="WEB_CRAWL", min_length=1)


class CrawlSource(ContractModel):
    source_id: Literal[
        "cloudflare-blog", "infoq", "sdtimes", "github-trending"
    ] = Field(alias="sourceId")
    source_type: Literal["WEB_CRAWL", "RSS", "API"] = Field(alias="sourceType")
    section_key: Literal["BLOG", "NEWS", "ENGINEERING", "REPOSITORIES"] = Field(
        alias="sectionKey"
    )

    @model_validator(mode="after")
    def validate_source_capability(self) -> CrawlSource:
        allowed = {
            "cloudflare-blog": {("RSS", "BLOG")},
            "infoq": {("RSS", "NEWS"), ("RSS", "ENGINEERING"),
                      ("WEB_CRAWL", "NEWS"), ("WEB_CRAWL", "ENGINEERING")},
            "sdtimes": {("WEB_CRAWL", "NEWS"), ("RSS", "NEWS"), ("API", "NEWS")},
            "github-trending": {("WEB_CRAWL", "REPOSITORIES")},
        }
        if (self.source_type, self.section_key) not in allowed[self.source_id]:
            raise ValueError(
                f"unsupported sourceType/sectionKey for sourceId {self.source_id}"
            )
        return self


class CrawlOptions(ContractModel):
    maximum_article_count: int = Field(alias="maximumArticleCount", default=10, ge=1, le=100)
    maximum_age_hours: int | None = Field(alias="maximumAgeHours", default=720, ge=1)
    follow_pagination: bool = Field(alias="followPagination", default=False)
    maximum_page_count: int = Field(alias="maximumPageCount", default=1, ge=1, le=10)
    request_timeout_ms: int = Field(alias="requestTimeoutMs", default=15_000, ge=1_000, le=60_000)


class Urls(ContractModel):
    discovered_url: str | None = Field(
        alias="discoveredUrl", default=None, exclude_if=lambda value: value is None
    )
    final_url: str | None = Field(
        alias="finalUrl", default=None, exclude_if=lambda value: value is None
    )
    canonical_url: str = Field(alias="canonicalUrl", min_length=1)


class NormalizedArticle(ContractModel):
    title: str = Field(min_length=1, max_length=1_000)
    authors: list[str] = Field(default_factory=list)
    original_published_at: datetime | None = Field(alias="originalPublishedAt")
    content: str = Field(min_length=1, max_length=5 * 1024 * 1024)
    language: str = Field(min_length=2, max_length=16)

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        return value.lower()

    @field_validator("original_published_at")
    @classmethod
    def require_utc_publication_time(cls, value: datetime | None) -> datetime | None:
        return _require_utc(value, "originalPublishedAt")


class Normalization(ContractModel):
    status: Literal["SUCCESS"]
    normalized_at: datetime = Field(alias="normalizedAt")
    normalizer_version: str = Field(alias="normalizerVersion", min_length=1)
    warnings: list[str] = Field(default_factory=list)
    error: None = None

    @field_validator("normalized_at")
    @classmethod
    def require_utc_normalized_time(cls, value: datetime) -> datetime:
        checked = _require_utc(value, "normalizedAt")
        assert checked is not None
        return checked


class DuplicatePolicy(ContractModel):
    policy_version: Literal["duplicate-policy-v1"] = Field(alias="policyVersion")
    check_canonical_url: bool = Field(alias="checkCanonicalUrl", default=True)
    check_content_hash: bool = Field(alias="checkContentHash", default=True)
    check_title_similarity: bool = Field(alias="checkTitleSimilarity", default=True)
    duplicate_title_threshold: float = Field(
        alias="duplicateTitleThreshold", default=0.92, ge=0, le=1
    )
    possible_duplicate_threshold: float = Field(
        alias="possibleDuplicateThreshold", default=0.80, ge=0, le=1
    )
    candidate_maximum_age_days: int | None = Field(
        alias="candidateMaximumAgeDays",
        default=None,
        ge=1,
        exclude_if=lambda value: value is None,
    )
    maximum_candidate_count: int = Field(
        alias="maximumCandidateCount", default=100, ge=1, le=100
    )

    @model_validator(mode="after")
    def validate_thresholds(self) -> DuplicatePolicy:
        if self.possible_duplicate_threshold > self.duplicate_title_threshold:
            raise ValueError("possibleDuplicateThreshold cannot exceed duplicateTitleThreshold")
        return self


class QualityPolicy(ContractModel):
    policy_version: str = Field(alias="policyVersion", default="quality-policy-v1")
    minimum_evaluation_score: int = Field(
        alias="minimumEvaluationScore", default=70, ge=0, le=100
    )
    review_lower_bound: int = Field(alias="reviewLowerBound", default=45, ge=0, le=100)
    minimum_content_length: int = Field(alias="minimumContentLength", default=200, ge=1)
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
        normalized = [value.lower().strip() for value in values]
        if not normalized or any(not value for value in normalized):
            raise ValueError("allowedLanguages must contain at least one language")
        return list(dict.fromkeys(normalized))

    @model_validator(mode="after")
    def validate_bounds(self) -> QualityPolicy:
        if self.maximum_content_length < self.minimum_content_length:
            raise ValueError("maximumContentLength must be at least minimumContentLength")
        if self.review_lower_bound > self.minimum_evaluation_score:
            raise ValueError("reviewLowerBound must not exceed minimumEvaluationScore")
        return self


class GenerationOptions(ContractModel):
    output_language: str = Field(alias="outputLanguage", default="ko", pattern=r"^[A-Za-z]{2}$")
    maximum_summary_length: int = Field(alias="maximumSummaryLength", default=800, ge=1)
    maximum_one_line_summary_length: int = Field(
        alias="maximumOneLineSummaryLength", default=100, ge=1
    )
    maximum_tag_count: int = Field(alias="maximumTagCount", default=3, ge=0, le=15)
    translate_title: bool = Field(alias="translateTitle", default=True)
    translate_content: bool = Field(alias="translateContent", default=False)

    @field_validator("output_language")
    @classmethod
    def normalize_output_language(cls, value: str) -> str:
        return value.lower()


class NormalizedArticleCandidate(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    crawl_run_id: str = Field(alias="crawlRunId", min_length=1, max_length=160)
    crawl_item_id: str = Field(alias="crawlItemId", min_length=1, max_length=160)
    source: Source
    discovery: dict[str, Any] = Field(default_factory=dict)
    urls: Urls
    article: NormalizedArticle
    normalization: Normalization
    duplicate_policy: DuplicatePolicy = Field(alias="duplicatePolicy")
    quality_policy: QualityPolicy = Field(alias="qualityPolicy", default_factory=QualityPolicy)
    generation_options: GenerationOptions = Field(
        alias="generationOptions", default_factory=GenerationOptions
    )


class CrawlRequested(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    source: CrawlSource
    crawl_options: CrawlOptions = Field(alias="crawlOptions", default_factory=CrawlOptions)
    duplicate_policy: DuplicatePolicy = Field(
        alias="duplicatePolicy",
        default_factory=lambda: DuplicatePolicy(policy_version="duplicate-policy-v1"),
    )
    quality_policy: QualityPolicy = Field(alias="qualityPolicy", default_factory=QualityPolicy)
    generation_options: GenerationOptions = Field(
        alias="generationOptions", default_factory=GenerationOptions
    )

    @model_validator(mode="after")
    def validate_options_for_source(self) -> CrawlRequested:
        if self.source.source_id == "cloudflare-blog" and self.crawl_options.maximum_age_hours is None:
            raise ValueError("cloudflare-blog requires maximumAgeHours")
        if self.source.source_type != "WEB_CRAWL" and self.crawl_options.follow_pagination:
            raise ValueError("followPagination is supported only for WEB_CRAWL")
        if self.source.source_id != "infoq" and self.crawl_options.follow_pagination:
            raise ValueError("followPagination is implemented only by the infoq adapter")
        if self.source.source_id == "github-trending":
            if "maximum_article_count" not in self.crawl_options.model_fields_set:
                self.crawl_options.maximum_article_count = 3
            if self.crawl_options.maximum_article_count > 3:
                raise ValueError("github-trending maximumArticleCount cannot exceed 3")
            if self.crawl_options.maximum_page_count != 1:
                raise ValueError("github-trending maximumPageCount must be 1")
        return self


class CrawlJobRecord(ContractModel):
    job_id: str = Field(alias="jobId")
    crawl_run_id: str = Field(alias="crawlRunId")
    status: CrawlJobStatus
    attempt_count: int = Field(alias="attemptCount", ge=0)
    max_attempts: int = Field(alias="maxAttempts", ge=1)
    available_at: datetime = Field(alias="availableAt")
    lease_expires_at: datetime | None = Field(alias="leaseExpiresAt", default=None)
    lease_token: str | None = Field(alias="leaseToken", default=None)
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class JobRecord(ContractModel):
    job_id: str = Field(alias="jobId")
    submission_id: str = Field(alias="submissionId")
    stage: Stage
    status: JobStatus
    attempt_count: int = Field(alias="attemptCount", ge=0)
    max_attempts: int = Field(alias="maxAttempts", ge=1)
    available_at: datetime = Field(alias="availableAt")
    lease_expires_at: datetime | None = Field(alias="leaseExpiresAt", default=None)
    lease_token: str | None = Field(alias="leaseToken", default=None)
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class PublicationPolicyPatch(ContractModel):
    policy: PublicationPolicy
    expected_version: int | None = Field(alias="expectedVersion", default=None, ge=1)


class QualityResolution(ContractModel):
    action: Literal["APPROVE", "REJECT"]
    expected_case_version: int = Field(alias="expectedCaseVersion", ge=1)
    administrator_id: str = Field(alias="administratorId", min_length=1)


class PublicationAction(ContractModel):
    action: Literal["PUBLISH", "HIDE", "ARCHIVE"]
    expected_record_version: int = Field(alias="expectedRecordVersion", ge=1)
    administrator_id: str = Field(alias="administratorId", min_length=1)
    reason: str = Field(default="", max_length=500)


def _require_utc(value: datetime | None, field: str) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError(f"{field} must be an explicit UTC timestamp")
    return value.astimezone(UTC)
