from __future__ import annotations

from datetime import datetime

import pytest
from github_trending_pipeline.contracts import CrawlRequest
from pydantic import ValidationError


def test_request_serializes_to_source_local_camel_case_contract(crawl_request):
    payload = crawl_request.model_dump(by_alias=True, mode="json")

    assert payload["messageType"] == "CrawlRequested"
    assert payload["source"] == {
        "sourceId": "github-trending",
        "sourceType": "WEB_CRAWL",
        "sectionKey": "REPOSITORIES",
    }
    assert payload["crawlOptions"]["maximumArticleCount"] == 3


def test_request_rejects_more_than_three_repositories(fixed_now):
    with pytest.raises(ValidationError):
        CrawlRequest(
            crawlRunId="crawl-1",
            requestedAt=fixed_now,
            crawlOptions={"maximumArticleCount": 4},
        )


def test_request_requires_explicit_utc_timestamp():
    with pytest.raises(ValidationError):
        CrawlRequest(crawlRunId="crawl-1", requestedAt=datetime(2026, 8, 22))
