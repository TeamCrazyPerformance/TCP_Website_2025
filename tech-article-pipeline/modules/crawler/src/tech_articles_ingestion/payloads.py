from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.models import ArticlePage, RssItem, RunStatistics
from tech_articles_ingestion.timeutils import utc_iso


def new_crawl_run_id(requested_at: datetime) -> str:
    return f"crawl-run-{requested_at:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}"


def new_crawl_item_id(crawl_run_id: str, rss_item_index: int) -> str:
    suffix = crawl_run_id.removeprefix("crawl-run-")
    return f"crawl-item-{suffix}-{rss_item_index + 1:03d}"


def new_normalization_result_id() -> str:
    return f"normalization-result-{uuid.uuid4().hex}"


def source_payload(config: IngestionConfig) -> dict[str, str]:
    return {"sourceId": config.source_id, "sourceType": config.source_type}


def discovery_payload(config: IngestionConfig) -> dict[str, str]:
    return {
        "entryPointUrl": config.rss_url,
        "discoveredFromUrl": config.rss_url,
        "sourcePath": "/rss/",
        "sectionKey": config.section_key,
    }


def crawl_request_payload(
    config: IngestionConfig, crawl_run_id: str, requested_at: datetime
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "crawlRunId": crawl_run_id,
        "requestedAt": utc_iso(requested_at),
        "source": {
            "sourceId": config.source_id,
            "sourceType": config.source_type,
            "baseUrl": "https://blog.cloudflare.com",
            "entryPoint": {
                "url": config.rss_url,
                "path": "/rss/",
                "sectionKey": config.section_key,
            },
        },
        "crawlOptions": {
            "maximumArticleCount": config.maximum_article_count,
            "maximumAgeHours": config.maximum_age_hours,
            "followPagination": False,
            "maximumPageCount": 1,
            "requestTimeoutMs": int(config.request_timeout_seconds * 1000),
        },
    }


def crawl_success_payload(
    config: IngestionConfig,
    *,
    crawl_run_id: str,
    crawl_item_id: str,
    rss_item: RssItem,
    article: ArticlePage,
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "crawlRunId": crawl_run_id,
        "crawlItemId": crawl_item_id,
        "source": source_payload(config),
        "discovery": discovery_payload(config),
        "urls": {
            "discoveredUrl": article.discovered_url,
            "finalUrl": article.final_url,
            "canonicalUrl": article.canonical_url,
        },
        "crawl": {
            "status": "SUCCESS",
            "crawledAt": utc_iso(article.crawled_at),
            "crawlerVersion": config.crawler_version,
            "httpStatusCode": article.http_status_code,
            "attempt": 1,
            "error": None,
        },
        "rawArticle": {
            "title": rss_item.title,
            "authors": rss_item.creators,
            "publishedAtRaw": rss_item.pub_date_raw,
            "contentHtml": article.content_html,
            "contentText": article.content_text,
            "languageHint": rss_item.channel_language,
        },
    }


def crawl_failure_payload(
    config: IngestionConfig,
    *,
    crawl_run_id: str,
    crawl_item_id: str,
    discovered_url: str,
    final_url: str | None,
    crawled_at: datetime,
    error: IngestionError,
) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "crawlRunId": crawl_run_id,
        "crawlItemId": crawl_item_id,
        "source": source_payload(config),
        "discovery": discovery_payload(config),
        "urls": {
            "discoveredUrl": discovered_url,
            "finalUrl": final_url,
            "canonicalUrl": None,
        },
        "crawl": {
            "status": "FAILED",
            "crawledAt": utc_iso(crawled_at),
            "crawlerVersion": config.crawler_version,
            "httpStatusCode": error.http_status_code,
            "attempt": 1,
            "error": error.to_contract_dict(),
        },
        "rawArticle": None,
    }


def normalization_input_payload(crawl_item: dict[str, Any]) -> dict[str, Any]:
    raw = crawl_item["rawArticle"]
    return {
        "crawlRunId": crawl_item["crawlRunId"],
        "crawlItemId": crawl_item["crawlItemId"],
        "source": crawl_item["source"],
        "discovery": crawl_item["discovery"],
        "urls": crawl_item["urls"],
        "rawArticle": {
            "title": raw["title"],
            "authors": raw["authors"],
            "publishedAtRaw": raw["publishedAtRaw"],
            "contentHtml": raw["contentHtml"],
            "contentText": raw["contentText"],
        },
        "normalizationOptions": {
            "defaultTimeZone": "UTC",
            "removeBoilerplate": True,
            "normalizeWhitespace": True,
            "resolveCanonicalUrl": True,
            "detectLanguage": True,
        },
    }


def crawl_run_completed_payload(
    crawl_run_id: str,
    status: str,
    started_at: datetime,
    completed_at: datetime,
    statistics: RunStatistics,
) -> dict[str, Any]:
    return {
        "crawlRunId": crawl_run_id,
        "status": status,
        "startedAt": utc_iso(started_at),
        "completedAt": utc_iso(completed_at),
        "statistics": statistics.official(),
    }
