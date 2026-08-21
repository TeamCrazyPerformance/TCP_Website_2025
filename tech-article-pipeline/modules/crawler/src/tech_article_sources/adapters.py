from __future__ import annotations

import asyncio
import threading
from datetime import datetime
from typing import Any, Protocol

from github_trending_pipeline import (
    CrawlOptions as GitHubTrendingCrawlOptions,
)
from github_trending_pipeline import (
    CrawlRequest as GitHubTrendingCrawlRequest,
)
from github_trending_pipeline import (
    GitHubTrendingPipeline,
)
from github_trending_pipeline.http_client import GitHubTrendingHttpClient
from sdtimes_crawler.crawler import SDTimesCrawler
from sdtimes_crawler.models import (
    CrawlOptions as SDTimesCrawlOptions,
)
from sdtimes_crawler.models import (
    CrawlRequest as SDTimesCrawlRequest,
)
from sdtimes_crawler.models import (
    EntryPoint as SDTimesEntryPoint,
)
from sdtimes_crawler.models import (
    SourceInfo as SDTimesSourceInfo,
)
from sdtimes_crawler.normalizer import SDTimesNormalizer
from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.orchestrator import CloudflareIngestionOrchestrator
from tech_articles_ingestion.persistence.memory import InMemoryIngestionRepository
from technical_news_pipeline.contracts import (
    CrawlOptions as InfoQCrawlOptions,
)
from technical_news_pipeline.contracts import (
    CrawlRequest as InfoQCrawlRequest,
)
from technical_news_pipeline.contracts import (
    CrawlSource as InfoQCrawlSource,
)
from technical_news_pipeline.contracts import (
    EntryPoint as InfoQEntryPoint,
)
from technical_news_pipeline.contracts import (
    SourceType as InfoQSourceType,
)
from technical_news_pipeline.http_client import InfoQHttpClient
from technical_news_pipeline.infoq import InfoQCollector
from technical_news_pipeline.pipeline import InfoQPipeline
from technical_news_pipeline.storage import InMemoryRawCrawlRepository

from .models import CrawlBatch


