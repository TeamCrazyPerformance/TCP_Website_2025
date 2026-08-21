from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import httpx

from .errors import GitHubTrendingError
from .urls import (
    GITHUB_API_HOST,
    GITHUB_HOST,
    ROBOTS_URL,
    TRENDING_URL,
    readme_api_url,
    validate_https_host,
)


@dataclass(frozen=True, slots=True)
class HttpResult:
    text: str
    final_url: str
    status_code: int
    headers: dict[str, str]


class GitHubTrendingHttpClient:
    def __init__(
        self,
        *,
        user_agent: str,
        timeout_seconds: float = 15.0,
        maximum_response_bytes: int = 1_048_576,
        maximum_redirects: int = 3,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not user_agent.strip():
            raise ValueError("user_agent is required")
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds
        self.maximum_response_bytes = maximum_response_bytes
        self.maximum_redirects = maximum_redirects
        self._client = httpx.Client(
            timeout=timeout_seconds,
            follow_redirects=False,
            transport=transport,
            headers={"User-Agent": user_agent},
        )

    def close(self) -> None:
        self._client.close()

    def fetch_trending(self) -> HttpResult:
        robots = self._get(
            ROBOTS_URL,
            allowed_hosts={GITHUB_HOST},
            accept="text/plain",
            not_found_code="ROBOTS_NOT_FOUND",
        )
        parser = RobotFileParser()
        parser.set_url(ROBOTS_URL)
        parser.parse(robots.text.splitlines())
        if not parser.can_fetch(self.user_agent, TRENDING_URL):
            raise GitHubTrendingError(
                "ROBOTS_DISALLOWED",
                "GitHub robots policy disallows the Trending entry point.",
                retryable=False,
            )
        return self._get(
            TRENDING_URL,
            allowed_hosts={GITHUB_HOST},
            accept="text/html",
            not_found_code="TRENDING_NOT_FOUND",
        )

    def fetch_readme(self, owner: str, repository: str) -> HttpResult:
        return self._get(
            readme_api_url(owner, repository),
            allowed_hosts={GITHUB_API_HOST},
            accept="application/vnd.github.html+json",
            not_found_code="README_NOT_FOUND",
            extra_headers={"X-GitHub-Api-Version": "2022-11-28"},
        )

    def _get(
        self,
        url: str,
        *,
        allowed_hosts: set[str],
        accept: str,
        not_found_code: str,
        extra_headers: dict[str, str] | None = None,
    ) -> HttpResult:
        current = validate_https_host(url, allowed_hosts=allowed_hosts)
        headers = {"Accept": accept, **(extra_headers or {})}
        for redirect_count in range(self.maximum_redirects + 1):
            try:
                with self._client.stream("GET", current, headers=headers) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location or redirect_count >= self.maximum_redirects:
                            raise GitHubTrendingError(
                                "REDIRECT_INVALID",
                                "GitHub response exceeded or omitted the redirect target.",
                                retryable=False,
                                status_code=response.status_code,
                            )
                        current = validate_https_host(
                            urljoin(current, location), allowed_hosts=allowed_hosts
                        )
                        continue
                    self._raise_for_status(response, not_found_code=not_found_code)
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > self.maximum_response_bytes:
                            raise GitHubTrendingError(
                                "RESPONSE_TOO_LARGE",
                                "GitHub response exceeded the configured byte limit.",
                                retryable=False,
                                status_code=response.status_code,
                            )
                    encoding = response.encoding or "utf-8"
                    return HttpResult(
                        text=bytes(body).decode(encoding, errors="replace"),
                        final_url=str(response.url),
                        status_code=response.status_code,
                        headers={key.lower(): value for key, value in response.headers.items()},
                    )
            except GitHubTrendingError:
                raise
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                raise GitHubTrendingError(
                    "UPSTREAM_NETWORK_ERROR",
                    "GitHub request failed before a response was received.",
                    retryable=True,
                    details={"exceptionType": type(exc).__name__},
                ) from exc
        raise AssertionError("redirect loop must return or raise")

    @staticmethod
    def _raise_for_status(response: httpx.Response, *, not_found_code: str) -> None:
        status = response.status_code
        if status < 400:
            return
        details: dict[str, object] = {}
        for name in ("retry-after", "x-ratelimit-remaining", "x-ratelimit-reset"):
            if value := response.headers.get(name):
                details[name] = value
        if status == 404:
            code, retryable = not_found_code, False
        elif status in {403, 429}:
            code, retryable = "GITHUB_RATE_LIMITED", True
        elif status >= 500:
            code, retryable = "UPSTREAM_HTTP_ERROR", True
        else:
            code, retryable = "UPSTREAM_HTTP_ERROR", False
        raise GitHubTrendingError(
            code,
            f"GitHub returned HTTP {status}.",
            retryable=retryable,
            status_code=status,
            details=details,
        )
