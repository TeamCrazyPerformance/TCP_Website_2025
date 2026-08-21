from __future__ import annotations

import hashlib
from collections.abc import Callable
from datetime import UTC, datetime

from .contracts import (
    CrawlItemProduced,
    CrawlRequest,
    CrawlRunCompleted,
    CrawlStatistics,
    CrawlStatus,
    DiscoveryInfo,
    ErrorInfo,
    RawArticle,
    SourceIdentity,
    TrendingRepository,
    UrlsInfo,
)
from .errors import GitHubTrendingError
from .http_client import GitHubTrendingHttpClient
from .parsers import parse_trending_repositories
from .urls import TRENDING_URL, canonical_repository_url

Clock = Callable[[], datetime]


def _utcnow() -> datetime:
    return datetime.now(UTC)


class GitHubTrendingCrawler:
    def __init__(
        self,
        http: GitHubTrendingHttpClient,
        *,
        clock: Clock = _utcnow,
        version: str = "1.0.0",
    ) -> None:
        self.http = http
        self.clock = clock
        self.version = version

    def collect(self, request: CrawlRequest) -> tuple[list[CrawlItemProduced], CrawlRunCompleted]:
        started_at = self.clock().astimezone(UTC)
        statistics = CrawlStatistics()
        try:
            listing = self.http.fetch_trending()
            statistics.pages_visited = 1
            repositories = parse_trending_repositories(listing.text)
            statistics.articles_discovered = len(repositories)
        except GitHubTrendingError as exc:
            return [], self._failed_completion(request, started_at, statistics, exc)

        items: list[CrawlItemProduced] = []
        failures: list[GitHubTrendingError] = []
        for repository in repositories[: request.crawl_options.maximum_article_count]:
            statistics.articles_attempted += 1
            statistics.pages_visited += 1
            try:
                readme = self.http.fetch_readme(repository.owner, repository.repository)
                items.append(
                    self._success_item(
                        request,
                        repository,
                        readme.text,
                        readme.status_code,
                    )
                )
                statistics.articles_succeeded += 1
            except GitHubTrendingError as exc:
                failures.append(exc)
                items.append(self._failed_item(request, repository, exc))
                statistics.articles_failed += 1

        if not items:
            error = GitHubTrendingError(
                "TRENDING_EMPTY",
                "GitHub Trending did not provide any repositories to crawl.",
                retryable=False,
            )
            return [], self._failed_completion(request, started_at, statistics, error)

        if statistics.articles_failed == 0:
            status = "COMPLETED"
            run_error = None
        elif statistics.articles_succeeded > 0:
            status = "PARTIALLY_COMPLETED"
            run_error = None
        else:
            status = "FAILED"
            run_error = ErrorInfo(
                code="ALL_CRAWL_ITEMS_FAILED",
                message="Every selected GitHub Trending repository failed to crawl.",
                retryable=any(error.retryable for error in failures),
                details={"failureCodes": [error.code for error in failures]},
            )
        completion = CrawlRunCompleted(
            crawlRunId=request.crawl_run_id,
            status=status,
            startedAt=started_at,
            completedAt=self.clock().astimezone(UTC),
            statistics=statistics,
            error=run_error,
        )
        return items, completion

    def _success_item(
        self,
        request: CrawlRequest,
        repository: TrendingRepository,
        readme_html: str,
        status_code: int,
    ) -> CrawlItemProduced:
        canonical_url = canonical_repository_url(repository.owner, repository.repository)
        return CrawlItemProduced(
            crawlRunId=request.crawl_run_id,
            crawlItemId=self._crawl_item_id(request.crawl_run_id, repository),
            source=SourceIdentity(),
            discovery=self._discovery(repository),
            urls=UrlsInfo(
                discoveredUrl=canonical_url,
                finalUrl=canonical_url,
                canonicalUrl=canonical_url,
            ),
            crawl=CrawlStatus(
                status="SUCCESS",
                crawledAt=self.clock().astimezone(UTC),
                crawlerVersion=self.version,
                httpStatusCode=status_code,
                attempt=1,
                error=None,
            ),
            rawArticle=RawArticle(
                title=repository.full_name,
                authors=[repository.owner],
                description=repository.description,
                contentHtml=readme_html,
                contentText=None,
                languageHint=None,
            ),
        )

    def _failed_item(
        self,
        request: CrawlRequest,
        repository: TrendingRepository,
        error: GitHubTrendingError,
    ) -> CrawlItemProduced:
        canonical_url = canonical_repository_url(repository.owner, repository.repository)
        return CrawlItemProduced(
            crawlRunId=request.crawl_run_id,
            crawlItemId=self._crawl_item_id(request.crawl_run_id, repository),
            source=SourceIdentity(),
            discovery=self._discovery(repository),
            urls=UrlsInfo(
                discoveredUrl=canonical_url,
                finalUrl=canonical_url,
                canonicalUrl=canonical_url,
            ),
            crawl=CrawlStatus(
                status="FAILED",
                crawledAt=self.clock().astimezone(UTC),
                crawlerVersion=self.version,
                httpStatusCode=error.status_code,
                attempt=1,
                error=ErrorInfo.model_validate(error.to_dict()),
            ),
            rawArticle=RawArticle(
                title=repository.full_name,
                authors=[repository.owner],
                description=repository.description,
            ),
        )

    @staticmethod
    def _discovery(repository: TrendingRepository) -> DiscoveryInfo:
        return DiscoveryInfo(
            entryPointUrl=TRENDING_URL,
            discoveredFromUrl=TRENDING_URL,
            sourcePath="/trending",
            sectionKey="REPOSITORIES",
            trendingPeriod="daily",
            rank=repository.rank,
            programmingLanguage=repository.programming_language,
            totalStars=repository.total_stars,
            totalForks=repository.total_forks,
            starsToday=repository.stars_today,
            builtBy=repository.built_by,
        )

    @staticmethod
    def _crawl_item_id(crawl_run_id: str, repository: TrendingRepository) -> str:
        digest = hashlib.sha256(repository.full_name.lower().encode()).hexdigest()[:10]
        suffix = f":github:{repository.rank:03d}:{digest}"
        return f"{crawl_run_id[: 160 - len(suffix)]}{suffix}"

    def _failed_completion(
        self,
        request: CrawlRequest,
        started_at: datetime,
        statistics: CrawlStatistics,
        error: GitHubTrendingError,
    ) -> CrawlRunCompleted:
        return CrawlRunCompleted(
            crawlRunId=request.crawl_run_id,
            status="FAILED",
            startedAt=started_at,
            completedAt=self.clock().astimezone(UTC),
            statistics=statistics,
            error=ErrorInfo.model_validate(error.to_dict()),
        )
