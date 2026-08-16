from __future__ import annotations

import os
from dataclasses import replace

import pytest

from tech_articles_ingestion.article import CloudflareArticleExtractor
from tech_articles_ingestion.contracts import ContractValidator
from tech_articles_ingestion.http import SafeHttpClient
from tech_articles_ingestion.normalization import ArticleNormalizer
from tech_articles_ingestion.payloads import crawl_success_payload, normalization_input_payload
from tech_articles_ingestion.policy import CloudflarePolicyChecker
from tech_articles_ingestion.rss import CloudflareRssParser
from tech_articles_ingestion.urls import normalize_cloudflare_url

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_CRAWL") != "1",
    reason="set RUN_LIVE_CRAWL=1 to access the live Cloudflare Blog",
)


async def test_live_cloudflare_rss_article_and_normalization(config):
    config = replace(
        config,
        public_url=os.environ["CRAWLER_PUBLIC_URL"],
        contact=os.environ["CRAWLER_CONTACT"],
        maximum_article_count=1,
    )
    config.validate()
    client = SafeHttpClient(config)
    await CloudflarePolicyChecker(config, client).ensure_allowed()
    rss_response = await client.get(
        config.rss_url,
        accept="application/rss+xml, application/xml;q=0.9",
        allowed_content_types={"application/rss+xml", "application/xml", "text/xml"},
        error_prefix="RSS",
    )
    feed = CloudflareRssParser(config).parse(rss_response.body)
    item = next(
        item
        for item in feed.items
        if item.guid and item.link and item.title and item.source_payload_hash
    )
    discovered_url = normalize_cloudflare_url(item.link)
    article_response = await client.get(
        discovered_url,
        accept="text/html, application/xhtml+xml;q=0.9",
        allowed_content_types={"text/html", "application/xhtml+xml"},
        error_prefix="ARTICLE",
    )
    page = CloudflareArticleExtractor().extract(
        article_response.body,
        discovered_url=discovered_url,
        final_url=article_response.url,
        http_status_code=article_response.status_code,
    )
    validator = ContractValidator()
    crawl_output = validator.validate_crawl_item(
        crawl_success_payload(
            config,
            crawl_run_id="crawl-run-20260809-030000-live0001",
            crawl_item_id="crawl-item-20260809-030000-live0001-001",
            rss_item=item,
            article=page,
        )
    )
    normalized = ArticleNormalizer(config, validator).normalize(
        normalization_input_payload(crawl_output)
    )
    assert normalized["article"]["title"]
    assert normalized["article"]["content"]
    assert normalized["article"]["language"] == "en"
