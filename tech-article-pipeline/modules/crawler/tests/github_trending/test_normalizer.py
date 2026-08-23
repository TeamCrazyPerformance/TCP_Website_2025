from datetime import timedelta

from github_trending_pipeline.contracts import CrawlItemProduced
from github_trending_pipeline.normalizer import GitHubTrendingNormalizer


def test_normalizer_builds_article_from_description_and_readme(
    fixed_now, crawl_request, trending_html, readme_html
):
    from github_trending_pipeline.crawler import GitHubTrendingCrawler
    from github_trending_pipeline.parsers import parse_trending_repositories

    repository = parse_trending_repositories(trending_html)[0]
    crawler = GitHubTrendingCrawler(http=None, clock=lambda: fixed_now)  # type: ignore[arg-type]
    item = crawler._success_item(
        crawl_request,
        repository,
        readme_html,
        200,
    )

    normalized_at = fixed_now + timedelta(hours=2)
    result = GitHubTrendingNormalizer(clock=lambda: normalized_at).normalize(item)
    payload = result.model_dump(by_alias=True, mode="json")

    assert payload["normalization"]["status"] == "SUCCESS"
    assert payload["article"]["title"] == "alpha/first"
    assert payload["article"]["authors"] == ["alpha"]
    assert result.article is not None
    assert result.article.original_published_at == item.crawl.crawled_at
    assert result.normalization.normalized_at == normalized_at
    assert payload["article"]["originalPublishedAt"] == "2026-08-22T03:00:00Z"
    assert "PUBLICATION_TIME_APPROXIMATED_FROM_CRAWL" in payload["normalization"][
        "warnings"
    ]
    assert "PUBLICATION_TIME_NOT_AVAILABLE" not in payload["normalization"]["warnings"]
    assert payload["article"]["language"] == "en"
    assert "Python API toolkit" in payload["article"]["content"]
    assert "window.doNotInclude" not in payload["article"]["content"]
    assert "decorative icon" not in payload["article"]["content"]


def test_normalizer_returns_failed_contract_for_empty_readme(fixed_now, crawl_request):
    item = CrawlItemProduced.model_validate(
        {
            "crawlRunId": crawl_request.crawl_run_id,
            "crawlItemId": "item-1",
            "discovery": {
                "entryPointUrl": "https://github.com/trending?since=daily",
                "discoveredFromUrl": "https://github.com/trending?since=daily",
                "rank": 1,
            },
            "urls": {
                "discoveredUrl": "https://github.com/alpha/first",
                "finalUrl": "https://github.com/alpha/first",
                "canonicalUrl": "https://github.com/alpha/first",
            },
            "crawl": {"status": "SUCCESS", "crawledAt": fixed_now},
            "rawArticle": {
                "title": "alpha/first",
                "authors": ["alpha"],
                "contentHtml": "<div><img alt='only image'></div>",
            },
        }
    )

    result = GitHubTrendingNormalizer(clock=lambda: fixed_now).normalize(item)

    assert result.normalization.status == "FAILED"
    assert result.article is None
    assert result.normalization.error.code == "NORMALIZED_REQUIRED_FIELD_MISSING"
