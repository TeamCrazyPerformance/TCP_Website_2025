from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from .contracts import (
    ArticleUrls,
    CrawlExecution,
    CrawlItemProduced,
    CrawlRequest,
    CrawlRunCompleted,
    CrawlRunStatus,
    CrawlStatistics,
    Discovery,
    ErrorInfo,
    ExecutionStatus,
    RawArticle,
    SourceIdentity,
    SourceType,
    utc_now,
)
from .http_client import FetchError, InfoQHttpClient
from .ids import crawl_item_id
from .normalizer import _parse_published_at
from .parsers import (
    FeedCandidate,
    ParseError,
    parse_infoq_feed,
    parse_infoq_listing,
    parse_infoq_page,
)
from .urls import expected_article_path, validate_infoq_feed_url, validate_infoq_listing_url


CRAWLER_VERSION = "1.0.0"


@dataclass(slots=True)
class CollectionResult:
    items: list[CrawlItemProduced]
    completed: CrawlRunCompleted


class InfoQCollector:
    def __init__(self, http: InfoQHttpClient | None = None, now=utc_now) -> None:  # noqa: ANN001
        self.http = http or InfoQHttpClient()
        self.now = now
        self._run_lock = threading.Lock()

    def collect(self, request: CrawlRequest) -> CollectionResult:
        self.validate_request(request)
        if not self._run_lock.acquire(blocking=False):
            now = self.now()
            return CollectionResult(
                items=[],
                completed=CrawlRunCompleted(
                    crawl_run_id=request.crawl_run_id,
                    status=CrawlRunStatus.FAILED,
                    started_at=now,
                    completed_at=now,
                    statistics=CrawlStatistics(),
                ),
            )
        started_at = self.now()
        try:
            if isinstance(self.http, InfoQHttpClient):
                self.http.timeout_seconds = request.crawl_options.request_timeout_ms / 1000
            return self._collect_locked(request, started_at)
        finally:
            self._run_lock.release()

    def _collect_locked(self, request: CrawlRequest, started_at: datetime) -> CollectionResult:
        statistics = CrawlStatistics()
        discovery_partially_failed = False
        try:
            if request.source.source_type is SourceType.RSS:
                feed_url = self._feed_url(request.source.entry_point.url, request.source.entry_point.path)
                feed_response = self.http.fetch_feed(feed_url)
                statistics.pages_visited = 1
                candidates = parse_infoq_feed(feed_response.body, feed_url)
            elif request.source.source_type is SourceType.WEB_CRAWL:
                candidates, discovery_partially_failed = self._crawl_listing_candidates(request, statistics)
            else:
                raise ValueError("InfoQCollector does not implement sourceType API")
        except (FetchError, ParseError) as exc:
            completed = CrawlRunCompleted(
                crawl_run_id=request.crawl_run_id,
                status=CrawlRunStatus.FAILED,
                started_at=started_at,
                completed_at=self.now(),
                statistics=statistics,
            )
            return CollectionResult(items=[], completed=completed)

        statistics.articles_discovered = len(candidates)
        candidates = self._filter_by_age(candidates, request, statistics)
        candidates = candidates[: request.crawl_options.maximum_article_count]
        robots, robots_error = self._load_robots()

        items: list[CrawlItemProduced] = []
        for index, candidate in enumerate(candidates, start=1):
            item_id = crawl_item_id(request.crawl_run_id, index)
            if robots_error is not None:
                item = self._failed_item(
                    request,
                    candidate,
                    item_id,
                    error=robots_error,
                    attempt=1,
                    status_code=None,
                    final_url=None,
                )
            elif robots is not None and not robots.can_fetch(self.http.user_agent, candidate.discovered_url):
                item = self._failed_item(
                    request,
                    candidate,
                    item_id,
                    error=ErrorInfo(
                        code="ROBOTS_DISALLOWED",
                        message="robots.txt does not allow this article URL.",
                        retryable=False,
                    ),
                    attempt=1,
                    status_code=None,
                    final_url=None,
                )
            else:
                item = self._crawl_candidate(request, candidate, item_id)
            if self._item_excluded_by_age(item, request):
                statistics.articles_excluded_by_age += 1
                continue
            statistics.articles_attempted += 1
            items.append(item)
            if item.crawl.status is ExecutionStatus.SUCCESS:
                statistics.articles_succeeded += 1
            else:
                statistics.articles_failed += 1

        if statistics.articles_failed == 0:
            status = (
                CrawlRunStatus.PARTIALLY_COMPLETED
                if request.source.source_type is SourceType.WEB_CRAWL and discovery_partially_failed
                else CrawlRunStatus.COMPLETED
            )
        elif statistics.articles_succeeded > 0:
            status = CrawlRunStatus.PARTIALLY_COMPLETED
        else:
            status = CrawlRunStatus.FAILED
        return CollectionResult(
            items=items,
            completed=CrawlRunCompleted(
                crawl_run_id=request.crawl_run_id,
                status=status,
                started_at=started_at,
                completed_at=self.now(),
                statistics=statistics,
            ),
        )

    def _crawl_candidate(
        self,
        request: CrawlRequest,
        candidate: FeedCandidate,
        item_id: str,
    ) -> CrawlItemProduced:
        response = None
        try:
            response = self.http.fetch_article(candidate.discovered_url)
            page = parse_infoq_page(response.body, response.final_url)
            raw = RawArticle(
                title=page.title or candidate.title,
                authors=page.authors or candidate.authors,
                published_at_raw=page.published_at_raw or candidate.published_at_raw,
                content_html=page.content_html,
                content_text=page.content_text,
                language_hint=page.language_hint,
            )
            return CrawlItemProduced(
                crawl_run_id=request.crawl_run_id,
                crawl_item_id=item_id,
                source=self._source(request),
                discovery=self._discovery(request, candidate),
                urls=ArticleUrls(
                    discovered_url=candidate.discovered_url,
                    final_url=response.final_url,
                    canonical_url=page.canonical_url,
                ),
                crawl=CrawlExecution(
                    status=ExecutionStatus.SUCCESS,
                    crawled_at=self.now(),
                    crawler_version=CRAWLER_VERSION,
                    http_status_code=response.status_code,
                    attempt=response.attempt,
                    error=None,
                ),
                raw_article=raw,
            )
        except FetchError as exc:
            return self._failed_item(
                request,
                candidate,
                item_id,
                error=ErrorInfo(
                    code=exc.code,
                    message=str(exc),
                    retryable=exc.retryable,
                    details=exc.details,
                ),
                attempt=exc.attempt,
                status_code=exc.status_code,
                final_url=exc.final_url,
            )
        except ParseError as exc:
            return self._failed_item(
                request,
                candidate,
                item_id,
                error=ErrorInfo(
                    code=exc.code,
                    message=str(exc),
                    retryable=False,
                    details=exc.details,
                ),
                attempt=response.attempt if response is not None else 1,
                status_code=response.status_code if response is not None else None,
                final_url=response.final_url if response is not None else None,
            )
        except Exception as exc:  # Keep one malformed article from stopping the remaining run.
            return self._failed_item(
                request,
                candidate,
                item_id,
                error=ErrorInfo(
                    code="UNEXPECTED_CRAWL_ERROR",
                    message=f"Unexpected article processing failure: {exc}",
                    retryable=False,
                    details={"exceptionType": type(exc).__name__},
                ),
                attempt=1,
                status_code=None,
                final_url=None,
            )

    def _failed_item(
        self,
        request: CrawlRequest,
        candidate: FeedCandidate,
        item_id: str,
        *,
        error: ErrorInfo,
        attempt: int,
        status_code: int | None,
        final_url: str | None,
    ) -> CrawlItemProduced:
        return CrawlItemProduced(
            crawl_run_id=request.crawl_run_id,
            crawl_item_id=item_id,
            source=self._source(request),
            discovery=self._discovery(request, candidate),
            urls=ArticleUrls(
                discovered_url=candidate.discovered_url,
                final_url=final_url,
                canonical_url=None,
            ),
            crawl=CrawlExecution(
                status=ExecutionStatus.FAILED,
                crawled_at=self.now(),
                crawler_version=CRAWLER_VERSION,
                http_status_code=status_code,
                attempt=attempt,
                error=error,
            ),
            raw_article=None,
        )

    def _load_robots(self) -> tuple[RobotFileParser | None, ErrorInfo | None]:
        try:
            result = self.http.fetch_robots("https://www.infoq.com/robots.txt")
            parser = RobotFileParser("https://www.infoq.com/robots.txt")
            parser.parse(result.body.splitlines())
            return parser, None
        except FetchError as exc:
            return None, ErrorInfo(
                code="ROBOTS_POLICY_UNAVAILABLE",
                message=f"Could not load InfoQ robots.txt: {exc}",
                retryable=exc.retryable,
                details=exc.details,
            )

    def _filter_by_age(
        self,
        candidates: list[FeedCandidate],
        request: CrawlRequest,
        statistics: CrawlStatistics,
    ) -> list[FeedCandidate]:
        maximum_age = request.crawl_options.maximum_age_hours
        if maximum_age is None:
            return candidates
        kept: list[FeedCandidate] = []
        now = self.now().astimezone(timezone.utc)
        for candidate in candidates:
            published_at, _ = _parse_published_at(candidate.published_at_raw, "UTC")
            if published_at is not None and (now - published_at).total_seconds() > maximum_age * 3600:
                statistics.articles_excluded_by_age += 1
            else:
                kept.append(candidate)
        return kept

    def _item_excluded_by_age(self, item: CrawlItemProduced, request: CrawlRequest) -> bool:
        maximum_age = request.crawl_options.maximum_age_hours
        if maximum_age is None or item.raw_article is None:
            return False
        published_at, _ = _parse_published_at(item.raw_article.published_at_raw, "UTC")
        if published_at is None:
            return False
        age_seconds = (self.now().astimezone(timezone.utc) - published_at).total_seconds()
        return age_seconds > maximum_age * 3600

    @staticmethod
    def _feed_url(entry_point_url: str, source_path: str) -> str:
        feed_url = validate_infoq_feed_url(entry_point_url)
        if expected_article_path(feed_url) != source_path:
            raise ValueError("InfoQ feed URL and sourcePath do not match")
        return feed_url

    def _crawl_listing_candidates(
        self,
        request: CrawlRequest,
        statistics: CrawlStatistics,
    ) -> tuple[list[FeedCandidate], bool]:
        source_path = request.source.entry_point.path
        maximum_pages = request.crawl_options.maximum_page_count
        if not request.crawl_options.follow_pagination:
            maximum_pages = 1
        candidates: list[FeedCandidate] = []
        seen: set[str] = set()
        partially_failed = False
        for page in range(1, maximum_pages + 1):
            listing_url = (
                request.source.entry_point.url
                if page == 1
                else f"https://www.infoq.com{source_path}{page}/"
            )
            listing_url = validate_infoq_listing_url(listing_url, expected_path=source_path)
            try:
                response = self.http.fetch_listing(listing_url, source_path)
            except FetchError:
                if not candidates:
                    raise
                partially_failed = True
                break
            statistics.pages_visited += 1
            page_candidates = parse_infoq_listing(response.body, response.final_url, source_path)
            new_candidates = [candidate for candidate in page_candidates if candidate.discovered_url not in seen]
            if not new_candidates:
                break
            for candidate in new_candidates:
                seen.add(candidate.discovered_url)
                candidates.append(candidate)
            if len(candidates) >= request.crawl_options.maximum_article_count:
                break
        return candidates, partially_failed

    @staticmethod
    def validate_request(request: CrawlRequest) -> None:
        if request.source.source_id != "infoq":
            raise ValueError("InfoQCollector only accepts sourceId 'infoq'")
        if urlparse(request.source.base_url).hostname != "www.infoq.com":
            raise ValueError("InfoQ baseUrl must use www.infoq.com")
        source_path = request.source.entry_point.path
        if source_path not in {"/news/", "/articles/"}:
            raise ValueError("InfoQ sourcePath must be /news/ or /articles/")
        if request.source.source_type is SourceType.RSS:
            InfoQCollector._feed_url(request.source.entry_point.url, source_path)
        elif request.source.source_type is SourceType.WEB_CRAWL:
            validate_infoq_listing_url(request.source.entry_point.url, expected_path=source_path)
        else:
            raise ValueError("InfoQCollector supports only RSS and WEB_CRAWL")

    @staticmethod
    def _source(request: CrawlRequest) -> SourceIdentity:
        return SourceIdentity(
            source_id=request.source.source_id,
            source_type=request.source.source_type,
        )

    @staticmethod
    def _discovery(request: CrawlRequest, candidate: FeedCandidate) -> Discovery:
        return Discovery(
            entry_point_url=request.source.entry_point.url,
            discovered_from_url=candidate.discovered_from_url,
            source_path=request.source.entry_point.path,
            section_key=request.source.entry_point.section_key,
        )
