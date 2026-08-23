from __future__ import annotations

import copy
from typing import Any

import pytest


@pytest.fixture
def payload_factory():
    def make_payload(
        *,
        crawl_item_id: str = "crawl-item-001",
        content: str = "A sufficiently long and unique normalized article body.",
        title: str = "Example article",
        canonical_url: str = "https://example.com/articles/one",
        check_hash: bool = True,
        check_url: bool = True,
        check_title: bool = True,
        maximum_candidates: int = 100,
    ) -> dict[str, Any]:
        return {
            "schemaVersion": "1.0",
            "crawlRunId": "crawl-run-001",
            "crawlItemId": crawl_item_id,
            "source": {"sourceId": "example", "sourceType": "WEB_CRAWL"},
            "discovery": {"sourcePath": "/articles"},
            "urls": {
                "discoveredUrl": canonical_url,
                "finalUrl": canonical_url,
                "canonicalUrl": canonical_url,
            },
            "article": {
                "title": title,
                "authors": ["TCP Test"],
                "originalPublishedAt": "2026-08-01T09:30:00Z",
                "content": content,
                "language": "en",
            },
            "normalization": {
                "status": "SUCCESS",
                "normalizedAt": "2026-08-02T03:00:06Z",
                "normalizerVersion": "normalizer-v1",
                "warnings": [],
                "error": None,
            },
            "duplicatePolicy": {
                "policyVersion": "duplicate-policy-v1",
                "checkCanonicalUrl": check_url,
                "checkContentHash": check_hash,
                "checkTitleSimilarity": check_title,
                "duplicateTitleThreshold": 0.9,
                "possibleDuplicateThreshold": 0.8,
                "maximumCandidateCount": maximum_candidates,
            },
        }

    return make_payload


@pytest.fixture
def copied_payload():
    return copy.deepcopy
