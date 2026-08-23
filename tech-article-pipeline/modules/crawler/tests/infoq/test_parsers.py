from __future__ import annotations

import unittest

from technical_news_pipeline.parsers import ParseError, parse_infoq_feed, parse_infoq_listing, parse_infoq_page
from technical_news_pipeline.urls import (
    normalize_canonical_url,
    normalize_url,
    validate_infoq_article_url,
    validate_infoq_listing_url,
    validate_infoq_robots_url,
)


RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <item>
      <title>First story</title>
      <link>https://www.infoq.com/news/first-story/?utm_source=rss</link>
      <guid>infoq-news-1</guid>
      <dc:creator>Jane Doe</dc:creator>
      <dc:date>2026-08-05T01:00:00Z</dc:date>
    </item>
    <item>
      <title>Wrong content type</title>
      <link>https://www.infoq.com/articles/not-news/</link>
    </item>
    <item>
      <title>Presentation</title>
      <link>https://www.infoq.com/presentations/not-allowed/</link>
    </item>
    <item>
      <title>Duplicate tracking URL</title>
      <link>https://www.infoq.com/news/first-story/?utm_campaign=again</link>
    </item>
  </channel>
</rss>
"""

PAGE = """<!doctype html>
<html lang="en"><head>
  <link rel="canonical" href="https://www.infoq.com/news/first-story/">
  <meta property="article:published_time" content="2026-08-05T01:00:00Z">
  <meta name="author" content="Jane Doe">
</head><body>
  <h1> First story </h1>
  <div class="article__data">
    <p>Useful <strong>technical</strong> text.</p>
    <img src="inline.png" alt="inline illustration">
    <script>bad()</script><style>.bad {}</style>
    <div class="nocontent">Do not retain this.</div>
    <div class="related__vc">Related promotion.</div>
    <div class="author-section-full">About the Author Jane Doe</div>
    <p>Second paragraph.</p>
  </div>
  <footer>This must remain outside the captured article.</footer>
</body></html>"""

LISTING = """<html><body>
<a href="/news/2026/08/first-story/">First</a>
<a href="https://www.infoq.com/news/2026/08/second-story/?utm_source=list">Second</a>
<a href="/news/2/">Older</a>
<a href="/articles/wrong-type/">Wrong type</a>
<a href="/presentations/wrong/">Wrong content</a>
<a href="/news/2026/08/first-story/">Duplicate</a>
</body></html>"""


class UrlAndParserTests(unittest.TestCase):
    def test_tracking_parameters_are_removed(self) -> None:
        self.assertEqual(
            normalize_url("https://www.infoq.com/news/x?utm_source=a&b=2&a=1#part"),
            "https://www.infoq.com/news/x/?a=1&b=2",
        )

    def test_canonical_url_uses_common_identity_rules(self) -> None:
        self.assertEqual(
            normalize_canonical_url(
                "HTTPS://EXAMPLE.COM:443/news/x/?utm_source=a&ref=list&b=2#part"
            ),
            "https://example.com/news/x?b=2",
        )

    def test_only_allowed_article_urls_pass(self) -> None:
        with self.assertRaises(ValueError):
            validate_infoq_article_url("http://www.infoq.com/news/x/")
        with self.assertRaises(ValueError):
            validate_infoq_article_url("https://evil.example/news/x/")
        with self.assertRaises(ValueError):
            validate_infoq_article_url("https://www.infoq.com/presentations/x/")
        with self.assertRaises(ValueError):
            validate_infoq_article_url("https://www.infoq.com/news/2/")

    def test_robots_redirect_targets_stay_on_the_exact_infoq_path(self) -> None:
        self.assertEqual(
            validate_infoq_robots_url("https://www.infoq.com/robots.txt"),
            "https://www.infoq.com/robots.txt",
        )
        with self.assertRaises(ValueError):
            validate_infoq_robots_url("https://evil.example/robots.txt")
        with self.assertRaises(ValueError):
            validate_infoq_robots_url("https://www.infoq.com/news/")

    def test_listing_parser_returns_only_articles_for_the_source_path(self) -> None:
        listing_url = validate_infoq_listing_url("https://www.infoq.com/news/")
        candidates = parse_infoq_listing(LISTING, listing_url, "/news/")
        self.assertEqual(
            [candidate.discovered_url for candidate in candidates],
            [
                "https://www.infoq.com/news/2026/08/first-story/",
                "https://www.infoq.com/news/2026/08/second-story/",
            ],
        )
        self.assertTrue(all(candidate.discovered_from_url == listing_url for candidate in candidates))

    def test_news_feed_filters_wrong_paths_and_collapses_repeated_candidate_urls(self) -> None:
        candidates = parse_infoq_feed(RSS, "https://feed.infoq.com/news/")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].discovered_url, "https://www.infoq.com/news/first-story/")
        self.assertEqual(candidates[0].authors, ["Jane Doe"])

    def test_page_parser_extracts_exact_article_container(self) -> None:
        page = parse_infoq_page(PAGE, "https://www.infoq.com/news/first-story/")
        self.assertEqual(page.title, "First story")
        self.assertEqual(page.authors, ["Jane Doe"])
        self.assertEqual(page.content_text, "Useful technical text.\n\nSecond paragraph.")
        self.assertIn("Useful technical text.", page.content_text)
        self.assertIn("Second paragraph.", page.content_text)
        self.assertNotIn("bad()", page.content_text)
        self.assertNotIn("Do not retain", page.content_text)
        self.assertNotIn("Related promotion", page.content_text)
        self.assertNotIn("About the Author", page.content_text)
        self.assertNotIn("outside the captured article", page.content_html)

    def test_page_parser_uses_og_url_when_canonical_is_missing_or_invalid(self) -> None:
        with_og_url = PAGE.replace(
            '<link rel="canonical" href="https://www.infoq.com/news/first-story/">',
            '<meta property="og:url" content="https://www.infoq.com/news/og-story/?utm_source=x">',
        )
        page = parse_infoq_page(with_og_url, "https://www.infoq.com/news/final-story/")
        self.assertEqual(page.canonical_url, "https://www.infoq.com/news/og-story/")

        invalid_canonical = with_og_url.replace(
            '<meta property="og:url" content="https://www.infoq.com/news/og-story/?utm_source=x">',
            '<link rel="canonical" href="https://evil.example/news/wrong/">'
            '<meta property="og:url" content="https://www.infoq.com/news/og-story/">',
        )
        page = parse_infoq_page(invalid_canonical, "https://www.infoq.com/news/final-story/")
        self.assertEqual(page.canonical_url, "https://www.infoq.com/news/og-story/")

    def test_page_parser_rejects_missing_or_multiple_containers(self) -> None:
        with self.assertRaises(ParseError) as missing:
            parse_infoq_page("<html><body></body></html>", "https://www.infoq.com/news/x/")
        self.assertEqual(missing.exception.code, "BODY_STRUCTURE_CHANGED")

        duplicated = PAGE.replace("</body>", '<div class="article__data">other</div></body>')
        with self.assertRaises(ParseError) as multiple:
            parse_infoq_page(duplicated, "https://www.infoq.com/news/x/")
        self.assertEqual(multiple.exception.details["matchedCount"], 2)


if __name__ == "__main__":
    unittest.main()
