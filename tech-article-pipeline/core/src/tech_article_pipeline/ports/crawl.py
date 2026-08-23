from __future__ import annotations

from typing import Any, Protocol

from tech_article_sources import CrawlBatch


class CrawlerPort(Protocol):
    """CrawlRequested -> crawl items, completion, and normalized candidates."""

    def run(self, crawl_run_id: str, request: dict[str, Any]) -> CrawlBatch: ...


class NormalizerPort(Protocol):
    """Reserved contract: CrawlItemProduced -> NormalizedArticleCandidate."""

    def normalize(self, item: dict[str, Any]) -> dict[str, Any]: ...