class SourceAdapterError(RuntimeError):
    def __init__(self, code: str, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": str(self), "retryable": self.retryable}


class SourceAdapter(Protocol):
    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch: ...


def _options(request: dict[str, Any]) -> dict[str, Any]:
    return request["crawlOptions"]


def _source(request: dict[str, Any]) -> dict[str, Any]:
    return request["source"]


class CloudflareSourceAdapter:
    """Runs the original Cloudflare implementation with process-memory state."""

    def __init__(self, *, public_url: str | None, contact: str | None) -> None:
        self.public_url = public_url
        self.contact = contact
        self.repository = InMemoryIngestionRepository()

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch:
        source = _source(request)
        if source["sourceType"] != "RSS":
            raise SourceAdapterError(
                "SOURCE_TYPE_UNSUPPORTED",
                "cloudflare-blog supports only RSS collection.",
                retryable=False,
            )
        if not self.public_url or not self.contact:
            raise SourceAdapterError(
                "CRAWLER_IDENTITY_NOT_CONFIGURED",
                "CRAWLER_PUBLIC_URL and CRAWLER_CONTACT are required for Cloudflare crawling.",
                retryable=False,
            )
        options = _options(request)
        config = IngestionConfig(
            database_url="memory://pipeline",
            public_url=self.public_url,
            contact=self.contact,
            maximum_article_count=options["maximumArticleCount"],
            maximum_age_hours=options.get("maximumAgeHours") or 720,
            request_timeout_seconds=options["requestTimeoutMs"] / 1000,
        )
        result = asyncio.run(
            CloudflareIngestionOrchestrator(config, self.repository).run_once(
                requested_at=datetime.fromisoformat(request["requestedAt"].replace("Z", "+00:00")),
                crawl_run_id=crawl_run_id,
            )
        )
        return CrawlBatch(
            completion=result.crawl_run_completed,
            crawl_items=result.crawl_items_produced,
            normalized_articles=result.normalized_articles,
        )


class InfoQSourceAdapter:
    def __init__(self, *, user_agent: str | None = None) -> None:
        self.user_agent = user_agent

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch:
        source = _source(request)
        source_type = InfoQSourceType(source["sourceType"])
        if source_type not in {InfoQSourceType.RSS, InfoQSourceType.WEB_CRAWL}:
            raise SourceAdapterError(
                "SOURCE_TYPE_UNSUPPORTED",
                "infoq supports only RSS and WEB_CRAWL collection.",
                retryable=False,
            )
        section = source["sectionKey"]
        if section not in {"NEWS", "ENGINEERING"}:
            raise SourceAdapterError(
                "SOURCE_SECTION_UNSUPPORTED",
                "infoq sectionKey must be NEWS or ENGINEERING.",
                retryable=False,
            )
        feed = "news" if section == "NEWS" else "articles"
        path = f"/{feed}/"
        entry_url = (
            f"https://feed.infoq.com/{feed}/"
            if source_type is InfoQSourceType.RSS
            else f"https://www.infoq.com/{feed}/"
        )
        options = _options(request)
        native_request = InfoQCrawlRequest(
            crawl_run_id=crawl_run_id,
            requested_at=datetime.fromisoformat(request["requestedAt"].replace("Z", "+00:00")),
            source=InfoQCrawlSource(
                source_id="infoq",
                source_type=source_type,
                base_url="https://www.infoq.com",
                entry_point=InfoQEntryPoint(url=entry_url, path=path, section_key=section),
            ),
            crawl_options=InfoQCrawlOptions(
                maximum_article_count=options["maximumArticleCount"],
                maximum_age_hours=options.get("maximumAgeHours"),
                follow_pagination=options["followPagination"],
                maximum_page_count=options["maximumPageCount"],
                request_timeout_ms=options["requestTimeoutMs"],
            ),
        )
        http_options: dict[str, Any] = {
            "timeout_seconds": options["requestTimeoutMs"] / 1000
        }
        if self.user_agent:
            http_options["user_agent"] = self.user_agent
        pipeline = InfoQPipeline(
            collector=InfoQCollector(http=InfoQHttpClient(**http_options)),
            repository=InMemoryRawCrawlRepository(),
        )
        result = pipeline.run(native_request)
        return CrawlBatch(
            completion=result.crawl_run_completed.to_dict(),
            crawl_items=[item.to_dict() for item in result.crawl_items],
            normalized_articles=[item.to_dict() for item in result.normalized_articles],
        )


class SDTimesSourceAdapter:
    def __init__(
        self,
        *,
        crawler: SDTimesCrawler | None = None,
        normalizer: SDTimesNormalizer | None = None,
    ) -> None:
        self.crawler = crawler or SDTimesCrawler()
        self.normalizer = normalizer or SDTimesNormalizer()

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch:
        source = _source(request)
        if source["sectionKey"] != "NEWS":
            raise SourceAdapterError(
                "SOURCE_SECTION_UNSUPPORTED",
                "sdtimes supports only the NEWS section.",
                retryable=False,
            )
        source_type = source["sourceType"]
        entry_urls = {
            "WEB_CRAWL": "https://sdtimes.com/",
            "RSS": "https://sdtimes.com/feed/",
            "API": "https://sdtimes.com/wp-json/wp/v2/posts",
        }
        if source_type not in entry_urls:
            raise SourceAdapterError(
                "SOURCE_TYPE_UNSUPPORTED",
                "sdtimes supports WEB_CRAWL, RSS, and API collection.",
                retryable=False,
            )
        options = _options(request)
        native_request = SDTimesCrawlRequest(
            schemaVersion="1.0",
            crawlRunId=crawl_run_id,
            requestedAt=request["requestedAt"],
            source=SDTimesSourceInfo(
                sourceId="sdtimes",
                sourceType=source_type,
                baseUrl="https://sdtimes.com",
                entryPoint=SDTimesEntryPoint(
                    url=entry_urls[source_type],
                    path="/",
                    sectionKey="NEWS",
                ),
            ),
            crawlOptions=SDTimesCrawlOptions(**options),
        )
        crawl_items, completion = self.crawler.run_crawl(native_request)
        normalized = [
            self.normalizer.normalize(item)
            for item in crawl_items
            if item.crawl.status == "SUCCESS"
        ]
        return CrawlBatch(
            completion=completion.model_dump(mode="json"),
            crawl_items=[item.model_dump(mode="json") for item in crawl_items],
            normalized_articles=[item.model_dump(mode="json") for item in normalized],
        )


class GitHubTrendingSourceAdapter:
    def __init__(
        self,
        *,
        public_url: str | None,
        contact: str | None,
        pipeline: GitHubTrendingPipeline | None = None,
    ) -> None:
        self.public_url = public_url
        self.contact = contact
        self.pipeline = pipeline

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch:
        source = _source(request)
        if source["sourceType"] != "WEB_CRAWL":
            raise SourceAdapterError(
                "SOURCE_TYPE_UNSUPPORTED",
                "github-trending supports only WEB_CRAWL collection.",
                retryable=False,
            )
        if source["sectionKey"] != "REPOSITORIES":
            raise SourceAdapterError(
                "SOURCE_SECTION_UNSUPPORTED",
                "github-trending supports only the REPOSITORIES section.",
                retryable=False,
            )
        if not self.public_url or not self.contact:
            raise SourceAdapterError(
                "CRAWLER_IDENTITY_NOT_CONFIGURED",
                "CRAWLER_PUBLIC_URL and CRAWLER_CONTACT are required for GitHub crawling.",
                retryable=False,
            )

        options = _options(request)
        native_request = GitHubTrendingCrawlRequest(
            crawlRunId=crawl_run_id,
            requestedAt=request["requestedAt"],
            crawlOptions=GitHubTrendingCrawlOptions(
                maximumArticleCount=options["maximumArticleCount"],
                requestTimeoutMs=options["requestTimeoutMs"],
            ),
        )
        pipeline = self.pipeline
        http: GitHubTrendingHttpClient | None = None
        if pipeline is None:
            user_agent = (
                "TCP-Tech-Article-Pipeline/0.2 "
                f"(+{self.public_url}; contact={self.contact})"
            )
            http = GitHubTrendingHttpClient(
                user_agent=user_agent,
                timeout_seconds=options["requestTimeoutMs"] / 1000,
            )
            pipeline = GitHubTrendingPipeline(http=http)
        try:
            result = pipeline.run(native_request)
        finally:
            if http is not None:
                http.close()
        return CrawlBatch(
            completion=result.crawl_run_completed.model_dump(
                by_alias=True, mode="json"
            ),
            crawl_items=[
                item.model_dump(by_alias=True, mode="json")
                for item in result.crawl_items
            ],
            normalized_articles=[
                item.model_dump(by_alias=True, mode="json")
                for item in result.normalized_articles
            ],
        )


class SourceAdapterRegistry:
    def __init__(self, adapters: dict[str, SourceAdapter]) -> None:
        self._adapters = dict(adapters)
        self._source_locks = {source_id: threading.Lock() for source_id in adapters}

    @classmethod
    def default(
        cls, *, public_url: str | None = None, contact: str | None = None
    ) -> SourceAdapterRegistry:
        user_agent = "TCP-Tech-Article-Pipeline/0.2"
        if public_url and contact:
            user_agent = f"TCP-Tech-Article-Pipeline/0.2 (+{public_url}; contact={contact})"
        return cls(
            {
                "cloudflare-blog": CloudflareSourceAdapter(
                    public_url=public_url, contact=contact
                ),
                "infoq": InfoQSourceAdapter(user_agent=user_agent),
                "sdtimes": SDTimesSourceAdapter(
                    crawler=SDTimesCrawler(user_agent=user_agent)
                ),
                "github-trending": GitHubTrendingSourceAdapter(
                    public_url=public_url,
                    contact=contact,
                ),
            }
        )

    @property
    def source_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._adapters))

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch:
        source_id = request["source"]["sourceId"]
        try:
            adapter = self._adapters[source_id]
        except KeyError as exc:
            raise SourceAdapterError(
                "SOURCE_NOT_REGISTERED",
                f"No crawler is registered for sourceId {source_id!r}.",
                retryable=False,
            ) from exc
        with self._source_locks[source_id]:
            return adapter.run(crawl_run_id, request)
