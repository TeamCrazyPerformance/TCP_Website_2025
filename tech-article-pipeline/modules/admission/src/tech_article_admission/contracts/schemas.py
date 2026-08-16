from __future__ import annotations

from typing import Any

from ..constants import EXTERNAL_POLICY_VERSION, MAX_CANDIDATE_COUNT, SCHEMA_VERSION

_ASCII_PRINTABLE = r"^[\x21-\x7E]+$"

ARTICLE_ADMISSION_REQUEST_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "tcp/article-admission-request/1.0",
    "type": "object",
    "additionalProperties": True,
    "required": [
        "crawlRunId",
        "crawlItemId",
        "source",
        "urls",
        "article",
        "duplicatePolicy",
    ],
    "properties": {
        "schemaVersion": {"const": SCHEMA_VERSION},
        "crawlRunId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160,
            "pattern": _ASCII_PRINTABLE,
        },
        "crawlItemId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 160,
            "pattern": _ASCII_PRINTABLE,
        },
        "source": {
            "type": "object",
            "additionalProperties": True,
            "required": ["sourceId"],
            "properties": {
                "sourceId": {"type": "string", "minLength": 1, "maxLength": 128},
                "sourceType": {"type": "string", "minLength": 1},
            },
        },
        "discovery": {"type": "object", "additionalProperties": True},
        "urls": {
            "type": "object",
            "additionalProperties": True,
            "required": ["canonicalUrl"],
            "properties": {
                "discoveredUrl": {"type": "string", "minLength": 1},
                "finalUrl": {"type": "string", "minLength": 1},
                "canonicalUrl": {"type": "string", "minLength": 1},
            },
        },
        "article": {
            "type": "object",
            "additionalProperties": True,
            "required": ["title", "authors", "originalPublishedAt", "content", "language"],
            "properties": {
                "title": {"type": "string", "minLength": 1, "maxLength": 1000},
                "authors": {"type": "array", "items": {"type": "string"}},
                "originalPublishedAt": {
                    "anyOf": [
                        {"type": "string", "format": "utc-date-time"},
                        {"type": "null"},
                    ]
                },
                "content": {"type": "string", "minLength": 1},
                "language": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 16,
                    "pattern": r"^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$",
                },
            },
        },
        "normalization": {
            "type": "object",
            "additionalProperties": True,
            "required": ["status", "normalizedAt", "normalizerVersion", "warnings", "error"],
            "properties": {
                "status": {"const": "SUCCESS"},
                "normalizedAt": {"type": "string", "format": "utc-date-time"},
                "normalizerVersion": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": _ASCII_PRINTABLE,
                },
                "warnings": {"type": "array", "items": {"type": "string"}},
                "error": {"type": "null"},
            },
        },
        "duplicatePolicy": {
            "type": "object",
            "additionalProperties": True,
            "required": [
                "policyVersion",
                "checkCanonicalUrl",
                "checkContentHash",
                "checkTitleSimilarity",
                "duplicateTitleThreshold",
                "possibleDuplicateThreshold",
            ],
            "properties": {
                "policyVersion": {
                    "const": EXTERNAL_POLICY_VERSION,
                    "maxLength": 64,
                    "pattern": _ASCII_PRINTABLE,
                },
                "checkCanonicalUrl": {"type": "boolean"},
                "checkContentHash": {"type": "boolean"},
                "checkTitleSimilarity": {"type": "boolean"},
                "duplicateTitleThreshold": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                },
                "possibleDuplicateThreshold": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                },
                "candidateMaximumAgeDays": {"type": "integer", "minimum": 1},
                "maximumCandidateCount": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": MAX_CANDIDATE_COUNT,
                },
            },
        },
    },
}

RESOLUTION_REQUEST_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "tcp/duplicate-review-resolution/1.0",
    "type": "object",
    "additionalProperties": True,
    "required": [
        "resolutionRequestId",
        "reviewCaseId",
        "expectedCaseVersion",
        "action",
        "matchedArticleId",
        "administratorId",
        "resolvedAt",
    ],
    "properties": {
        "schemaVersion": {"const": SCHEMA_VERSION},
        "resolutionRequestId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "pattern": _ASCII_PRINTABLE,
        },
        "reviewCaseId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "pattern": _ASCII_PRINTABLE,
        },
        "expectedCaseVersion": {"type": "integer", "minimum": 1},
        "action": {"enum": ["APPROVE_UNIQUE", "CONFIRM_DUPLICATE"]},
        "matchedArticleId": {
            "anyOf": [
                {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 64,
                    "pattern": _ASCII_PRINTABLE,
                },
                {"type": "null"},
            ]
        },
        "administratorId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128,
            "pattern": _ASCII_PRINTABLE,
        },
        "resolvedAt": {"type": "string", "format": "utc-date-time"},
    },
}

HARD_DELETE_REQUEST_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "tcp/article-hard-delete-request/1.0",
    "type": "object",
    "additionalProperties": False,
    "required": [
        "deletionRequestId",
        "articleId",
        "expectedRecordVersion",
        "administratorId",
        "reasonCode",
    ],
    "properties": {
        "schemaVersion": {"const": SCHEMA_VERSION},
        "deletionRequestId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "pattern": _ASCII_PRINTABLE,
        },
        "articleId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "pattern": _ASCII_PRINTABLE,
        },
        "expectedRecordVersion": {"type": "integer", "minimum": 1},
        "administratorId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 128,
            "pattern": _ASCII_PRINTABLE,
        },
        "reasonCode": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64,
            "pattern": _ASCII_PRINTABLE,
        },
    },
}
