from __future__ import annotations

from dataclasses import dataclass
from .contracts import ArticleNormalized, CrawlItemProduced, CrawlRequest, CrawlRunCompleted, ExecutionStatus
from .infoq import InfoQCollector
from .normalizer import ArticleNormalizer
from .storage import InMemoryRawCrawlRepository, RawCrawlRepository


@dataclass(slots=True)
class PipelineResult:
    crawl_items: list[CrawlItemProduced]
    normalized_articles: list[ArticleNormalized]
    crawl_run_completed: CrawlRunCompleted

    def events(self) -> list[CrawlItemProduced | ArticleNormalized | CrawlRunCompleted]:
        return [*self.crawl_items, self.crawl_run_completed, *self.normalized_articles]


class InfoQPipeline:
    def __init__(
        self,
        collector: InfoQCollector | None = None,
        normalizer: ArticleNormalizer | None = None,
        repository: RawCrawlRepository | None = None,
    ) -> None:
        self.collector = collector or InfoQCollector()
        self.normalizer = normalizer or ArticleNormalizer()
        self.repository = repository or InMemoryRawCrawlRepository()

    def run(self, request: CrawlRequest) -> PipelineResult:
        self.collector.validate_request(request)
        self.repository.save_run_started(request)
        collection = self.collector.collect(request)
        for item in collection.items:
            self.repository.save_item(item)
        self.repository.save_run_completed(collection.completed)
        normalized = [
            self.normalizer.normalize(item)
            for item in collection.items
            if item.crawl.status is ExecutionStatus.SUCCESS
        ]
        return PipelineResult(
            crawl_items=collection.items,
            normalized_articles=normalized,
            crawl_run_completed=collection.completed,
        )
