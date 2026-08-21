from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

from .contracts import CrawlRequest, GitHubTrendingPipelineResult
from .crawler import GitHubTrendingCrawler, _utcnow
from .http_client import GitHubTrendingHttpClient
from .normalizer import GitHubTrendingNormalizer


class GitHubTrendingPipeline:
    def __init__(
        self,
        *,
        http: GitHubTrendingHttpClient,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self.crawler = GitHubTrendingCrawler(http, clock=clock)
        self.normalizer = GitHubTrendingNormalizer(clock=clock)

    def run(self, request: CrawlRequest) -> GitHubTrendingPipelineResult:
        crawl_items, completion = self.crawler.collect(request)
        normalized_articles = [
            self.normalizer.normalize(item)
            for item in crawl_items
            if item.crawl.status == "SUCCESS"
        ]
        return GitHubTrendingPipelineResult(
            crawlRunCompleted=completion,
            crawlItems=crawl_items,
            normalizedArticles=normalized_articles,
        )
