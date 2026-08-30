from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import ClassVar
from urllib.parse import urljoin

import httpx

from .profiles import FeedSourceProfile
from .urls import normalize_source_url


@dataclass(frozen=True, slots=True)
class FeedHttpResult:
    body: bytes
    final_url: str
    status_code: int
    attempt: int
    content_type: str


class FeedFetchError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool,
        status_code: int | None = None,
        attempt: int = 1,
        final_url: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.status_code = status_code
        self.attempt = attempt
        self.final_url = final_url


class FeedHttpClient:
    _REDIRECT_STATUSES: ClassVar[frozenset[int]] = frozenset({301, 302, 303, 307, 308})
    _RETRYABLE_STATUSES: ClassVar[frozenset[int]] = frozenset({408, 429, 500, 502, 503, 504})

    def __init__(
        self,
        profile: FeedSourceProfile,
        *,
        user_agent: str = "TCP-Tech-Article-Pipeline/0.3",
        timeout_seconds: float = 15.0,
        maximum_attempts: int = 3,
        maximum_redirects: int = 3,
        maximum_response_bytes: int = 2 * 1024 * 1024,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.profile = profile
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds
        self.maximum_attempts = maximum_attempts
        self.maximum_redirects = maximum_redirects
        self.maximum_response_bytes = maximum_response_bytes
        self.sleep = sleep
        self.clock = clock
        self._last_article_request_at: float | None = None

    def fetch_feed(
        self, *, redirect_guard: Callable[[str], None] | None = None
    ) -> FeedHttpResult:
        return self._fetch(
            self.profile.feed_url,
            accept="application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9",
            allowed_content_types={
                "application/atom+xml",
                "application/rss+xml",
                "application/xml",
                "text/xml",
                "text/plain",
            },
            rate_limited=False,
            redirect_guard=redirect_guard,
        )

    def fetch_robots(self, url: str | None = None) -> FeedHttpResult:
        return self._fetch(
            url or self.profile.robots_url,
            accept="text/plain",
            allowed_content_types={"text/plain"},
            rate_limited=False,
            redirect_guard=None,
        )

    def fetch_article(
        self,
        url: str,
        *,
        redirect_guard: Callable[[str], None] | None = None,
    ) -> FeedHttpResult:
        return self._fetch(
            url,
            accept="text/html, application/xhtml+xml;q=0.9",
            allowed_content_types={"text/html", "application/xhtml+xml"},
            rate_limited=True,
            redirect_guard=redirect_guard,
        )

    def _fetch(
        self,
        url: str,
        *,
        accept: str,
        allowed_content_types: set[str],
        rate_limited: bool,
        redirect_guard: Callable[[str], None] | None,
    ) -> FeedHttpResult:
        safe_url = normalize_source_url(url, self.profile.allowed_hosts)
        last_error: FeedFetchError | None = None
        for attempt in range(1, self.maximum_attempts + 1):
            if rate_limited:
                self._wait_for_article_slot()
            try:
                result = self._request_with_redirects(
                    safe_url,
                    accept=accept,
                    allowed_content_types=allowed_content_types,
                    attempt=attempt,
                    redirect_guard=redirect_guard,
                )
                if rate_limited:
                    self._last_article_request_at = self.clock()
                return result
            except FeedFetchError as exc:
                last_error = exc
                if not exc.retryable or attempt == self.maximum_attempts:
                    raise
                self.sleep(self._retry_delay(attempt, None))
        assert last_error is not None
        raise last_error

    def _request_with_redirects(
        self,
        url: str,
        *,
        accept: str,
        allowed_content_types: set[str],
        attempt: int,
        redirect_guard: Callable[[str], None] | None,
    ) -> FeedHttpResult:
        current_url = url
        headers = {
            "User-Agent": self.user_agent,
            "Accept": accept,
            "Accept-Encoding": "identity",
        }
        try:
            with httpx.Client(
                follow_redirects=False,
                timeout=self.timeout_seconds,
                trust_env=False,
                cookies={},
            ) as client:
                for redirect_count in range(self.maximum_redirects + 1):
                    current_url = normalize_source_url(current_url, self.profile.allowed_hosts)
                    with client.stream("GET", current_url, headers=headers) as response:
                        if response.status_code in self._REDIRECT_STATUSES:
                            if redirect_count >= self.maximum_redirects:
                                raise FeedFetchError(
                                    "TOO_MANY_REDIRECTS",
                                    "The source exceeded the redirect limit.",
                                    retryable=False,
                                    status_code=response.status_code,
                                    attempt=attempt,
                                    final_url=current_url,
                                )
                            location = response.headers.get("location")
                            if not location:
                                raise FeedFetchError(
                                    "INVALID_REDIRECT",
                                    "The redirect response did not provide a location.",
                                    retryable=False,
                                    status_code=response.status_code,
                                    attempt=attempt,
                                    final_url=current_url,
                                )
                            redirect_target = urljoin(current_url, location)
                            try:
                                current_url = normalize_source_url(
                                    redirect_target, self.profile.allowed_hosts
                                )
                            except ValueError as exc:
                                raise FeedFetchError(
                                    "UNSAFE_REDIRECT",
                                    "The source redirected outside its allowed hosts.",
                                    retryable=False,
                                    status_code=response.status_code,
                                    attempt=attempt,
                                    final_url=redirect_target,
                                ) from exc
                            if redirect_guard is not None:
                                redirect_guard(current_url)
                            continue
                        if not 200 <= response.status_code <= 299:
                            retryable = response.status_code in self._RETRYABLE_STATUSES
                            raise FeedFetchError(
                                "SOURCE_ACCESS_FORBIDDEN"
                                if response.status_code in {401, 403}
                                else "UPSTREAM_HTTP_ERROR",
                                f"The source returned HTTP {response.status_code}.",
                                retryable=retryable,
                                status_code=response.status_code,
                                attempt=attempt,
                                final_url=current_url,
                            )
                        media_type = (
                            response.headers.get("content-type", "")
                            .split(";", 1)[0]
                            .strip()
                            .lower()
                        )
                        if media_type not in allowed_content_types:
                            raise FeedFetchError(
                                "INVALID_CONTENT_TYPE",
                                "The source returned an unsupported content type.",
                                retryable=False,
                                status_code=response.status_code,
                                attempt=attempt,
                                final_url=current_url,
                            )
                        declared = response.headers.get("content-length")
                        if (
                            declared
                            and declared.isdigit()
                            and int(declared) > self.maximum_response_bytes
                        ):
                            self._raise_too_large(response.status_code, attempt, current_url)
                        body = bytearray()
                        for chunk in response.iter_bytes():
                            body.extend(chunk)
                            if len(body) > self.maximum_response_bytes:
                                self._raise_too_large(response.status_code, attempt, current_url)
                        return FeedHttpResult(
                            body=bytes(body),
                            final_url=current_url,
                            status_code=response.status_code,
                            attempt=attempt,
                            content_type=media_type,
                        )
        except FeedFetchError:
            raise
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            raise FeedFetchError(
                "NETWORK_ERROR",
                "The source request could not be completed.",
                retryable=True,
                attempt=attempt,
                final_url=current_url,
            ) from exc
        raise AssertionError("redirect loop must return or raise")

    def _raise_too_large(self, status: int, attempt: int, url: str) -> None:
        raise FeedFetchError(
            "RESPONSE_TOO_LARGE",
            "The source response exceeded the configured byte limit.",
            retryable=False,
            status_code=status,
            attempt=attempt,
            final_url=url,
        )

    def _wait_for_article_slot(self) -> None:
        if self._last_article_request_at is None:
            return
        remaining = self.profile.minimum_request_interval_seconds - (
            self.clock() - self._last_article_request_at
        )
        if remaining > 0:
            self.sleep(remaining)

    @staticmethod
    def _retry_delay(attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                try:
                    return max(0.0, parsedate_to_datetime(retry_after).timestamp() - time.time())
                except (TypeError, ValueError, OverflowError):
                    pass
        return min(8.0, float(2 ** (attempt - 1)))
