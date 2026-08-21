from __future__ import annotations

from github_trending_pipeline.crawler import GitHubTrendingCrawler
from github_trending_pipeline.errors import GitHubTrendingError
from github_trending_pipeline.http_client import HttpResult


class FakeHttp:
    def __init__(self, trending_html: str, readme_html: str, failures=()) -> None:
        self.trending_html = trending_html
        self.readme_html = readme_html
        self.failures = set(failures)
        self.readme_calls: list[str] = []

    def fetch_trending(self) -> HttpResult:
        return HttpResult(self.trending_html, "https://github.com/trending?since=daily", 200, {})

    def fetch_readme(self, owner: str, repository: str) -> HttpResult:
        full_name = f"{owner}/{repository}"
        self.readme_calls.append(full_name)
        if full_name in self.failures:
            raise GitHubTrendingError(
                "README_NOT_FOUND",
                "missing",
                retryable=False,
                status_code=404,
            )
        return HttpResult(self.readme_html, f"https://api.github.com/repos/{full_name}/readme", 200, {})


def test_crawler_attempts_only_fixed_top_three(
    fixed_now, crawl_request, trending_html, readme_html
):
    http = FakeHttp(trending_html, readme_html, failures={"bravo/second"})
    items, completion = GitHubTrendingCrawler(
        http, clock=lambda: fixed_now
    ).collect(crawl_request)

    assert http.readme_calls == ["alpha/first", "bravo/second", "charlie/third"]
    assert "delta/fourth" not in http.readme_calls
    assert [item.crawl.status for item in items] == ["SUCCESS", "FAILED", "SUCCESS"]
    assert completion.status == "PARTIALLY_COMPLETED"
    assert completion.statistics.articles_discovered == 4
    assert completion.statistics.articles_attempted == 3
    assert completion.statistics.articles_succeeded == 2
    assert completion.statistics.articles_failed == 1


def test_crawler_marks_all_failures_as_failed(fixed_now, crawl_request, trending_html, readme_html):
    http = FakeHttp(
        trending_html,
        readme_html,
        failures={"alpha/first", "bravo/second", "charlie/third"},
    )

    _, completion = GitHubTrendingCrawler(http, clock=lambda: fixed_now).collect(crawl_request)

    assert completion.status == "FAILED"
    assert completion.error.code == "ALL_CRAWL_ITEMS_FAILED"
    assert completion.error.retryable is False
