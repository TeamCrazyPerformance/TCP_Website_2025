from __future__ import annotations

from datetime import UTC, datetime

import pytest
from feed_article_pipeline import (
    FEED_SOURCE_PROFILES,
    FeedArticlePipeline,
    FeedFetchError,
    FeedHttpClient,
    FeedHttpResult,
)
from tech_article_sources import SourceAdapterRegistry

NOW = datetime(2026, 8, 29, 3, 0, tzinfo=UTC)
ROBOTS_ALLOW_ALL = b"User-agent: *\nAllow: /\n"


def _rss(url: str, *, title: str = "A useful engineering article") -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Official blog</title>
  <item>
    <title>{title}</title>
    <link>{url}</link>
    <pubDate>Fri, 28 Aug 2026 03:00:00 GMT</pubDate>
    <author>Official Engineering Team</author>
  </item>
</channel></rss>""".encode()


RUST_ATOM = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Rust Blog</title>
  <entry>
    <title>Rust 1.90.0</title>
    <link rel="alternate" href="https://blog.rust-lang.org/2026/08/28/Rust-1.90.0/" />
    <updated>2026-08-28T03:00:00Z</updated>
    <author><name>The Rust Release Team</name></author>
    <content type="html">&lt;p&gt;Rust 1.90 improves compiler diagnostics for developers.&lt;/p&gt;
      &lt;pre&gt;&lt;code&gt;cargo update&lt;/code&gt;&lt;/pre&gt;</content>
  </entry>
</feed>"""


ARTICLE_HTML: dict[str, bytes] = {
    "tailscale-blog": b"""<html><head>
      <link rel="canonical" href="https://tailscale.com/blog/new-networking?utm_source=rss">
      <meta property="og:title" content="New networking internals">
      <script type="application/ld+json">{"@type":"BlogPosting","author":{"name":"Tailscale Engineering"},"datePublished":"2026-08-28T03:00:00Z"}</script>
      </head><body><div class="blog-content-prose"><p>Tailscale explains the networking design in technical depth.</p><script>bad()</script></div></body></html>""",
    "hugging-face-blog": b"""<html><head>
      <link rel="canonical" href="https://huggingface.co/blog/new-model">
      <meta property="og:title" content="A new open model">
      </head><body><div class="blog-content"><p>Model architecture, training data, and evaluation details.</p></div></body></html>""",
    "deepmind-blog": b"""<html><head>
      <link rel="canonical" href="https://deepmind.google/blog/new-research/">
      <meta property="og:title" content="New research result">
      </head><body><main><article><p>Researchers describe methods, results, and limitations.</p><aside>Related</aside></article></main></body></html>""",
}


class FakeHttp:
    def __init__(
        self,
        feed_body: bytes,
        *,
        article_body: bytes | None = None,
        robots_body: bytes = ROBOTS_ALLOW_ALL,
    ) -> None:
        self.feed_body = feed_body
        self.article_body = article_body
        self.robots_body = robots_body
        self.user_agent = "TCP-Tech-Article-Pipeline-Test"
        self.article_calls: list[str] = []

    def fetch_robots(self, url: str | None = None) -> FeedHttpResult:
        del url
        return FeedHttpResult(
            body=self.robots_body,
            final_url="https://example.test/robots.txt",
            status_code=200,
            attempt=1,
            content_type="text/plain",
        )

    def fetch_feed(self, *, redirect_guard=None) -> FeedHttpResult:
        del redirect_guard
        return FeedHttpResult(
            body=self.feed_body,
            final_url="https://example.test/feed.xml",
            status_code=200,
            attempt=1,
            content_type="application/xml",
        )

    def fetch_article(self, url: str, *, redirect_guard=None) -> FeedHttpResult:
        self.article_calls.append(url)
        assert self.article_body is not None
        if redirect_guard is not None:
            redirect_guard(url)
        return FeedHttpResult(
            body=self.article_body,
            final_url=url,
            status_code=200,
            attempt=1,
            content_type="text/html",
        )


def _request(source_id: str, section_key: str, *, maximum_age_hours: int = 48) -> dict:
    return {
        "schemaVersion": "1.0",
        "crawlRunId": f"crawl-{source_id}",
        "requestedAt": NOW.isoformat(),
        "source": {
            "sourceId": source_id,
            "sourceType": "RSS",
            "sectionKey": section_key,
        },
        "crawlOptions": {
            "maximumArticleCount": 10,
            "maximumAgeHours": maximum_age_hours,
            "followPagination": False,
            "maximumPageCount": 1,
            "requestTimeoutMs": 15_000,
        },
    }


@pytest.mark.parametrize(
    ("source_id", "article_url"),
    [
        ("tailscale-blog", "https://tailscale.com/blog/new-networking"),
        ("hugging-face-blog", "https://huggingface.co/blog/new-model"),
        ("deepmind-blog", "https://deepmind.google/blog/new-research/"),
    ],
)
def test_page_profiles_share_feed_pipeline_and_keep_source_specific_body_selectors(
    source_id: str, article_url: str
) -> None:
    profile = FEED_SOURCE_PROFILES[source_id]
    http = FakeHttp(_rss(article_url), article_body=ARTICLE_HTML[source_id])

    result = FeedArticlePipeline(profile, http, now=lambda: NOW).run(
        f"crawl-{source_id}", _request(source_id, "BLOG")
    )

    assert result.crawl_run_completed["status"] == "COMPLETED"
    assert result.crawl_run_completed["statistics"]["articlesSucceeded"] == 1
    assert http.article_calls == [article_url]
    normalized = result.normalized_articles[0]
    assert normalized["normalization"]["status"] == "SUCCESS"
    assert normalized["article"]["language"] == "en"
    assert "bad()" not in normalized["article"]["content"]
    assert "Related" not in normalized["article"]["content"]
    assert normalized["urls"]["canonicalUrl"].startswith(profile.base_url)


