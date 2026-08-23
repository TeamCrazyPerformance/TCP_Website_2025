from __future__ import annotations

from typing import Any

CRAWL_ITEM_SCHEMA_ID = "https://tcp.or.kr/schemas/tech-articles/ingestion/crawl-item-produced/1.0"
CRAWL_RUN_SCHEMA_ID = "https://tcp.or.kr/schemas/tech-articles/ingestion/crawl-run-completed/1.0"
NORMALIZATION_INPUT_SCHEMA_ID = (
    "https://tcp.or.kr/schemas/tech-articles/ingestion/normalization-input/1.0"
)
NORMALIZATION_OUTPUT_SCHEMA_ID = (
    "https://tcp.or.kr/schemas/tech-articles/ingestion/article-normalized/1.0"
)


def _source_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["sourceId", "sourceType"],
        "properties": {
            "sourceId": {"const": "cloudflare-blog"},
            "sourceType": {"const": "RSS"},
        },
    }


def _discovery_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "entryPointUrl",
            "discoveredFromUrl",
            "sourcePath",
            "sectionKey",
        ],
        "properties": {
            "entryPointUrl": {"const": "https://blog.cloudflare.com/rss/"},
            "discoveredFromUrl": {"const": "https://blog.cloudflare.com/rss/"},
            "sourcePath": {"const": "/rss/"},
            "sectionKey": {"const": "BLOG"},
        },
    }


def _url_schema() -> dict[str, Any]:
    return {
        "type": "string",
        "minLength": 1,
        "maxLength": 2048,
        "format": "cloudflare-blog-https-url",
    }


def _nullable_url_schema() -> dict[str, Any]:
    return {"anyOf": [_url_schema(), {"type": "null"}]}


def _urls_schema(*, require_final: bool = False, require_canonical: bool = False) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["discoveredUrl", "finalUrl", "canonicalUrl"],
        "properties": {
            "discoveredUrl": _url_schema(),
            "finalUrl": _url_schema() if require_final else _nullable_url_schema(),
            "canonicalUrl": _url_schema() if require_canonical else _nullable_url_schema(),
        },
    }


def _validation_issue_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["instancePath", "keyword"],
        "properties": {
            "instancePath": {"type": "string", "maxLength": 512},
            "keyword": {"type": "string", "maxLength": 128},
        },
    }


def _error_details_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "maximumAttempts": {"type": "integer", "const": 1},
            "retryAfterSeconds": {"type": "integer", "minimum": 0},
            "retryAfterRaw": {"type": "string", "maxLength": 256},
            "failureStage": {
                "type": "string",
                "enum": [
                    "RSS_REQUEST",
                    "RSS_PARSE",
                    "RSS_ITEM_VALIDATION",
                    "ARTICLE_REQUEST",
                    "ARTICLE_EXTRACTION",
                    "CRAWL_OUTPUT_VALIDATION",
                ],
            },
            "validationIssues": {
                "type": "array",
                "maxItems": 100,
                "items": _validation_issue_schema(),
            },
        },
    }


def _error_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["code", "message", "retryable", "details"],
        "properties": {
            "code": {"type": "string", "pattern": "^[A-Z][A-Z0-9_]{0,127}$"},
            "message": {"type": "string", "minLength": 1, "maxLength": 1000},
            "retryable": {"type": "boolean"},
            "details": _error_details_schema(),
        },
    }


def _raw_article_success_schema(*, language_hint: bool) -> dict[str, Any]:
    required = ["title", "authors", "publishedAtRaw", "contentHtml", "contentText"]
    properties: dict[str, Any] = {
        "title": {"type": "string", "minLength": 1, "maxLength": 10_000},
        "authors": {
            "type": "array",
            "maxItems": 64,
            "items": {"type": "string", "maxLength": 512},
        },
        "publishedAtRaw": {"anyOf": [{"type": "string", "maxLength": 512}, {"type": "null"}]},
        "contentHtml": {"type": "string", "minLength": 1, "maxLength": 5_242_880},
        "contentText": {"type": "string", "minLength": 1, "maxLength": 5_242_880},
    }
    if language_hint:
        required.append("languageHint")
        properties["languageHint"] = {
            "anyOf": [
                {"type": "string", "minLength": 1, "maxLength": 64},
                {"type": "null"},
            ]
        }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": required,
        "properties": properties,
    }


