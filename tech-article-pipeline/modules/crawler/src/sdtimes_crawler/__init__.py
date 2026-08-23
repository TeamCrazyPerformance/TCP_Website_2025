"""
SD Times Crawling and Normalization Module.
Implements technical news crawling pipeline spec (v1.0.0).
"""

from datetime import datetime, timezone
from typing import List

from .models import CrawlRequest, SourceInfo, CrawlOptions, EntryPoint, NormalizedDocument
from .crawler import SDTimesCrawler
from .normalizer import SDTimesNormalizer

__version__ = "1.0.0"


def crawl_and_normalize(
    source_type: str = "WEB_CRAWL",
    max_articles: int = 5,
    request_timeout_ms: int = 15000
) -> List[NormalizedDocument]:
    """
    High-level entrypoint to crawl SD Times and return a list of NormalizedDocument objects.
    """
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    crawl_run_id = f"crawl-run-{now_str}"

    request = CrawlRequest(
        schemaVersion="1.0",
        crawlRunId=crawl_run_id,
        requestedAt=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        source=SourceInfo(
            sourceId="sdtimes",
            sourceType=source_type,
            baseUrl="https://sdtimes.com",
            entryPoint=EntryPoint(
                url="https://sdtimes.com",
                path="/",
                sectionKey="NEWS"
            )
        ),
        crawlOptions=CrawlOptions(
            maximumArticleCount=max_articles,
            requestTimeoutMs=request_timeout_ms
        )
    )

    crawler = SDTimesCrawler()
    raw_items, summary = crawler.run_crawl(request)

    normalizer = SDTimesNormalizer()
    normalized_docs = [normalizer.normalize(item) for item in raw_items]

    return normalized_docs
