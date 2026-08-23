import pytest
from github_trending_pipeline.errors import GitHubTrendingError
from github_trending_pipeline.urls import (
    canonical_repository_url,
    readme_api_url,
    repository_identity_from_href,
    validate_https_host,
)


def test_repository_links_are_strict_and_canonical():
    assert repository_identity_from_href("/OpenAI/example.repo") == (
        "OpenAI",
        "example.repo",
    )
    assert canonical_repository_url("OpenAI", "example.repo") == (
        "https://github.com/OpenAI/example.repo"
    )
    assert readme_api_url("OpenAI", "example.repo") == (
        "https://api.github.com/repos/OpenAI/example.repo/readme"
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/openai/example",
        "https://evil-github.com/openai/example",
        "https://user@github.com/openai/example",
    ],
)
def test_unsafe_urls_are_rejected(url):
    with pytest.raises(GitHubTrendingError):
        validate_https_host(url, allowed_hosts={"github.com"})


def test_non_repository_routes_are_rejected():
    with pytest.raises(GitHubTrendingError):
        repository_identity_from_href("/openai/example/issues")
