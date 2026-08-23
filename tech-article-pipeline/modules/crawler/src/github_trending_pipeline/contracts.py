from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _require_utc(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError(f"{field_name} must be an explicit UTC timestamp")
    return value.astimezone(UTC)


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ErrorInfo(ContractModel):
    code: str
    message: str
    retryable: bool = False
    details: dict[str, object] = Field(default_factory=dict)


class CrawlSource(ContractModel):
    source_id: Literal["github-trending"] = Field(
        alias="sourceId", default="github-trending"
    )
    source_type: Literal["WEB_CRAWL"] = Field(
        alias="sourceType", default="WEB_CRAWL"
    )
    section_key: Literal["REPOSITORIES"] = Field(
        alias="sectionKey", default="REPOSITORIES"
    )


class CrawlOptions(ContractModel):
    maximum_article_count: int = Field(
        alias="maximumArticleCount", default=3, ge=1, le=3
    )
    request_timeout_ms: int = Field(
        alias="requestTimeoutMs", default=15_000, ge=1_000, le=60_000
    )


class CrawlRequest(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    message_type: Literal["CrawlRequested"] = Field(
        alias="messageType", default="CrawlRequested"
    )
    crawl_run_id: str = Field(alias="crawlRunId", min_length=1, max_length=160)
    requested_at: datetime = Field(alias="requestedAt")
    source: CrawlSource = Field(default_factory=CrawlSource)
    crawl_options: CrawlOptions = Field(alias="crawlOptions", default_factory=CrawlOptions)

    @field_validator("requested_at")
    @classmethod
    def require_utc_requested_at(cls, value: datetime) -> datetime:
        return _require_utc(value, "requestedAt")


class TrendingRepository(ContractModel):
    rank: int = Field(ge=1)
    owner: str = Field(min_length=1, max_length=39)
    repository: str = Field(min_length=1, max_length=100)
    description: str | None = None
    programming_language: str | None = Field(alias="programmingLanguage", default=None)
    total_stars: int | None = Field(alias="totalStars", default=None, ge=0)
    total_forks: int | None = Field(alias="totalForks", default=None, ge=0)
    stars_today: int | None = Field(alias="starsToday", default=None, ge=0)
    built_by: list[str] = Field(alias="builtBy", default_factory=list)

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repository}"


class SourceIdentity(ContractModel):
    source_id: Literal["github-trending"] = Field(
        alias="sourceId", default="github-trending"
    )
    source_type: Literal["WEB_CRAWL"] = Field(
        alias="sourceType", default="WEB_CRAWL"
    )


class DiscoveryInfo(ContractModel):
    entry_point_url: str = Field(alias="entryPointUrl")
    discovered_from_url: str = Field(alias="discoveredFromUrl")
    source_path: Literal["/trending"] = Field(alias="sourcePath", default="/trending")
    section_key: Literal["REPOSITORIES"] = Field(
        alias="sectionKey", default="REPOSITORIES"
    )
    trending_period: Literal["daily"] = Field(alias="trendingPeriod", default="daily")
    rank: int = Field(ge=1)
    programming_language: str | None = Field(alias="programmingLanguage", default=None)
    total_stars: int | None = Field(alias="totalStars", default=None, ge=0)
    total_forks: int | None = Field(alias="totalForks", default=None, ge=0)
    stars_today: int | None = Field(alias="starsToday", default=None, ge=0)
    built_by: list[str] = Field(alias="builtBy", default_factory=list)


class UrlsInfo(ContractModel):
    discovered_url: str = Field(alias="discoveredUrl")
    final_url: str | None = Field(alias="finalUrl", default=None)
    canonical_url: str | None = Field(alias="canonicalUrl", default=None)


class CrawlStatus(ContractModel):
    status: Literal["SUCCESS", "FAILED"]
    crawled_at: datetime = Field(alias="crawledAt")
    crawler_version: str = Field(alias="crawlerVersion", default="1.0.0")
    http_status_code: int | None = Field(alias="httpStatusCode", default=None)
    attempt: int = Field(default=1, ge=1)
    error: ErrorInfo | None = None

    @field_validator("crawled_at")
    @classmethod
    def require_utc_crawled_at(cls, value: datetime) -> datetime:
        return _require_utc(value, "crawledAt")


class RawArticle(ContractModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    published_at_raw: None = Field(alias="publishedAtRaw", default=None)
    description: str | None = None
    content_html: str | None = Field(alias="contentHtml", default=None)
    content_text: str | None = Field(alias="contentText", default=None)
    language_hint: str | None = Field(alias="languageHint", default=None)


class CrawlItemProduced(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    message_type: Literal["CrawlItemProduced"] = Field(
        alias="messageType", default="CrawlItemProduced"
    )
    crawl_run_id: str = Field(alias="crawlRunId")
    crawl_item_id: str = Field(alias="crawlItemId", min_length=1, max_length=160)
    source: SourceIdentity = Field(default_factory=SourceIdentity)
    discovery: DiscoveryInfo
    urls: UrlsInfo
    crawl: CrawlStatus
    raw_article: RawArticle | None = Field(alias="rawArticle", default=None)


class CrawlStatistics(ContractModel):
    pages_visited: int = Field(alias="pagesVisited", default=0, ge=0)
    articles_discovered: int = Field(alias="articlesDiscovered", default=0, ge=0)
    articles_excluded_by_age: int = Field(
        alias="articlesExcludedByAge", default=0, ge=0
    )
    articles_attempted: int = Field(alias="articlesAttempted", default=0, ge=0)
    articles_succeeded: int = Field(alias="articlesSucceeded", default=0, ge=0)
    articles_failed: int = Field(alias="articlesFailed", default=0, ge=0)


class CrawlRunCompleted(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    message_type: Literal["CrawlRunCompleted"] = Field(
        alias="messageType", default="CrawlRunCompleted"
    )
    crawl_run_id: str = Field(alias="crawlRunId")
    status: Literal["COMPLETED", "PARTIALLY_COMPLETED", "FAILED"]
    started_at: datetime = Field(alias="startedAt")
    completed_at: datetime = Field(alias="completedAt")
    statistics: CrawlStatistics
    error: ErrorInfo | None = None


class ArticlePayload(ContractModel):
    title: str = Field(min_length=1, max_length=1_000)
    authors: list[str] = Field(default_factory=list)
    original_published_at: datetime = Field(alias="originalPublishedAt")
    content: str = Field(min_length=1, max_length=5 * 1024 * 1024)
    language: str = Field(min_length=2, max_length=16)

    @field_validator("original_published_at")
    @classmethod
    def require_utc_original_published_at(cls, value: datetime) -> datetime:
        return _require_utc(value, "originalPublishedAt")


class NormalizationResult(ContractModel):
    status: Literal["SUCCESS", "FAILED"]
    normalized_at: datetime = Field(alias="normalizedAt")
    normalizer_version: str = Field(alias="normalizerVersion", default="1.0.0")
    warnings: list[str] = Field(default_factory=list)
    error: ErrorInfo | None = None


class ArticleNormalized(ContractModel):
    schema_version: Literal["1.0"] = Field(alias="schemaVersion", default="1.0")
    message_type: Literal["ArticleNormalized"] = Field(
        alias="messageType", default="ArticleNormalized"
    )
    crawl_run_id: str = Field(alias="crawlRunId")
    crawl_item_id: str = Field(alias="crawlItemId")
    source: SourceIdentity
    discovery: DiscoveryInfo
    urls: UrlsInfo
    article: ArticlePayload | None
    normalization: NormalizationResult


class GitHubTrendingPipelineResult(ContractModel):
    crawl_run_completed: CrawlRunCompleted = Field(alias="crawlRunCompleted")
    crawl_items: list[CrawlItemProduced] = Field(alias="crawlItems", default_factory=list)
    normalized_articles: list[ArticleNormalized] = Field(
        alias="normalizedArticles", default_factory=list
    )
