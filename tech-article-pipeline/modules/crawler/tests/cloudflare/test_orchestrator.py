from __future__ import annotations

from datetime import UTC, datetime

from tech_articles_ingestion.http import HttpResponse
from tech_articles_ingestion.orchestrator import CloudflareIngestionOrchestrator
from tech_articles_ingestion.persistence.memory import InMemoryIngestionRepository


class AllowPolicy:
    async def ensure_allowed(self) -> None:
        return None


class FixtureHttpClient:
    def __init__(self, rss: bytes, article: bytes) -> None:
        self.rss = rss
        self.article = article
        self.article_requests = 0

    async def get(self, url, **kwargs):
        if url.endswith("/rss/"):
            return HttpResponse(
                url=url,
                status_code=200,
                headers={"content-type": "application/rss+xml"},
                body=self.rss,
            )
        self.article_requests += 1
        return HttpResponse(
            url="https://blog.cloudflare.com/example-article/",
            status_code=200,
            headers={"content-type": "text/html"},
            body=self.article,
        )


class CollectingSink:
    def __init__(self) -> None:
        self.payloads = []

    async def emit(self, payload):
        self.payloads.append(payload)


async def test_first_run_normalizes_and_second_run_skips_unchanged(config, fixture_dir):
    repository = InMemoryIngestionRepository()
    http = FixtureHttpClient(
        (fixture_dir / "cloudflare-rss.xml").read_bytes(),
        (fixture_dir / "cloudflare-article.html").read_bytes(),
    )
    sink = CollectingSink()
    orchestrator = CloudflareIngestionOrchestrator(
        config,
        repository,
        sink=sink,
        http_client=http,
        policy_checker=AllowPolicy(),
    )
    first = await orchestrator.run_once(requested_at=datetime(2026, 8, 9, 3, 0, tzinfo=UTC))
    second = await orchestrator.run_once(requested_at=datetime(2026, 8, 9, 9, 0, tzinfo=UTC))

    assert first.crawl_run_completed["status"] == "COMPLETED"
    assert len(first.crawl_items_produced) == 1
    assert len(first.normalized_articles) == 1
    assert first.normalized_articles[0]["article"]["language"] == "en"
    assert second.crawl_run_completed["status"] == "COMPLETED"
    assert second.crawl_run_completed["statistics"]["articlesAttempted"] == 0
    assert second.crawl_items_produced == []
    assert second.normalized_articles == []
    assert http.article_requests == 1
    assert len(sink.payloads) == 1
    assert next(iter(repository.source_states.values())).state_version == 1


async def test_normalization_failure_does_not_mark_source_unchanged(config, fixture_dir):
    repository = InMemoryIngestionRepository()
    invalid_article = b"""
        <html><head><link rel="canonical" href="https://blog.cloudflare.com/example-article/"></head>
        <body><div class="article-content">
          <p>This English article deliberately contains an unsupported nested table.</p>
          <table><tr><td><table><tr><td>nested</td></tr></table></td></tr></table>
        </div></body></html>
    """
    http = FixtureHttpClient(
        (fixture_dir / "cloudflare-rss.xml").read_bytes(),
        invalid_article,
    )
    orchestrator = CloudflareIngestionOrchestrator(
        config,
        repository,
        http_client=http,
        policy_checker=AllowPolicy(),
    )
    first = await orchestrator.run_once(requested_at=datetime(2026, 8, 9, 3, 0, tzinfo=UTC))
    second = await orchestrator.run_once(requested_at=datetime(2026, 8, 9, 9, 0, tzinfo=UTC))

    assert first.normalized_articles == []
    assert second.normalized_articles == []
    assert http.article_requests == 2
    assert all(result["status"] == "FAILED" for result in repository.normalization_results.values())
    state = next(iter(repository.source_states.values()))
    assert state.last_successfully_normalized_payload_hash is None
    assert state.state_version == 0
