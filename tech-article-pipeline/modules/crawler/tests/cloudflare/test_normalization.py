from __future__ import annotations

from tech_articles_ingestion.article import CloudflareArticleExtractor
from tech_articles_ingestion.contracts import ContractValidator
from tech_articles_ingestion.normalization import ArticleNormalizer
from tech_articles_ingestion.payloads import crawl_success_payload, normalization_input_payload
from tech_articles_ingestion.rss import CloudflareRssParser


def test_normalizer_handles_shiki_backticks_and_table(config, fixture_dir):
    item = (
        CloudflareRssParser(config)
        .parse((fixture_dir / "cloudflare-rss.xml").read_bytes())
        .items[0]
    )
    page = CloudflareArticleExtractor().extract(
        (fixture_dir / "cloudflare-article.html").read_bytes(),
        discovered_url="https://blog.cloudflare.com/example-article/",
        final_url="https://blog.cloudflare.com/example-article/",
        http_status_code=200,
    )
    crawl_output = crawl_success_payload(
        config,
        crawl_run_id="crawl-run-20260809-030000-1234abcd",
        crawl_item_id="crawl-item-20260809-030000-1234abcd-001",
        rss_item=item,
        article=page,
    )
    validator = ContractValidator()
    crawl_output = validator.validate_crawl_item(crawl_output)
    normalized = ArticleNormalizer(config, validator).normalize(
        normalization_input_payload(crawl_output)
    )
    content = normalized["article"]["content"]
    assert "````text\n```radar-chart" in content
    assert '{ "type": "speedFlower" }\n```\n````' in content
    assert "Header 1 | Header 2" in content
    assert r"Value 1 | Value \| 2" in content
    assert "Line A / Line B |" in content
    assert "- First item" in content
    assert "> Quoted text" in content
    assert normalized["article"]["language"] == "en"
    assert normalized["article"]["title"] == "Example & article"


def test_article_extractor_uses_exact_article_content(config, fixture_dir):
    page = CloudflareArticleExtractor().extract(
        (fixture_dir / "cloudflare-article.html").read_bytes(),
        discovered_url="https://blog.cloudflare.com/example-article/",
        final_url="https://blog.cloudflare.com/example-article/",
        http_status_code=200,
    )
    assert page.canonical_url == "https://blog.cloudflare.com/example-article/"
    assert "article-content" not in page.content_html
    assert "deterministic Cloudflare engineering workflow" in page.content_text


def test_normalizer_accepts_text_only_input(config, fixture_dir):
    item = (
        CloudflareRssParser(config)
        .parse((fixture_dir / "cloudflare-rss.xml").read_bytes())
        .items[0]
    )
    page = CloudflareArticleExtractor().extract(
        (fixture_dir / "cloudflare-article.html").read_bytes(),
        discovered_url="https://blog.cloudflare.com/example-article/",
        final_url="https://blog.cloudflare.com/example-article/",
        http_status_code=200,
    )
    validator = ContractValidator()
    crawl_output = validator.validate_crawl_item(
        crawl_success_payload(
            config,
            crawl_run_id="crawl-run-20260809-030000-1234abcd",
            crawl_item_id="crawl-item-20260809-030000-1234abcd-001",
            rss_item=item,
            article=page,
        )
    )
    normalization_input = normalization_input_payload(crawl_output)
    normalization_input["rawArticle"].pop("contentHtml")
    normalized = ArticleNormalizer(config, validator).normalize(normalization_input)
    assert "deterministic Cloudflare engineering workflow" in normalized["article"]["content"]
