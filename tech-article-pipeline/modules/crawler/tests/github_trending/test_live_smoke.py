from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from github_trending_pipeline import CrawlRequest, GitHubTrendingPipeline
from github_trending_pipeline.http_client import GitHubTrendingHttpClient

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_SOURCE_ADAPTERS") != "1",
    reason="set RUN_LIVE_SOURCE_ADAPTERS=1 to run live source adapters",
)


def test_live_github_trending_normalizes_one_readme() -> None:
    public_url = os.environ["CRAWLER_PUBLIC_URL"]
    contact = os.environ["CRAWLER_CONTACT"]
    http = GitHubTrendingHttpClient(
        user_agent=f"TCP-Tech-Article-Pipeline/1.0 (+{public_url}; contact={contact})",
        timeout_seconds=15,
    )
    try:
        result = GitHubTrendingPipeline(http=http).run(
            CrawlRequest(
                crawlRunId="live-github-trending",
                requestedAt=datetime.now(UTC),
                crawlOptions={"maximumArticleCount": 1, "requestTimeoutMs": 15_000},
            )
        )
    finally:
        http.close()

    assert result.crawl_run_completed.status == "COMPLETED"
    assert result.normalized_articles[0].normalization.status == "SUCCESS"
