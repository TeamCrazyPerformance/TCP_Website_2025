from __future__ import annotations

from typing import Any
from urllib.parse import urlsplit

from developer_news_summarizer.models import ALLOWED_TAGS

SOURCE_CATALOG: dict[str, dict[str, Any]] = {
    "cloudflare-blog": {
        "name": "Cloudflare Blog",
        "domain": "blog.cloudflare.com",
        "category": "기술 블로그",
        "capabilities": [{"sourceType": "RSS", "sectionKey": "BLOG"}],
    },
    "infoq": {
        "name": "InfoQ",
        "domain": "infoq.com",
        "category": "업계 뉴스",
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
        "category": "업계 뉴스",
        "capabilities": [
            {"sourceType": "RSS", "sectionKey": "NEWS"},
            {"sourceType": "WEB_CRAWL", "sectionKey": "NEWS"},
            {"sourceType": "API", "sectionKey": "NEWS"},
        ],
    },
    "github-trending": {
        "name": "GitHub Trending",
        "domain": "github.com",
        "category": "저장소",
        "capabilities": [
            {"sourceType": "WEB_CRAWL", "sectionKey": "REPOSITORIES"},
        ],
        "crawlOptionKeys": ["maximumArticleCount", "requestTimeoutMs"],
        "crawlOptionOverrides": {
            "maximumArticleCount": {"default": 3, "minimum": 1, "maximum": 3},
        },
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
    catalog = []
    for source_id, metadata in SOURCE_CATALOG.items():
        keys = metadata.get("crawlOptionKeys", option_contract.keys())
        overrides = metadata.get("crawlOptionOverrides", {})
        source_options = {
            key: {**option_contract[key], **overrides.get(key, {})} for key in keys
        }
        catalog.append(
            {
                "sourceId": source_id,
                "name": metadata["name"],
                "domain": metadata["domain"],
                "capabilities": metadata["capabilities"],
                "crawlOptions": source_options,
            }
        )
    return catalog


# 소스가 늘어나면 공개 화면이 목록을 다 펼칠 수 없게 됩니다. category 는 그때
# 상위 분류로 묶기 위한 것이고, 지금은 응답에 담아만 둡니다. 뒤늦게 붙이면
# 이미 쌓인 소스 전부에 소급해야 하므로 처음부터 채워 둡니다.
PUBLIC_SOURCE_FALLBACK_CATEGORY = "기타"


def public_source_catalog() -> list[dict[str, Any]]:
    """공개 화면의 소스 선택기에 쓰는 최소 정보. 크롤 옵션은 담지 않습니다."""
    return [
        {
            "id": source_id,
            "name": metadata["name"],
            "domain": metadata["domain"],
            "category": metadata.get("category", PUBLIC_SOURCE_FALLBACK_CATEGORY),
        }
        for source_id, metadata in SOURCE_CATALOG.items()
    ]


def known_source_ids() -> set[str]:
    return set(SOURCE_CATALOG)


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