def test_rust_atom_uses_full_feed_content_without_article_page_request() -> None:
    profile = FEED_SOURCE_PROFILES["rust-blog"]
    http = FakeHttp(RUST_ATOM)

    result = FeedArticlePipeline(profile, http, now=lambda: NOW).run(
        "crawl-rust", _request("rust-blog", "BLOG")
    )

    assert http.article_calls == []
    assert result.crawl_run_completed["status"] == "COMPLETED"
    normalized = result.normalized_articles[0]
    assert normalized["article"]["authors"] == ["The Rust Release Team"]
    assert "cargo update" in normalized["article"]["content"]


def test_page_profile_keeps_robots_403_fail_closed() -> None:
    class RobotsForbiddenHttp(FakeHttp):
        def fetch_robots(self, url: str | None = None) -> FeedHttpResult:
            raise FeedFetchError(
                "SOURCE_ACCESS_FORBIDDEN",
                "robots forbidden",
                retryable=False,
                status_code=403,
                final_url=url,
            )

    profile = FEED_SOURCE_PROFILES["tailscale-blog"]
    http = RobotsForbiddenHttp(
        _rss("https://tailscale.com/blog/example"),
        article_body=ARTICLE_HTML["tailscale-blog"],
    )

    with pytest.raises(FeedFetchError) as exc_info:
        FeedArticlePipeline(profile, http, now=lambda: NOW).run(
            "crawl-tailscale-robots-forbidden", _request("tailscale-blog", "BLOG")
        )

    assert exc_info.value.status_code == 403
    assert http.article_calls == []


def test_age_filter_runs_before_article_page_fetch() -> None:
    profile = FEED_SOURCE_PROFILES["tailscale-blog"]
    old_feed = _rss("https://tailscale.com/blog/old")
    old_feed = old_feed.replace(
        b"Fri, 28 Aug 2026 03:00:00 GMT", b"Fri, 01 Aug 2025 03:00:00 GMT"
    )
    http = FakeHttp(old_feed, article_body=ARTICLE_HTML["tailscale-blog"])

    result = FeedArticlePipeline(profile, http, now=lambda: NOW).run(
        "crawl-old", _request("tailscale-blog", "BLOG")
    )

    assert http.article_calls == []
    assert result.crawl_items == []
    assert result.crawl_run_completed["statistics"]["articlesExcludedByAge"] == 1


def test_registry_adds_new_sources_without_replacing_existing_adapters() -> None:
    registry = SourceAdapterRegistry.default(public_url=None, contact=None)

    assert set(FEED_SOURCE_PROFILES).issubset(registry.source_ids)
    assert "apple-newsroom" not in FEED_SOURCE_PROFILES
    assert "apple-newsroom" not in registry.source_ids
    assert {
        "cloudflare-blog",
        "infoq",
        "sdtimes",
        "github-trending",
    }.issubset(registry.source_ids)


def test_robots_can_allow_feed_but_block_article_pages() -> None:
    profile = FEED_SOURCE_PROFILES["tailscale-blog"]
    http = FakeHttp(
        _rss("https://tailscale.com/blog/blocked"),
        article_body=ARTICLE_HTML["tailscale-blog"],
        robots_body=(
            b"User-agent: *\nAllow: /blog/index.xml\nDisallow: /blog/\n"
        ),
    )

    result = FeedArticlePipeline(profile, http, now=lambda: NOW).run(
        "crawl-blocked", _request("tailscale-blog", "BLOG")
    )

    assert http.article_calls == []
    assert result.crawl_run_completed["status"] == "FAILED"
    assert result.crawl_items[0]["crawl"]["error"]["code"] == "ROBOTS_DISALLOWED"


def test_unapproved_cross_host_redirect_is_reported_as_unsafe(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class RedirectResponse:
        status_code = 302

        def __init__(self) -> None:
            self.headers = {"location": "https://example.invalid/ai/new-model/"}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

    class RedirectClient:
        def __init__(self, **kwargs):
            del kwargs

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def stream(self, method: str, url: str, headers: dict):
            del method, url, headers
            return RedirectResponse()

    monkeypatch.setattr(
        "feed_article_pipeline.http_client.httpx.Client", RedirectClient
    )
    http = FeedHttpClient(
        FEED_SOURCE_PROFILES["deepmind-blog"], maximum_attempts=1
    )

    with pytest.raises(FeedFetchError) as exc_info:
        http.fetch_article("https://deepmind.google/blog/new-model/")

    assert exc_info.value.code == "UNSAFE_REDIRECT"
    assert exc_info.value.final_url == "https://example.invalid/ai/new-model/"


def test_deepmind_configures_a_separate_blog_google_robots_policy() -> None:
    profile = FEED_SOURCE_PROFILES["deepmind-blog"]

    assert "blog.google" in profile.allowed_hosts
    assert "https://blog.google/robots.txt" in profile.robots_urls
