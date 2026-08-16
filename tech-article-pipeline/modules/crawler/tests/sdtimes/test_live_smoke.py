from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest

from sdtimes_crawler.crawler import SDTimesCrawler
from sdtimes_crawler.models import CrawlOptions, CrawlRequest, EntryPoint, SourceInfo
from sdtimes_crawler.normalizer import SDTimesNormalizer

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_SDTIMES") != "1",
    reason="set RUN_LIVE_SDTIMES=1 to access the live SD Times feed",
)


def test_live_sdtimes_rss_reaches_and_normalizes_one_article() -> None:
    now = datetime.now(UTC)
    request = CrawlRequest(
        schemaVersion="1.0",
        crawlRunId=f"crawl-run-live-{now:%Y%m%d%H%M%S}",
        requestedAt=now.isoformat().replace("+00:00", "Z"),
        source=SourceInfo(
            sourceId="sdtimes",
            sourceType="RSS",
            baseUrl="https://sdtimes.com",
            entryPoint=EntryPoint(
                url="https://sdtimes.com/feed/",
                path="/feed/",
                sectionKey="NEWS",
            ),
        ),
        crawlOptions=CrawlOptions(
            maximumArticleCount=1,
            maximumAgeHours=720,
            requestTimeoutMs=15_000,
        ),
    )
    crawler = SDTimesCrawler(
        user_agent=(
            "TCP-Tech-Article-Pipeline-Live-Smoke/0.2 "
            "(+https://github.com/TeamCrazyPerformance/TCP_Website_2025; "
            "contact=crawler-test@tcp.or.kr)"
        ),
        minimum_request_interval_seconds=1.0,
    )
    items, completed = crawler.run_crawl(request)
    assert completed.status in {"COMPLETED", "PARTIALLY_COMPLETED"}, completed.model_dump()
    successful = [item for item in items if item.crawl.status == "SUCCESS"]
    assert successful, completed.model_dump()
    normalized = SDTimesNormalizer().normalize(successful[0])
    assert normalized.normalization.status == "SUCCESS", normalized.model_dump()
    assert normalized.article.title
    assert normalized.article.content
    assert normalized.urls.canonicalUrl
