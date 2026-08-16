from __future__ import annotations

import unittest
from datetime import datetime, timezone

from technical_news_pipeline.contracts import (
    ArticleUrls,
    CrawlExecution,
    CrawlItemProduced,
    Discovery,
    ExecutionStatus,
    RawArticle,
    SourceIdentity,
    SourceType,
)
from technical_news_pipeline.deduplication_v1 import create_fingerprints
from technical_news_pipeline.normalizer import ArticleNormalizer
from technical_news_pipeline.text_normalization import normalize_article_text, normalize_inline_text


class NormalizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 9, 1, 2, 3, tzinfo=timezone.utc)

    def item(self, *, canonical_url: str | None, final_url: str, content: str) -> CrawlItemProduced:
        return CrawlItemProduced(
            crawl_run_id="crawl-run-1",
            crawl_item_id="crawl-item-1",
            source=SourceIdentity(source_id="example", source_type=SourceType.WEB_CRAWL),
            discovery=Discovery(
                entry_point_url="https://example.com/news",
                discovered_from_url="https://example.com/news",
                source_path="/news/",
                section_key="NEWS",
            ),
            urls=ArticleUrls(
                discovered_url="https://example.com/article?utm_source=list",
                final_url=final_url,
                canonical_url=canonical_url,
            ),
            crawl=CrawlExecution(
                status=ExecutionStatus.SUCCESS,
                crawled_at=self.now,
                crawler_version="1.0.0",
                http_status_code=200,
                attempt=1,
                error=None,
            ),
            raw_article=RawArticle(
                title="  ＡＰＩ&nbsp; Update  ",
                authors=["  Ｊａｎｅ&nbsp; Doe  "],
                published_at_raw="2026-08-09T00:00:00Z",
                content_html=None,
                content_text=content,
                language_hint="en",
            ),
        )

    def test_inline_text_decodes_entities_applies_nfkc_and_collapses_whitespace(self) -> None:
        self.assertEqual(normalize_inline_text(" Ａ&nbsp;  Ｂ "), "A B")

    def test_article_text_preserves_one_blank_line_between_paragraphs(self) -> None:
        value = " Ｆｉｒｓｔ\t line\r\n\r\n\r\n Second&nbsp; paragraph "
        self.assertEqual(normalize_article_text(value), "First line\n\nSecond paragraph")

    def test_normalizer_cleans_fields_and_canonical_url_without_changing_version(self) -> None:
        result = ArticleNormalizer(now=lambda: self.now).normalize(
            self.item(
                canonical_url="HTTPS://EXAMPLE.COM:443/article/?utm_source=x&b=2#a",
                final_url="https://example.com/fallback/",
                content="Ｃａｆｅ\u0301  text\r\n\r\n\r\nNext\tparagraph",
            )
        )
        payload = result.to_dict()
        self.assertEqual(payload["article"]["title"], "API Update")
        self.assertEqual(payload["article"]["authors"], ["Jane Doe"])
        self.assertEqual(payload["article"]["content"], "Café text\n\nNext paragraph")
        self.assertEqual(payload["urls"]["canonicalUrl"], "https://example.com/article?b=2")
        self.assertEqual(payload["normalization"]["normalizerVersion"], "1.0.0")

    def test_final_url_fallback_is_normalized(self) -> None:
        result = ArticleNormalizer(now=lambda: self.now).normalize(
            self.item(
                canonical_url=None,
                final_url="HTTPS://EXAMPLE.COM:443/fallback/?gclid=x#part",
                content="body",
            )
        )
        self.assertEqual(result.urls.canonical_url, "https://example.com/fallback")
        self.assertIn("CANONICAL_URL_MISSING", result.normalization.warnings)

    def test_equivalent_normalized_content_produces_the_same_hash(self) -> None:
        left = normalize_article_text("Ａ  B\r\n\r\nCafé")
        right = normalize_article_text("A B\n\nCafe\u0301")
        self.assertEqual(left, right)
        self.assertEqual(create_fingerprints(left), create_fingerprints(right))


if __name__ == "__main__":
    unittest.main()
