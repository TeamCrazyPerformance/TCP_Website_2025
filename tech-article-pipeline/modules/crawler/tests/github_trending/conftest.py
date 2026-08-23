from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from github_trending_pipeline.contracts import CrawlRequest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 8, 22, 3, 0, tzinfo=UTC)


@pytest.fixture
def crawl_request(fixed_now: datetime) -> CrawlRequest:
    return CrawlRequest(
        crawlRunId="crawl-github-1",
        requestedAt=fixed_now,
        source={
            "sourceId": "github-trending",
            "sourceType": "WEB_CRAWL",
            "sectionKey": "REPOSITORIES",
        },
        crawlOptions={"maximumArticleCount": 3, "requestTimeoutMs": 15_000},
    )


@pytest.fixture
def trending_html() -> str:
    return (FIXTURES / "trending_daily.html").read_text(encoding="utf-8")


@pytest.fixture
def readme_html() -> str:
    return (FIXTURES / "readme_rendered.html").read_text(encoding="utf-8")


@pytest.fixture
def robots_text() -> str:
    return (FIXTURES / "robots.txt").read_text(encoding="utf-8")
