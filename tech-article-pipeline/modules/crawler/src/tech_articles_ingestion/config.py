from __future__ import annotations

import os
import re
from dataclasses import dataclass
from urllib.parse import quote, urlsplit

_SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


@dataclass(frozen=True, slots=True)
class IngestionConfig:
    database_url: str
    public_url: str
    contact: str
    crawler_version: str = "1.0.0"
    normalizer_version: str = "1.0.0"
    rss_url: str = "https://blog.cloudflare.com/rss/"
    source_id: str = "cloudflare-blog"
    source_type: str = "RSS"
    section_key: str = "BLOG"
    request_timeout_seconds: float = 10.0
    maximum_response_bytes: int = 5 * 1024 * 1024
    maximum_article_count: int = 100
    maximum_age_hours: int = 720
    maximum_redirects: int = 3
    maximum_xml_depth: int = 64
    maximum_xml_nodes: int = 50_000
    maximum_xml_field_length: int = 5 * 1024 * 1024
    language_confidence_threshold: float = 0.70
    content_short_threshold: int = 200
    scheduled_interval_seconds: int = 6 * 60 * 60
    output_path: str | None = None

    @property
    def user_agent(self) -> str:
        return (
            f"TCPTechNews-AI-Summarizer/{self.crawler_version} "
            f"(+{self.public_url}; contact={self.contact})"
        )

    @classmethod
    def from_env(cls) -> IngestionConfig:
        config = cls(
            database_url=_database_url_from_env() or "memory://pipeline",
            public_url=os.environ.get("CRAWLER_PUBLIC_URL", ""),
            contact=os.environ.get("CRAWLER_CONTACT", ""),
            crawler_version=os.environ.get("CRAWLER_VERSION", "1.0.0"),
            normalizer_version=os.environ.get("NORMALIZER_VERSION", "1.0.0"),
            request_timeout_seconds=float(os.environ.get("CRAWL_REQUEST_TIMEOUT_SECONDS", "10")),
            maximum_article_count=int(os.environ.get("CRAWL_MAX_ARTICLES", "100")),
            maximum_age_hours=int(os.environ.get("CRAWL_MAX_AGE_HOURS", "720")),
            output_path=os.environ.get("CRAWL_OUTPUT_PATH") or None,
        )
        config.validate()
        return config

    def validate(self) -> None:
        if not self.database_url:
            raise ValueError("DATABASE_URL must be configured")
        if not self.public_url or "{" in self.public_url:
            raise ValueError("CRAWLER_PUBLIC_URL must be an actual public service URL")
        parsed_public_url = urlsplit(self.public_url)
        if parsed_public_url.scheme != "https" or not parsed_public_url.hostname:
            raise ValueError("CRAWLER_PUBLIC_URL must be an absolute HTTPS URL")
        if not self.contact or "{" in self.contact or "@" not in self.contact:
            raise ValueError("CRAWLER_CONTACT must be an operational email address")
        if not _SEMVER.fullmatch(self.crawler_version):
            raise ValueError("CRAWLER_VERSION must be valid SemVer")
        if not _SEMVER.fullmatch(self.normalizer_version):
            raise ValueError("NORMALIZER_VERSION must be valid SemVer")
        if self.maximum_article_count < 1 or self.maximum_article_count > 100:
            raise ValueError("CRAWL_MAX_ARTICLES must be between 1 and 100")
        if self.maximum_age_hours < 1:
            raise ValueError("CRAWL_MAX_AGE_HOURS must be positive")
        if not 0.0 <= self.language_confidence_threshold <= 1.0:
            raise ValueError("language confidence threshold must be between 0 and 1")


def _database_url_from_env() -> str:
    explicit = os.environ.get("DATABASE_URL")
    if explicit:
        return explicit
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    database = os.environ.get("DB_NAME")
    if not user or password is None or not database:
        return ""
    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", "5432")
    return (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{quote(database, safe='')}"
    )
