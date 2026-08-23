from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(slots=True)
class RssItem:
    index: int
    guid: str | None
    link: str | None
    title: str | None
    pub_date_raw: str | None
    creators: list[str]
    categories: list[str]
    description: str | None
    content_encoded: str | None
    channel_language: str | None
    field_presence: dict[str, bool] = field(default_factory=dict)
    parsed_published_at: datetime | None = None
    source_payload_hash: str | None = None

    def internal_payload(self) -> dict[str, Any]:
        return {
            "rssItemIndex": self.index,
            "guid": self.guid,
            "link": self.link,
            "title": self.title,
            "pubDate": self.pub_date_raw,
            "creators": self.creators,
            "categories": self.categories,
            "description": self.description,
            "contentEncoded": self.content_encoded,
            "channelLanguage": self.channel_language,
            "fieldPresence": self.field_presence,
        }


@dataclass(frozen=True, slots=True)
class RssFeed:
    language: str | None
    last_build_date: str | None
    items: list[RssItem]


@dataclass(frozen=True, slots=True)
class ArticlePage:
    discovered_url: str
    final_url: str
    canonical_url: str | None
    content_html: str
    content_text: str
    http_status_code: int
    crawled_at: datetime


@dataclass(frozen=True, slots=True)
class SourceState:
    source_id: str
    source_guid: str
    last_successfully_normalized_payload_hash: str | None
    state_version: int


@dataclass(slots=True)
class RunStatistics:
    pages_visited: int = 0
    articles_discovered: int = 0
    articles_excluded_by_age: int = 0
    articles_attempted: int = 0
    articles_succeeded: int = 0
    articles_failed: int = 0
    articles_unchanged: int = 0
    crawl_items_emitted: int = 0
    normalizations_succeeded: int = 0
    normalizations_failed: int = 0
    policy_checked_at: str | None = None
    policy_allowed: bool | None = None
    rss_last_build_date: str | None = None

    def official(self) -> dict[str, int]:
        return {
            "pagesVisited": self.pages_visited,
            "articlesDiscovered": self.articles_discovered,
            "articlesExcludedByAge": self.articles_excluded_by_age,
            "articlesAttempted": self.articles_attempted,
            "articlesSucceeded": self.articles_succeeded,
            "articlesFailed": self.articles_failed,
        }

    def internal(self) -> dict[str, Any]:
        return {
            "articlesUnchanged": self.articles_unchanged,
            "crawlItemsEmitted": self.crawl_items_emitted,
            "normalizationsSucceeded": self.normalizations_succeeded,
            "normalizationsFailed": self.normalizations_failed,
            "policyCheckedAt": self.policy_checked_at,
            "policyAllowed": self.policy_allowed,
            "rssLastBuildDate": self.rss_last_build_date,
        }


@dataclass(frozen=True, slots=True)
class IngestionRunResult:
    crawl_run_completed: dict[str, Any]
    crawl_items_produced: list[dict[str, Any]] = field(default_factory=list)
    normalized_articles: list[dict[str, Any]] = field(default_factory=list)
