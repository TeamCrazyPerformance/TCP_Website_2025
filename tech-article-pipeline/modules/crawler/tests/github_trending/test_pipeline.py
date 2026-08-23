from github_trending_pipeline.http_client import HttpResult
from github_trending_pipeline.pipeline import GitHubTrendingPipeline


class PipelineHttp:
    def __init__(self, trending_html: str, readme_html: str) -> None:
        self.trending_html = trending_html
        self.readme_html = readme_html

    def fetch_trending(self) -> HttpResult:
        return HttpResult(self.trending_html, "https://github.com/trending?since=daily", 200, {})

    def fetch_readme(self, owner: str, repository: str) -> HttpResult:
        return HttpResult(self.readme_html, "https://api.github.com/readme", 200, {})


def test_pipeline_emits_source_contracts(
    fixed_now, crawl_request, trending_html, readme_html
):
    result = GitHubTrendingPipeline(
        http=PipelineHttp(trending_html, readme_html),  # type: ignore[arg-type]
        clock=lambda: fixed_now,
    ).run(crawl_request)
    payload = result.model_dump(by_alias=True, mode="json")

    assert payload["crawlRunCompleted"]["status"] == "COMPLETED"
    assert len(payload["crawlItems"]) == 3
    assert len(payload["normalizedArticles"]) == 3
    assert payload["normalizedArticles"][0]["source"] == {
        "sourceId": "github-trending",
        "sourceType": "WEB_CRAWL",
    }
    assert all(
        article["article"]["originalPublishedAt"] == "2026-08-22T03:00:00Z"
        for article in payload["normalizedArticles"]
    )
    assert payload["normalizedArticles"][0]["normalization"]["status"] == "SUCCESS"
