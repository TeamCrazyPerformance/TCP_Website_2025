from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from developer_news_summarizer.models import ALLOWED_TAGS

SOURCE_CATALOG: dict[str, dict[str, Any]] = {
    "cloudflare-blog": {
        "name": "Cloudflare Blog",
        "domain": "blog.cloudflare.com",
        "capabilities": [{"sourceType": "RSS", "sectionKey": "BLOG"}],
    },
    "infoq": {
        "name": "InfoQ",
        "domain": "infoq.com",
        "capabilities": [
            {"sourceType": "RSS", "sectionKey": "NEWS"},
            {"sourceType": "RSS", "sectionKey": "ENGINEERING"},
            {"sourceType": "WEB_CRAWL", "sectionKey": "NEWS"},
            {"sourceType": "WEB_CRAWL", "sectionKey": "ENGINEERING"},
        ],
    },
    "sdtimes": {
        "name": "SD Times",
        "domain": "sdtimes.com",
        "capabilities": [
            {"sourceType": "RSS", "sectionKey": "NEWS"},
            {"sourceType": "WEB_CRAWL", "sectionKey": "NEWS"},
            {"sourceType": "API", "sectionKey": "NEWS"},
        ],
    },
}


LANGUAGE_LABELS = {"ko": "한국어", "en": "영어", "ja": "일본어"}


def tag_catalog() -> list[str]:
    return list(ALLOWED_TAGS)


def crawl_source_catalog() -> list[dict[str, Any]]:
    option_contract = {
        "maximumArticleCount": {"default": 10, "minimum": 1, "maximum": 100},
        "maximumAgeHours": {"default": 720, "minimum": 1},
        "followPagination": {"default": False},
        "maximumPageCount": {"default": 1, "minimum": 1, "maximum": 10},
        "requestTimeoutMs": {"default": 15_000, "minimum": 1_000, "maximum": 60_000},
    }
    return [
        {
            "sourceId": source_id,
            "name": metadata["name"],
            "domain": metadata["domain"],
            "capabilities": metadata["capabilities"],
            "crawlOptions": option_contract,
        }
        for source_id, metadata in SOURCE_CATALOG.items()
    ]


def source_projection(
    source_id: str | None, source_type: str | None, canonical_url: str | None
) -> dict[str, Any]:
    source_id = source_id or "unknown"
    metadata = SOURCE_CATALOG.get(source_id, {})
    parsed = urlsplit(canonical_url or "")
    return {
        "id": source_id,
        "name": metadata.get("name", source_id),
        "type": source_type or "UNKNOWN",
        "domain": parsed.hostname or metadata.get("domain"),
        "path": parsed.path or "/",
        "articleUrl": canonical_url,
    }


def language_projection(code: str | None) -> dict[str, str] | None:
    if not code:
        return None
    normalized = code.lower()
    return {"code": normalized, "label": LANGUAGE_LABELS.get(normalized, normalized)}
