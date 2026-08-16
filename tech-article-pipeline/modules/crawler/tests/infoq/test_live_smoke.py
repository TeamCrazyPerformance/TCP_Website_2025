from __future__ import annotations

import os
import unittest

from technical_news_pipeline.cli import build_request
from technical_news_pipeline.contracts import ExecutionStatus, SourceType
from technical_news_pipeline.http_client import InfoQHttpClient
from technical_news_pipeline.infoq import InfoQCollector
from technical_news_pipeline.pipeline import InfoQPipeline
from technical_news_pipeline.storage import InMemoryRawCrawlRepository


RUN_LIVE_SMOKE = os.environ.get("RUN_LIVE_SMOKE") == "1"


@unittest.skipUnless(
    RUN_LIVE_SMOKE,
    "Set RUN_LIVE_SMOKE=1 to run live InfoQ network smoke tests.",
)
class LiveInfoQSmokeTests(unittest.TestCase):
    def test_web_crawl_and_rss_reach_and_normalize_one_live_article(self) -> None:
        for source_type in (SourceType.WEB_CRAWL, SourceType.RSS):
            with self.subTest(source_type=source_type.value):
                request = build_request(
                    "news",
                    maximum_article_count=1,
                    maximum_age_hours=None,
                    source_type=source_type,
                    maximum_page_count=1,
                )
                result = InfoQPipeline(
                    collector=InfoQCollector(
                        http=InfoQHttpClient(
                            timeout_seconds=15,
                            user_agent=(
                                "TCP-Tech-Article-Pipeline-Live-Smoke/0.2 "
                                f"(+{os.environ['CRAWLER_PUBLIC_URL']}; "
                                f"contact={os.environ['CRAWLER_CONTACT']})"
                            ),
                        )
                    ),
                    repository=InMemoryRawCrawlRepository(),
                ).run(request)

                self.assertEqual(len(result.crawl_items), 1)
                item = result.crawl_items[0]
                self.assertIs(item.crawl.status, ExecutionStatus.SUCCESS)
                self.assertEqual(item.crawl.http_status_code, 200)
                self.assertIsNotNone(item.urls.final_url)
                self.assertEqual(len(result.normalized_articles), 1)

                normalized = result.normalized_articles[0]
                self.assertIs(normalized.normalization.status, ExecutionStatus.SUCCESS)
                self.assertIsNotNone(normalized.article)
                self.assertTrue(normalized.article.title.strip())
                self.assertTrue(normalized.article.content.strip())
                self.assertIsNotNone(normalized.urls.canonical_url)


if __name__ == "__main__":
    unittest.main()
