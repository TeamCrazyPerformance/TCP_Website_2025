from __future__ import annotations

import re
from urllib.parse import quote, urljoin, urlsplit, urlunsplit

from .errors import GitHubTrendingError

GITHUB_HOST = "github.com"
GITHUB_API_HOST = "api.github.com"
GITHUB_BASE_URL = "https://github.com"
TRENDING_URL = "https://github.com/trending?since=daily"
ROBOTS_URL = "https://github.com/robots.txt"

_OWNER_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def validate_https_host(url: str, *, allowed_hosts: set[str]) -> str:
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in allowed_hosts
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
    ):
        raise GitHubTrendingError(
            "UNSAFE_URL",
            "GitHub crawler rejected an unsafe URL.",
            retryable=False,
            details={"url": url},
        )
    return urlunsplit(("https", parsed.hostname, parsed.path or "/", parsed.query, ""))


def validate_repository_identity(owner: str, repository: str) -> tuple[str, str]:
    if not _OWNER_PATTERN.fullmatch(owner) or not _REPOSITORY_PATTERN.fullmatch(repository):
        raise GitHubTrendingError(
            "REPOSITORY_IDENTITY_INVALID",
            "Trending card did not contain a valid GitHub repository identity.",
            retryable=False,
            details={"owner": owner, "repository": repository},
        )
    if repository in {".", ".."}:
        raise GitHubTrendingError(
            "REPOSITORY_IDENTITY_INVALID",
            "Trending card contained a reserved repository path.",
            retryable=False,
        )
    return owner, repository


def repository_identity_from_href(href: str) -> tuple[str, str]:
    absolute = validate_https_host(urljoin(GITHUB_BASE_URL, href), allowed_hosts={GITHUB_HOST})
    parts = [part for part in urlsplit(absolute).path.split("/") if part]
    if len(parts) != 2:
        raise GitHubTrendingError(
            "REPOSITORY_URL_INVALID",
            "Trending card link was not a repository root URL.",
            retryable=False,
            details={"url": absolute},
        )
    return validate_repository_identity(parts[0], parts[1])


def canonical_repository_url(owner: str, repository: str) -> str:
    checked_owner, checked_repository = validate_repository_identity(owner, repository)
    return f"{GITHUB_BASE_URL}/{checked_owner}/{checked_repository}"


def readme_api_url(owner: str, repository: str) -> str:
    checked_owner, checked_repository = validate_repository_identity(owner, repository)
    return (
        f"https://{GITHUB_API_HOST}/repos/"
        f"{quote(checked_owner, safe='')}/{quote(checked_repository, safe='')}/readme"
    )
