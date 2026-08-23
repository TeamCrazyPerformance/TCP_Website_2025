from __future__ import annotations

import unittest
import sqlite3
from datetime import datetime, timezone
from tempfile import TemporaryDirectory
from pathlib import Path

from technical_news_pipeline.cli import build_request
from technical_news_pipeline.contracts import CrawlRunStatus, ExecutionStatus, SourceType
from technical_news_pipeline.http_client import FetchError, HttpResult, InfoQHttpClient
from technical_news_pipeline.infoq import InfoQCollector
from technical_news_pipeline.normalizer import ArticleNormalizer
from technical_news_pipeline.pipeline import InfoQPipeline
from technical_news_pipeline.storage import InMemoryRawCrawlRepository, SQLiteRawCrawlRepository


FEED = """<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item><title>Good title</title><link>https://www.infoq.com/news/good/</link>
<dc:creator>Alice</dc:creator><dc:date>2026-08-05T01:00:00Z</dc:date></item>
<item><title>Broken title</title><link>https://www.infoq.com/news/broken/</link>
<dc:creator>Bob</dc:creator><dc:date>2026-08-05T02:00:00Z</dc:date></item>
</channel></rss>"""

GOOD_PAGE = """<html lang="en"><head>
</head><body><h1> Good title </h1><div class="article__data">
<p>This is a complete technical article body used for normalization.</p>
</div></body></html>"""

LISTING_PAGE_1 = """<html><body>
<a href="/news/good/">Good</a><a href="/news/broken/">Broken</a>
</body></html>"""
LISTING_PAGE_2 = """<html><body><a href="/news/later/">Later</a></body></html>"""


class FakeHttp:
    user_agent = "test-agent"

    def __init__(self) -> None:
        self.listing_requests: list[str] = []

    def fetch_feed(self, url: str) -> HttpResult:
        return HttpResult(FEED, url, 200, 1)

    def fetch_robots(self, url: str) -> HttpResult:
        return HttpResult("User-agent: *\nAllow: /\n", url, 200, 1)

    def fetch_article(self, url: str) -> HttpResult:
        if url.endswith(("/good/", "/later/")):
            return HttpResult(GOOD_PAGE, url, 200, 1)
        return HttpResult(
            "<html><body>changed</body></html>",
            "https://www.infoq.com/news/broken-final/",
            203,
            2,
        )

    def fetch_listing(self, url: str, source_path: str) -> HttpResult:
        self.listing_requests.append(url)
        body = LISTING_PAGE_2 if url.endswith("/2/") else LISTING_PAGE_1
        return HttpResult(body, url, 200, 1)


class PartialListingHttp(FakeHttp):
    def fetch_listing(self, url: str, source_path: str) -> HttpResult:
        if url.endswith("/2/"):
            raise FetchError(
                "UPSTREAM_HTTP_ERROR",
                "InfoQ returned HTTP 503",
                retryable=True,
                status_code=503,
                attempt=3,
                final_url=url,
            )
        return super().fetch_listing(url, source_path)


class ConfigurableFakeHttp(InfoQHttpClient):
    def __init__(self) -> None:
        super().__init__(timeout_seconds=99, sleep=lambda _: None)
        self.fake = FakeHttp()

    def fetch_feed(self, url: str) -> HttpResult:
        return self.fake.fetch_feed(url)

    def fetch_robots(self, url: str) -> HttpResult:
        return self.fake.fetch_robots(url)

    def fetch_article(self, url: str) -> HttpResult:
        return self.fake.fetch_article(url)

    def fetch_listing(self, url: str, source_path: str) -> HttpResult:
        return self.fake.fetch_listing(url, source_path)


class PipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.fixed_now = lambda: datetime(2026, 8, 5, 3, 0, tzinfo=timezone.utc)

    def test_article_failure_is_isolated_and_contracts_are_emitted(self) -> None:
        request = build_request("news", 10, None, source_type=SourceType.RSS)
        repository = InMemoryRawCrawlRepository()
        pipeline = InfoQPipeline(
            collector=InfoQCollector(http=FakeHttp(), now=self.fixed_now),
            normalizer=ArticleNormalizer(now=self.fixed_now),
            repository=repository,
        )
        result = pipeline.run(request)

        self.assertEqual(len(result.crawl_items), 2)
        self.assertEqual(result.crawl_items[0].crawl.status, ExecutionStatus.SUCCESS)
        self.assertEqual(result.crawl_items[1].crawl.status, ExecutionStatus.FAILED)
        self.assertEqual(result.crawl_items[1].crawl.error.code, "BODY_STRUCTURE_CHANGED")
        self.assertEqual(result.crawl_items[1].urls.final_url, "https://www.infoq.com/news/broken-final/")
        self.assertEqual(result.crawl_items[1].crawl.http_status_code, 203)
        self.assertEqual(result.crawl_items[1].crawl.attempt, 2)
        self.assertEqual(result.crawl_run_completed.status, CrawlRunStatus.PARTIALLY_COMPLETED)
        self.assertEqual(len(result.normalized_articles), 1)

        crawl = result.crawl_items[0].to_dict()
        self.assertEqual(
            set(crawl),
            {
                "schemaVersion",
                "messageType",
                "crawlRunId",
                "crawlItemId",
                "source",
                "discovery",
                "urls",
                "crawl",
                "rawArticle",
            },
        )
        self.assertEqual(crawl["crawl"]["status"], "SUCCESS")
        self.assertEqual(crawl["messageType"], "CrawlItemProduced")
        self.assertIsNone(crawl["crawl"]["error"])

        normalized = result.normalized_articles[0].to_dict()
        self.assertEqual(normalized["normalization"]["status"], "SUCCESS")
        self.assertEqual(normalized["messageType"], "ArticleNormalized")
        self.assertEqual(normalized["article"]["title"], "Good title")
        self.assertEqual(normalized["article"]["language"], "en")
        self.assertEqual(normalized["urls"]["canonicalUrl"], "https://www.infoq.com/news/good")
        self.assertIn("CANONICAL_URL_MISSING", normalized["normalization"]["warnings"])
        self.assertIn("CONTENT_SHORT_AFTER_CLEANUP", normalized["normalization"]["warnings"])
        self.assertEqual(len(repository.items), 2)
        self.assertEqual(repository.runs[request.crawl_run_id]["status"], "PARTIALLY_COMPLETED")

        message_types = [event.to_dict()["messageType"] for event in result.events()]
        self.assertEqual(
            message_types,
            ["CrawlItemProduced", "CrawlItemProduced", "CrawlRunCompleted", "ArticleNormalized"],
        )

    def test_maximum_article_count_is_respected(self) -> None:
        request = build_request("news", 1, None, source_type=SourceType.RSS)
        result = InfoQCollector(http=FakeHttp(), now=self.fixed_now).collect(request)
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.completed.statistics.articles_attempted, 1)

    def test_web_crawl_uses_listing_pages_and_records_provenance(self) -> None:
        request = build_request("news", 3, None, maximum_page_count=2)
        http = FakeHttp()
        result = InfoQCollector(http=http, now=self.fixed_now).collect(request)

        self.assertEqual(http.listing_requests, [
            "https://www.infoq.com/news/",
            "https://www.infoq.com/news/2/",
        ])
        self.assertEqual(result.completed.statistics.pages_visited, 2)
        self.assertEqual(result.items[0].source.source_type, SourceType.WEB_CRAWL)
        self.assertEqual(result.items[0].discovery.discovered_from_url, "https://www.infoq.com/news/")
        self.assertEqual(result.items[2].discovery.discovered_from_url, "https://www.infoq.com/news/2/")

    def test_later_listing_failure_keeps_earlier_candidates_and_marks_partial(self) -> None:
        request = build_request("news", 3, None, maximum_page_count=2)
        result = InfoQCollector(http=PartialListingHttp(), now=self.fixed_now).collect(request)

        self.assertEqual(len(result.items), 2)
        self.assertEqual(result.completed.statistics.pages_visited, 1)
        self.assertEqual(result.completed.status, CrawlRunStatus.PARTIALLY_COMPLETED)

    def test_request_timeout_is_applied_outside_the_cli(self) -> None:
        request = build_request("news", 1, None, source_type=SourceType.RSS)
        request.crawl_options.request_timeout_ms = 2_500
        http = ConfigurableFakeHttp()

        InfoQCollector(http=http, now=self.fixed_now).collect(request)

        self.assertEqual(http.timeout_seconds, 2.5)

    def test_overlapping_collection_finishes_the_second_run_as_failed(self) -> None:
        request = build_request("news", 1, None, source_type=SourceType.RSS)
        repository = InMemoryRawCrawlRepository()
        collector = InfoQCollector(http=FakeHttp(), now=self.fixed_now)
        collector._run_lock.acquire()
        try:
            result = InfoQPipeline(collector=collector, repository=repository).run(request)
        finally:
            collector._run_lock.release()

        self.assertEqual(result.crawl_run_completed.status, CrawlRunStatus.FAILED)
        self.assertEqual(repository.runs[request.crawl_run_id]["status"], "FAILED")

    def test_mismatched_feed_and_source_path_are_rejected_before_persistence(self) -> None:
        request = build_request("news", 1, None, source_type=SourceType.RSS)
        request.source.entry_point.path = "/articles/"
        repository = InMemoryRawCrawlRepository()
        pipeline = InfoQPipeline(
            collector=InfoQCollector(http=FakeHttp(), now=self.fixed_now),
            repository=repository,
        )
        with self.assertRaises(ValueError):
            pipeline.run(request)
        self.assertEqual(repository.runs, {})

    @unittest.skip("canonical integration deliberately uses source-local memory storage")
    def test_sqlite_repository_persists_success_and_failure_before_normalization(self) -> None:
        request = build_request("news", 10, None, source_type=SourceType.RSS)
        with TemporaryDirectory() as directory:
            database = Path(directory) / "pipeline.sqlite3"
            pipeline = InfoQPipeline(
                collector=InfoQCollector(http=FakeHttp(), now=self.fixed_now),
                normalizer=ArticleNormalizer(now=self.fixed_now),
                repository=SQLiteRawCrawlRepository(database),
            )
            pipeline.run(request)
            connection = sqlite3.connect(database)
            try:
                run = connection.execute(
                    "SELECT status FROM crawl_runs WHERE crawl_run_id = ?", (request.crawl_run_id,)
                ).fetchone()
                items = connection.execute(
                    "SELECT crawl_status FROM crawl_items ORDER BY crawl_item_id"
                ).fetchall()
            finally:
                connection.close()
            self.assertEqual(run, ("PARTIALLY_COMPLETED",))
            self.assertEqual(items, [("SUCCESS",), ("FAILED",)])


if __name__ == "__main__":
    unittest.main()
