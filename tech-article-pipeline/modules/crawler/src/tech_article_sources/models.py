from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class CrawlBatch:
    """Source-neutral output retained by the core before admission."""

    completion: dict[str, Any]
    crawl_items: list[dict[str, Any]] = field(default_factory=list)
    normalized_articles: list[dict[str, Any]] = field(default_factory=list)

