from __future__ import annotations

import httpx
import pytest
from github_trending_pipeline.errors import GitHubTrendingError
from github_trending_pipeline.http_client import GitHubTrendingHttpClient


def test_client_checks_robots_and_fetches_trending(robots_text, trending_html):
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=robots_text)
        return httpx.Response(200, text=trending_html)

    client = GitHubTrendingHttpClient(
        user_agent="TCP-Test/1.0 (+https://example.test; contact=ops@example.test)",
        transport=httpx.MockTransport(handler),
    )
    result = client.fetch_trending()

    assert result.status_code == 200
    assert [request.url.path for request in requests] == ["/robots.txt", "/trending"]
    assert requests[1].url.params["since"] == "daily"
    assert requests[0].headers["user-agent"].startswith("TCP-Test/1.0")


def test_client_requests_rendered_readme_html(readme_html):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "api.github.com"
        assert request.headers["accept"] == "application/vnd.github.html+json"
        assert request.headers["x-github-api-version"] == "2022-11-28"
        return httpx.Response(200, text=readme_html)

    client = GitHubTrendingHttpClient(
        user_agent="TCP-Test/1.0",
        transport=httpx.MockTransport(handler),
    )

    assert "Reliable distributed" in client.fetch_readme("alpha", "first").text


def test_client_rejects_cross_host_redirect(robots_text):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=robots_text)
        return httpx.Response(302, headers={"Location": "https://example.com/trending"})

    client = GitHubTrendingHttpClient(
        user_agent="TCP-Test/1.0",
        transport=httpx.MockTransport(handler),
    )

    with pytest.raises(GitHubTrendingError, match="unsafe URL") as raised:
        client.fetch_trending()
    assert raised.value.code == "UNSAFE_URL"


def test_client_classifies_rate_limit_and_response_size():
    limited = GitHubTrendingHttpClient(
        user_agent="TCP-Test/1.0",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                429,
                headers={"Retry-After": "60", "X-RateLimit-Remaining": "0"},
            )
        ),
    )
    with pytest.raises(GitHubTrendingError) as rate_error:
        limited.fetch_readme("alpha", "first")
    assert rate_error.value.code == "GITHUB_RATE_LIMITED"
    assert rate_error.value.retryable is True

    oversized = GitHubTrendingHttpClient(
        user_agent="TCP-Test/1.0",
        maximum_response_bytes=3,
        transport=httpx.MockTransport(lambda request: httpx.Response(200, content=b"four")),
    )
    with pytest.raises(GitHubTrendingError) as size_error:
        oversized.fetch_readme("alpha", "first")
    assert size_error.value.code == "RESPONSE_TOO_LARGE"
