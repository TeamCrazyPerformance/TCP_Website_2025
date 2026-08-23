import unittest
from sdtimes_crawler.url_normalizer import (
    clean_url_rules, make_absolute_url, extract_canonical_from_html, normalize_url_pipeline
)
from sdtimes_crawler.text_normalizer import (
    clean_text_nfkc, clean_title_or_author, extract_article_body_text, parse_to_iso8601_utc
)
from sdtimes_crawler.models import (
    CrawlItemProduced, SourceInfo, DiscoveryInfo, UrlsInfo, CrawlStatus, RawArticle, NormalizationOptions
)
from sdtimes_crawler.normalizer import SDTimesNormalizer
from sdtimes_crawler.crawler import SDTimesCrawler


class TestSDTimesPipeline(unittest.TestCase):

    def test_crawler_rejects_lookalike_and_insecure_hosts(self):
        with self.assertRaises(ValueError):
            SDTimesCrawler._validate_url("https://evil-sdtimes.com/article")
        with self.assertRaises(ValueError):
            SDTimesCrawler._validate_url("http://sdtimes.com/article")
        self.assertEqual(
            SDTimesCrawler._validate_url("https://www.sdtimes.com/article"),
            "https://www.sdtimes.com/article",
        )

    def test_normalizer_rejects_off_domain_canonical(self):
        _, _, canonical = normalize_url_pipeline(
            discovered_url="https://sdtimes.com/news/sample",
            final_url="https://sdtimes.com/news/sample",
            html_content='<link rel="canonical" href="https://evil.example/stolen">',
        )
        self.assertEqual(canonical, "https://sdtimes.com/news/sample")

    def test_url_normalization_tracking_params(self):
        url = "https://sdtimes.com/ai/article-1/?utm_source=twitter&utm_medium=social&fbclid=12345#section1"
        cleaned = clean_url_rules(url)
        self.assertEqual(cleaned, "https://sdtimes.com/ai/article-1")

    def test_url_normalization_canonical_head_extraction(self):
        html = """
        <html>
        <head>
            <link rel="canonical" href="https://sdtimes.com/ai/article-canonical/" />
        </head>
        <body></body>
        </html>
        """
        disc, fin, canon = normalize_url_pipeline(
            discovered_url="/ai/article-canonical?ref=123",
            final_url="https://sdtimes.com/ai/article-canonical?ref=123",
            html_content=html
        )
        self.assertEqual(disc, "https://sdtimes.com/ai/article-canonical?ref=123")
        self.assertEqual(canon, "https://sdtimes.com/ai/article-canonical")

    def test_text_nfkc_and_whitespace_compression(self):
        raw_text = "  Hello \t World &amp;  SD Times!  \n\n\n\n Paragraph  2   "
        cleaned = clean_text_nfkc(raw_text)
        self.assertEqual(cleaned, "Hello World & SD Times!\n\nParagraph 2")

    def test_date_parsing_iso8601_utc(self):
        raw_date = "Fri, 07 Aug 2026 17:41:48 +0000"
        parsed = parse_to_iso8601_utc(raw_date)
        self.assertEqual(parsed, "2026-08-07T17:41:48Z")

    def test_boilerplate_removal(self):
        html = """
        <html>
        <body>
            <nav>GNB Navigation Menu</nav>
            <div class="entry-content">
                <p>This is the core news content paragraph 1.</p>
                <div class="sdt-in-article-ad">Advertisement content</div>
                <p>This is paragraph 2 of the news story.</p>
            </div>
            <footer>Footer Copyright 2026</footer>
        </body>
        </html>
        """
        extracted = extract_article_body_text(html)
        self.assertIn("core news content paragraph 1", extracted)
        self.assertIn("paragraph 2 of the news story", extracted)
        self.assertNotIn("GNB Navigation Menu", extracted)
        self.assertNotIn("Advertisement content", extracted)
        self.assertNotIn("Footer Copyright", extracted)

    def test_normalizer_full_document(self):
        item = CrawlItemProduced(
            schemaVersion="1.0",
            crawlRunId="crawl-run-20260809-000001",
            crawlItemId="crawl-item-20260809-000001-001",
            source=SourceInfo(sourceId="sdtimes", sourceType="WEB_CRAWL"),
            discovery=DiscoveryInfo(
                entryPointUrl="https://sdtimes.com/",
                discoveredFromUrl="https://sdtimes.com/",
                sourcePath="/",
                sectionKey="NEWS"
            ),
            urls=UrlsInfo(
                discoveredUrl="https://sdtimes.com/news/sample/?utm_medium=cpc#hash",
                finalUrl="https://sdtimes.com/news/sample/?utm_medium=cpc#hash"
            ),
            crawl=CrawlStatus(status="SUCCESS", crawledAt="2026-08-09T00:00:00Z"),
            rawArticle=RawArticle(
                title=" Test  Article  &amp; Title ",
                authors=[" John Doe "],
                publishedAtRaw="2026-08-07T17:41:48+00:00",
                contentHtml="<div class='entry-content'><p>Sample body text paragraph for testing normalizer.</p></div>",
                contentText="Sample body text paragraph for testing normalizer."
            )
        )

        normalizer = SDTimesNormalizer()
        doc = normalizer.normalize(item, NormalizationOptions())

        self.assertEqual(doc.article.title, "Test Article & Title")
        self.assertEqual(doc.article.authors, ["John Doe"])
        self.assertEqual(doc.article.originalPublishedAt, "2026-08-07T17:41:48Z")
        self.assertEqual(doc.urls.canonicalUrl, "https://sdtimes.com/news/sample")
        self.assertEqual(doc.normalization.status, "SUCCESS")


if __name__ == "__main__":
    unittest.main()