def _normalization_raw_article_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["title"],
        "properties": {
            "title": {"type": "string", "minLength": 1, "maxLength": 10_000},
            "authors": {
                "anyOf": [
                    {
                        "type": "array",
                        "maxItems": 64,
                        "items": {"type": "string", "maxLength": 512},
                    },
                    {"type": "null"},
                ]
            },
            "publishedAtRaw": {"anyOf": [{"type": "string", "maxLength": 512}, {"type": "null"}]},
            "contentHtml": {
                "anyOf": [
                    {"type": "string", "maxLength": 5_242_880},
                    {"type": "null"},
                ]
            },
            "contentText": {
                "anyOf": [
                    {"type": "string", "maxLength": 5_242_880},
                    {"type": "null"},
                ]
            },
        },
        "anyOf": [
            {
                "required": ["contentHtml"],
                "properties": {"contentHtml": {"type": "string", "minLength": 1}},
            },
            {
                "required": ["contentText"],
                "properties": {"contentText": {"type": "string", "minLength": 1}},
            },
        ],
    }


def _crawl_schema(*, success: bool) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "status",
            "crawledAt",
            "crawlerVersion",
            "httpStatusCode",
            "attempt",
            "error",
        ],
        "properties": {
            "status": {"const": "SUCCESS" if success else "FAILED"},
            "crawledAt": {"type": "string", "format": "utc-date-time"},
            "crawlerVersion": {"type": "string", "format": "semver"},
            "httpStatusCode": (
                {"type": "integer", "minimum": 200, "maximum": 299}
                if success
                else {
                    "anyOf": [
                        {"type": "integer", "minimum": 100, "maximum": 599},
                        {"type": "null"},
                    ]
                }
            ),
            "attempt": {"type": "integer", "const": 1},
            "error": {"type": "null"} if success else _error_schema(),
        },
    }


def _crawl_item_branch(*, success: bool) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "schemaVersion",
            "crawlRunId",
            "crawlItemId",
            "source",
            "discovery",
            "urls",
            "crawl",
            "rawArticle",
        ],
        "properties": {
            "schemaVersion": {"const": "1.0"},
            "crawlRunId": {
                "type": "string",
                "format": "crawl-run-id",
                "maxLength": 128,
            },
            "crawlItemId": {
                "type": "string",
                "format": "crawl-item-id",
                "maxLength": 160,
            },
            "source": _source_schema(),
            "discovery": _discovery_schema(),
            "urls": _urls_schema(require_final=success),
            "crawl": _crawl_schema(success=success),
            "rawArticle": (
                _raw_article_success_schema(language_hint=True) if success else {"type": "null"}
            ),
        },
    }


CRAWL_ITEM_PRODUCED_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": CRAWL_ITEM_SCHEMA_ID,
    "oneOf": [_crawl_item_branch(success=True), _crawl_item_branch(success=False)],
}


CRAWL_RUN_COMPLETED_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": CRAWL_RUN_SCHEMA_ID,
    "type": "object",
    "additionalProperties": False,
    "required": ["crawlRunId", "status", "startedAt", "completedAt", "statistics"],
    "properties": {
        "crawlRunId": {
            "type": "string",
            "format": "crawl-run-id",
            "maxLength": 128,
        },
        "status": {
            "type": "string",
            "enum": ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"],
        },
        "startedAt": {"type": "string", "format": "utc-date-time"},
        "completedAt": {"type": "string", "format": "utc-date-time"},
        "statistics": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "pagesVisited",
                "articlesDiscovered",
                "articlesExcludedByAge",
                "articlesAttempted",
                "articlesSucceeded",
                "articlesFailed",
            ],
            "properties": {
                "pagesVisited": {"type": "integer", "minimum": 0},
                "articlesDiscovered": {"type": "integer", "minimum": 0},
                "articlesExcludedByAge": {"type": "integer", "minimum": 0},
                "articlesAttempted": {"type": "integer", "minimum": 0},
                "articlesSucceeded": {"type": "integer", "minimum": 0},
                "articlesFailed": {"type": "integer", "minimum": 0},
            },
        },
    },
}


