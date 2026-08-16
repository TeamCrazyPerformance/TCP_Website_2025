from __future__ import annotations

import copy
from datetime import UTC, datetime

import pytest

from tech_articles_ingestion.article import CloudflareArticleExtractor
from tech_articles_ingestion.contracts import ContractValidator
from tech_articles_ingestion.errors import ContractValidationError
from tech_articles_ingestion.payloads import crawl_success_payload, normalization_input_payload
from tech_articles_ingestion.rss import CloudflareRssParser


def _success_payload(config, fixture_dir):
    feed = CloudflareRssParser(config).parse((fixture_dir / "cloudflare-rss.xml").read_bytes())
    page = CloudflareArticleExtractor().extract(
        (fixture_dir / "cloudflare-article.html").read_bytes(),
        discovered_url="https://blog.cloudflare.com/example-article/",
        final_url="https://blog.cloudflare.com/example-article/",
        http_status_code=200,
    )
    return crawl_success_payload(
        config,
        crawl_run_id="crawl-run-20260809-030000-1234abcd",
        crawl_item_id="crawl-item-20260809-030000-1234abcd-001",
        rss_item=feed.items[0],
        article=page,
    )


def test_crawl_success_contract_round_trip(config, fixture_dir):
    payload = _success_payload(config, fixture_dir)
    validated = ContractValidator().validate_crawl_item(payload)
    assert validated["crawl"]["status"] == "SUCCESS"
    assert validated["rawArticle"]["authors"] == ["Jane Doe", "John Doe"]


def test_crawl_contract_rejects_unknown_nested_field(config, fixture_dir):
    payload = _success_payload(config, fixture_dir)
    payload["crawl"]["unexpected"] = True
    with pytest.raises(ContractValidationError):
        ContractValidator().validate_crawl_item(payload)


def test_crawl_contract_does_not_coerce_attempt(config, fixture_dir):
    payload = _success_payload(config, fixture_dir)
    payload["crawl"]["attempt"] = "1"
    with pytest.raises(ContractValidationError):
        ContractValidator().validate_crawl_item(payload)


def test_crawl_run_semantics_require_balanced_attempts():
    payload = {
        "crawlRunId": "crawl-run-20260809-030000-1234abcd",
        "status": "PARTIALLY_COMPLETED",
        "startedAt": "2026-08-09T03:00:00Z",
        "completedAt": "2026-08-09T03:00:10Z",
        "statistics": {
            "pagesVisited": 2,
            "articlesDiscovered": 2,
            "articlesExcludedByAge": 0,
            "articlesAttempted": 2,
            "articlesSucceeded": 1,
            "articlesFailed": 0,
        },
    }
    with pytest.raises(ContractValidationError):
        ContractValidator().validate_crawl_run(payload)


def test_success_contract_rejects_non_utc_timestamp(config, fixture_dir):
    payload = copy.deepcopy(_success_payload(config, fixture_dir))
    payload["crawl"]["crawledAt"] = datetime.now(UTC).isoformat()
    with pytest.raises(ContractValidationError):
        ContractValidator().validate_crawl_item(payload)


def test_normalization_input_accepts_missing_optional_metadata(config, fixture_dir):
    payload = normalization_input_payload(_success_payload(config, fixture_dir))
    payload["rawArticle"].pop("authors")
    payload["rawArticle"].pop("publishedAtRaw")
    payload["rawArticle"].pop("contentText")
    validated = ContractValidator().validate_normalization_input(payload)
    assert "authors" not in validated["rawArticle"]
    assert validated["rawArticle"]["contentHtml"]
