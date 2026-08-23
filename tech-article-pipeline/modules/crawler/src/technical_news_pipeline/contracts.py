from __future__ import annotations

from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from urllib.parse import urlparse


SCHEMA_VERSION = "1.0"


class ContractValidationError(ValueError):
    """Raised when a value violates the pipeline data contract."""


class SourceType(str, Enum):
    WEB_CRAWL = "WEB_CRAWL"
    RSS = "RSS"
    API = "API"


class ExecutionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    SKIPPED = "SKIPPED"


class CrawlRunStatus(str, Enum):
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    if value.tzinfo is None:
        raise ContractValidationError("datetime values must include a timezone")
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


def contract_dict(value: Any) -> Any:
    """Convert contract dataclasses to the camelCase JSON representation."""
    if is_dataclass(value):
        return {_camel(key): contract_dict(item) for key, item in asdict(value).items()}
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return iso_utc(value)
    if isinstance(value, dict):
        return {
            _camel(key) if isinstance(key, str) else key: contract_dict(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [contract_dict(item) for item in value]
    return value


def _require_https_url(value: str, field_name: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ContractValidationError(f"{field_name} must be an absolute HTTPS URL")


def _require_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ContractValidationError(f"{field_name} must be an integer")
    return value


def _require_bool(value: Any, field_name: str) -> bool:
    if not isinstance(value, bool):
        raise ContractValidationError(f"{field_name} must be a boolean")
    return value


@dataclass(slots=True)
class ErrorInfo:
    code: str
    message: str
    retryable: bool
    details: dict[str, Any] | None = None


@dataclass(slots=True)
class EntryPoint:
    url: str
    path: str
    section_key: str

    def __post_init__(self) -> None:
        _require_https_url(self.url, "source.entryPoint.url")
        if not self.path.startswith("/"):
            raise ContractValidationError("source.entryPoint.path must start with '/'")
        if not self.section_key:
            raise ContractValidationError("source.entryPoint.sectionKey is required")


@dataclass(slots=True)
class CrawlSource:
    source_id: str
    source_type: SourceType
    base_url: str
    entry_point: EntryPoint

    def __post_init__(self) -> None:
        _require_https_url(self.base_url, "source.baseUrl")
        if not self.source_id:
            raise ContractValidationError("source.sourceId is required")
        if not isinstance(self.source_type, SourceType):
            raise ContractValidationError("source.sourceType must be a supported SourceType")


@dataclass(slots=True)
class CrawlOptions:
    maximum_article_count: int
    maximum_age_hours: int | None = None
    follow_pagination: bool = False
    maximum_page_count: int = 1
    request_timeout_ms: int = 15_000

    def __post_init__(self) -> None:
        _require_int(self.maximum_article_count, "maximumArticleCount")
        if self.maximum_article_count < 1:
            raise ContractValidationError("maximumArticleCount must be at least 1")
        _require_bool(self.follow_pagination, "followPagination")
        if self.maximum_age_hours is not None:
            _require_int(self.maximum_age_hours, "maximumAgeHours")
            if self.maximum_age_hours < 1:
                raise ContractValidationError("maximumAgeHours must be null or at least 1")
        _require_int(self.maximum_page_count, "maximumPageCount")
        if self.maximum_page_count < 1:
            raise ContractValidationError("maximumPageCount must be at least 1")
        _require_int(self.request_timeout_ms, "requestTimeoutMs")
        if not 1_000 <= self.request_timeout_ms <= 60_000:
            raise ContractValidationError("requestTimeoutMs must be between 1000 and 60000")


@dataclass(slots=True)
class CrawlRequest:
    crawl_run_id: str
    requested_at: datetime
    source: CrawlSource
    crawl_options: CrawlOptions
    schema_version: str = SCHEMA_VERSION
    message_type: str = "CrawlRequested"

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ContractValidationError(f"unsupported schemaVersion: {self.schema_version}")
        if self.message_type != "CrawlRequested":
            raise ContractValidationError("messageType must be CrawlRequested")
        if not self.crawl_run_id:
            raise ContractValidationError("crawlRunId is required")
        if not isinstance(self.requested_at, datetime):
            raise ContractValidationError("requestedAt must be an ISO 8601 datetime")
        iso_utc(self.requested_at)

    def to_dict(self) -> dict[str, Any]:
        return contract_dict(self)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "CrawlRequest":
        try:
            requested_at = datetime.fromisoformat(payload["requestedAt"].replace("Z", "+00:00"))
            source = payload["source"]
            entry_point = source["entryPoint"]
            options = payload["crawlOptions"]
            return cls(
                schema_version=payload["schemaVersion"],
                message_type=payload.get("messageType", "CrawlRequested"),
                crawl_run_id=payload["crawlRunId"],
                requested_at=requested_at,
                source=CrawlSource(
                    source_id=source["sourceId"],
                    source_type=SourceType(source["sourceType"]),
                    base_url=source["baseUrl"],
                    entry_point=EntryPoint(
                        url=entry_point["url"],
                        path=entry_point["path"],
                        section_key=entry_point["sectionKey"],
                    ),
                ),
                crawl_options=CrawlOptions(
                    maximum_article_count=options["maximumArticleCount"],
                    maximum_age_hours=options.get("maximumAgeHours"),
                    follow_pagination=options["followPagination"],
                    maximum_page_count=options.get("maximumPageCount", 1),
                    request_timeout_ms=options.get("requestTimeoutMs", 15_000),
                ),
            )
        except (AttributeError, KeyError, TypeError, ValueError) as exc:
            raise ContractValidationError(f"invalid CrawlRequest: {exc}") from exc


@dataclass(slots=True)
class SourceIdentity:
    source_id: str
    source_type: SourceType


@dataclass(slots=True)
class Discovery:
    entry_point_url: str
    discovered_from_url: str
    source_path: str
    section_key: str


@dataclass(slots=True)
class ArticleUrls:
    discovered_url: str
    final_url: str | None
    canonical_url: str | None


@dataclass(slots=True)
class CrawlExecution:
    status: ExecutionStatus
    crawled_at: datetime
    crawler_version: str
    http_status_code: int | None
    attempt: int
    error: ErrorInfo | None


@dataclass(slots=True)
class RawArticle:
    title: str | None
    authors: list[str]
    published_at_raw: str | None
    content_html: str | None
    content_text: str | None
    language_hint: str | None


@dataclass(slots=True)
class NormalizationOptions:
    default_time_zone: str = "UTC"
    remove_boilerplate: bool = True
    normalize_whitespace: bool = True
    resolve_canonical_url: bool = True
    detect_language: bool = True

    def __post_init__(self) -> None:
        _require_bool(self.remove_boilerplate, "removeBoilerplate")
        _require_bool(self.normalize_whitespace, "normalizeWhitespace")
        _require_bool(self.resolve_canonical_url, "resolveCanonicalUrl")
        _require_bool(self.detect_language, "detectLanguage")
        if not self.normalize_whitespace:
            raise ContractValidationError("normalizeWhitespace must be true for the shared pipeline")
        if not self.resolve_canonical_url:
            raise ContractValidationError("resolveCanonicalUrl must be true for the shared pipeline")
        if self.default_time_zone != "UTC":
            try:
                from zoneinfo import ZoneInfo

                ZoneInfo(self.default_time_zone)
            except Exception as exc:
                raise ContractValidationError("defaultTimeZone must be UTC or a valid IANA timezone") from exc


@dataclass(slots=True)
class CrawlItemProduced:
    crawl_run_id: str
    crawl_item_id: str
    source: SourceIdentity
    discovery: Discovery
    urls: ArticleUrls
    crawl: CrawlExecution
    raw_article: RawArticle | None
    schema_version: str = SCHEMA_VERSION
    message_type: str = "CrawlItemProduced"

    def to_dict(self) -> dict[str, Any]:
        return contract_dict(self)


@dataclass(slots=True)
class CrawlStatistics:
    pages_visited: int = 0
    articles_discovered: int = 0
    articles_excluded_by_age: int = 0
    articles_attempted: int = 0
    articles_succeeded: int = 0
    articles_failed: int = 0


@dataclass(slots=True)
class CrawlRunCompleted:
    crawl_run_id: str
    status: CrawlRunStatus
    started_at: datetime
    completed_at: datetime
    statistics: CrawlStatistics
    schema_version: str = SCHEMA_VERSION
    message_type: str = "CrawlRunCompleted"

    def to_dict(self) -> dict[str, Any]:
        return contract_dict(self)


@dataclass(slots=True)
class NormalizedArticle:
    title: str
    authors: list[str]
    original_published_at: datetime | None
    content: str
    language: str


@dataclass(slots=True)
class NormalizationExecution:
    status: ExecutionStatus
    normalized_at: datetime
    normalizer_version: str
    warnings: list[str]
    error: ErrorInfo | None


@dataclass(slots=True)
class ArticleNormalized:
    crawl_run_id: str
    crawl_item_id: str
    source: SourceIdentity
    discovery: Discovery
    urls: ArticleUrls
    article: NormalizedArticle | None
    normalization: NormalizationExecution
    schema_version: str = SCHEMA_VERSION
    message_type: str = "ArticleNormalized"

    def to_dict(self) -> dict[str, Any]:
        return contract_dict(self)