NORMALIZATION_INPUT_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": NORMALIZATION_INPUT_SCHEMA_ID,
    "type": "object",
    "additionalProperties": False,
    "required": [
        "crawlRunId",
        "crawlItemId",
        "source",
        "discovery",
        "urls",
        "rawArticle",
        "normalizationOptions",
    ],
    "properties": {
        "crawlRunId": {"type": "string", "format": "crawl-run-id", "maxLength": 128},
        "crawlItemId": {"type": "string", "format": "crawl-item-id", "maxLength": 160},
        "source": _source_schema(),
        "discovery": _discovery_schema(),
        "urls": _urls_schema(require_final=True),
        "rawArticle": _normalization_raw_article_schema(),
        "normalizationOptions": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "defaultTimeZone",
                "removeBoilerplate",
                "normalizeWhitespace",
                "resolveCanonicalUrl",
                "detectLanguage",
            ],
            "properties": {
                "defaultTimeZone": {"type": "string", "minLength": 1, "maxLength": 64},
                "removeBoilerplate": {"type": "boolean"},
                "normalizeWhitespace": {"type": "boolean"},
                "resolveCanonicalUrl": {"type": "boolean"},
                "detectLanguage": {"type": "boolean"},
            },
        },
    },
}


NORMALIZATION_OUTPUT_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": NORMALIZATION_OUTPUT_SCHEMA_ID,
    "type": "object",
    "additionalProperties": False,
    "required": [
        "crawlRunId",
        "crawlItemId",
        "source",
        "discovery",
        "urls",
        "article",
        "normalization",
    ],
    "properties": {
        "crawlRunId": {"type": "string", "format": "crawl-run-id", "maxLength": 128},
        "crawlItemId": {"type": "string", "format": "crawl-item-id", "maxLength": 160},
        "source": _source_schema(),
        "discovery": _discovery_schema(),
        "urls": _urls_schema(require_final=True, require_canonical=True),
        "article": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "title",
                "authors",
                "originalPublishedAt",
                "content",
                "language",
            ],
            "properties": {
                "title": {"type": "string", "minLength": 1, "maxLength": 10_000},
                "authors": {
                    "type": "array",
                    "maxItems": 64,
                    "items": {"type": "string", "minLength": 1, "maxLength": 512},
                },
                "originalPublishedAt": {
                    "anyOf": [
                        {"type": "string", "format": "utc-date-time"},
                        {"type": "null"},
                    ]
                },
                "content": {"type": "string", "minLength": 1, "maxLength": 5_242_880},
                "language": {"type": "string", "pattern": "^[a-z]{2}$"},
            },
        },
        "normalization": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "status",
                "normalizedAt",
                "normalizerVersion",
                "warnings",
                "error",
            ],
            "properties": {
                "status": {"const": "SUCCESS"},
                "normalizedAt": {"type": "string", "format": "utc-date-time"},
                "normalizerVersion": {"type": "string", "format": "semver"},
                "warnings": {
                    "type": "array",
                    "uniqueItems": True,
                    "items": {
                        "type": "string",
                        "enum": [
                            "CANONICAL_URL_MISSING",
                            "PUBLISHED_AT_MISSING",
                            "PUBLISHED_AT_TIMEZONE_ASSUMED",
                            "AUTHOR_MISSING",
                            "CONTENT_SHORT_AFTER_CLEANUP",
                            "LANGUAGE_UNCERTAIN",
                            "CLOUDFLARE_UNSUPPORTED_IMAGE_BLOCK",
                        ],
                    },
                },
                "error": {"type": "null"},
            },
        },
    },
}
