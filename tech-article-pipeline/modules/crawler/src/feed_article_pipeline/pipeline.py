from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from technical_news_pipeline.contracts import (
    ArticleUrls,
    CrawlExecution,
    CrawlItemProduced,
    CrawlRunCompleted,
    CrawlRunStatus,
    CrawlStatistics,
    Discovery,
    ErrorInfo,
    ExecutionStatus,
    RawArticle,
    SourceIdentity,
    SourceType,
)
from technical_news_pipeline.normalizer import ArticleNormalizer

from .extractor import ArticleExtractionError, extract_article
from .http_client import FeedFetchError, FeedHttpClient
from .parser import FeedEntry, FeedParseError, parse_feed
from .profiles import FeedContentMode, FeedSourceProfile

CRAWLER_VERSION = "feed-article-crawler-1.0.0"


@dataclass(frozen=True, slots=True)
class FeedPipelineResult:
    crawl_run_completed: dict
    crawl_items: list[dict]
    normalized_articles: list[dict]


class FeedArticlePipeline:
    def __init__(
        self,
        profile: FeedSourceProfile,
        http: FeedHttpClient,
        *,
        now=lambda: datetime.now(UTC),  # noqa: B008
    ) -> None:
        self.profile = profile
        self.http = http
        self.now = now
        self.normalizer = ArticleNormalizer(now=now)

    def run(self, crawl_run_id: str, request: dict) -> FeedPipelineResult:
        self._validate_request(request)
        started_at = self.now()
        reference_time = datetime.fromisoformat(
            request["requestedAt"].replace("Z", "+00:00")
        ).astimezone(UTC)
        options = request["crawlOptions"]
        maximum_age_hours = options.get("maximumAgeHours")

        robots = self._robots_policies()
        self._assert_robots_allowed(robots, self.profile.feed_url)
        feed_result = self.http.fetch_feed(
            redirect_guard=lambda url: self._assert_robots_allowed(robots, url)
        )
        try:
            entries = parse_feed(feed_result.body, self.profile.allowed_hosts)
        except FeedParseError as exc:
            raise FeedFetchError(
                "FEED_PARSE_FAILED", str(exc), retryable=False, final_url=feed_result.final_url
            ) from exc

        eligible, excluded_by_age = self._eligible_entries(
            entries, reference_time, maximum_age_hours
        )
        selected = eligible[: options["maximumArticleCount"]]
        items: list[dict] = []
        normalized: list[dict] = []
        succeeded = 0
        failed = 0
        article_pages_visited = 0

        for entry in selected:
            item_id = self._item_id(crawl_run_id, entry.url)
            try:
                item, visited_article = self._crawl_entry(
                    crawl_run_id,
                    item_id,
                    entry,
                    feed_result.final_url,
                    robots,
                )
                article_pages_visited += int(visited_article)
                succeeded += 1
                normalized_item = self.normalizer.normalize(item).to_dict()
                normalized.append(normalized_item)
            except (FeedFetchError, ArticleExtractionError) as exc:
                failed += 1
                article_pages_visited += int(
                    self.profile.content_mode is FeedContentMode.ARTICLE_PAGE
                )
                item = self._failed_item(crawl_run_id, item_id, entry, feed_result.final_url, exc)
            items.append(item.to_dict())

        status = CrawlRunStatus.COMPLETED
        if failed and succeeded:
            status = CrawlRunStatus.PARTIALLY_COMPLETED
        elif failed and not succeeded:
            status = CrawlRunStatus.FAILED
        completion = CrawlRunCompleted(
            crawl_run_id=crawl_run_id,
            status=status,
            started_at=started_at,
            completed_at=self.now(),
            statistics=CrawlStatistics(
                pages_visited=1 + article_pages_visited,
                articles_discovered=len(entries),
                articles_excluded_by_age=excluded_by_age,
                articles_attempted=len(selected),
                articles_succeeded=succeeded,
                articles_failed=failed,
            ),
        )
        return FeedPipelineResult(
            crawl_run_completed=completion.to_dict(),
            crawl_items=items,
            normalized_articles=normalized,
        )

    def _robots_policies(self) -> dict[str, RobotFileParser]:
        policies: dict[str, RobotFileParser] = {}
        for robots_url in self.profile.robots_urls:
            host = (urlsplit(robots_url).hostname or "").lower()
            parser = RobotFileParser(robots_url)
            try:
                result = self.http.fetch_robots(robots_url)
            except FeedFetchError as exc:
                if exc.status_code != 404:
                    raise
                parser.parse([])
            else:
                parser.parse(result.body.decode("utf-8", errors="replace").splitlines())
            policies[host] = parser
        return policies

    def _assert_robots_allowed(
        self, policies: dict[str, RobotFileParser], url: str
    ) -> None:
        host = (urlsplit(url).hostname or "").lower()
        parser = policies.get(host)
        if parser is None:
            raise FeedFetchError(
                "ROBOTS_POLICY_MISSING",
                "No robots.txt policy is configured for the target host.",
                retryable=False,
                final_url=url,
            )
        if not parser.can_fetch(self.http.user_agent, url):
            raise FeedFetchError(
                "ROBOTS_DISALLOWED",
                "robots.txt does not allow fetching the target URL.",
                retryable=False,
                final_url=url,
            )

    def _crawl_entry(
        self,
        crawl_run_id: str,
        item_id: str,
        entry: FeedEntry,
        discovered_from_url: str,
        robots: dict[str, RobotFileParser],
    ) -> tuple[CrawlItemProduced, bool]:
        final_url = entry.url
        canonical_url = entry.url
        title = entry.title
        authors = list(entry.authors)
        published_at_raw = entry.published_at_raw
        content_html: str | None
        content_text: str | None = None
        status_code = 200
        attempt = 1
        visited_article = False

        if self.profile.content_mode is FeedContentMode.ARTICLE_PAGE:
            self._assert_robots_allowed(robots, entry.url)
            visited_article = True
            response = self.http.fetch_article(
                entry.url,
                redirect_guard=lambda url: self._assert_robots_allowed(robots, url),
            )
            extracted = extract_article(response.body, response.final_url, self.profile)
            final_url = response.final_url
            canonical_url = extracted.canonical_url
            title = extracted.title or title
            authors = list(dict.fromkeys([*authors, *extracted.authors]))
            published_at_raw = extracted.published_at_raw or published_at_raw
            content_html = extracted.content_html
            status_code = response.status_code
            attempt = response.attempt
        else:
            content_html = entry.content_html or entry.summary_html

        if not content_html or not content_html.strip():
            raise ArticleExtractionError("The feed entry did not contain usable content.")
        return (
            CrawlItemProduced(
                crawl_run_id=crawl_run_id,
                crawl_item_id=item_id,
                source=SourceIdentity(
                    source_id=self.profile.source_id,
                    source_type=SourceType.RSS,
                ),
                discovery=Discovery(
                    entry_point_url=self.profile.feed_url,
                    discovered_from_url=discovered_from_url,
                    source_path=self.profile.source_path,
                    section_key=self.profile.section_key,
                ),
                urls=ArticleUrls(
                    discovered_url=entry.url,
                    final_url=final_url,
                    canonical_url=canonical_url,
                ),
                crawl=CrawlExecution(
                    status=ExecutionStatus.SUCCESS,
                    crawled_at=self.now(),
                    crawler_version=CRAWLER_VERSION,
                    http_status_code=status_code,
                    attempt=attempt,
                    error=None,
                ),
                raw_article=RawArticle(
                    title=title,
                    authors=authors,
                    published_at_raw=published_at_raw,
                    content_html=content_html,
                    content_text=content_text,
                    language_hint=self.profile.language_hint,
                ),
            ),
            visited_article,
        )

    def _failed_item(
        self,
        crawl_run_id: str,
        item_id: str,
        entry: FeedEntry,
        discovered_from_url: str,
        exc: FeedFetchError | ArticleExtractionError,
    ) -> CrawlItemProduced:
        if isinstance(exc, FeedFetchError):
            error = ErrorInfo(
                code=exc.code,
                message=str(exc),
                retryable=exc.retryable,
            )
            final_url = exc.final_url
            status_code = exc.status_code
            attempt = exc.attempt
        else:
            error = ErrorInfo(
                code="ARTICLE_BODY_NOT_FOUND",
                message=str(exc),
                retryable=False,
            )
            final_url = entry.url
            status_code = 200
            attempt = 1
        return CrawlItemProduced(
            crawl_run_id=crawl_run_id,
            crawl_item_id=item_id,
            source=SourceIdentity(source_id=self.profile.source_id, source_type=SourceType.RSS),
            discovery=Discovery(
                entry_point_url=self.profile.feed_url,
                discovered_from_url=discovered_from_url,
                source_path=self.profile.source_path,
                section_key=self.profile.section_key,
            ),
            urls=ArticleUrls(
                discovered_url=entry.url,
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

    def _eligible_entries(
        self,
        entries: list[FeedEntry],
        reference_time: datetime,
        maximum_age_hours: int | None,
    ) -> tuple[list[FeedEntry], int]:
        if maximum_age_hours is None:
            return entries, 0
        cutoff = reference_time - timedelta(hours=maximum_age_hours)
        eligible: list[FeedEntry] = []
        excluded = 0
        for entry in entries:
            if entry.published_at is not None and entry.published_at < cutoff:
                excluded += 1
            else:
                eligible.append(entry)
        return eligible, excluded

    def _validate_request(self, request: dict) -> None:
        source = request["source"]
        if source["sourceId"] != self.profile.source_id:
            raise ValueError("The crawl request source does not match the feed profile.")
        if source["sourceType"] != "RSS":
            raise ValueError(f"{self.profile.source_id} supports only RSS collection.")
        if source["sectionKey"] != self.profile.section_key:
            raise ValueError(f"{self.profile.source_id} supports only {self.profile.section_key}.")

    @staticmethod
    def _item_id(crawl_run_id: str, url: str) -> str:
        digest = hashlib.sha256(url.encode()).hexdigest()[:16]
        return f"{crawl_run_id}-{digest}"
