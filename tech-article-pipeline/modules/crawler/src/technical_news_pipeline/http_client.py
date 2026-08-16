from __future__ import annotations

import time
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .urls import (
    validate_infoq_article_url,
    validate_infoq_feed_url,
    validate_infoq_listing_url,
    validate_infoq_robots_url,
)


MAX_RESPONSE_BYTES = 2 * 1024 * 1024
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


@dataclass(slots=True)
class HttpResult:
    body: str
    final_url: str
    status_code: int
    attempt: int


class FetchError(RuntimeError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool,
        status_code: int | None = None,
        attempt: int = 1,
        final_url: str | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.status_code = status_code
        self.attempt = attempt
        self.final_url = final_url
        self.details = details


class _SafeRedirectHandler(HTTPRedirectHandler):
    def __init__(self, validator: Callable[[str], str] | None, maximum_redirects: int) -> None:
        super().__init__()
        self.validator = validator
        self.maximum_redirects = maximum_redirects

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        redirects = getattr(req, "_infoq_redirects", 0) + 1
        if redirects > self.maximum_redirects:
            raise FetchError(
                "TOO_MANY_REDIRECTS",
                f"response exceeded {self.maximum_redirects} redirects",
                retryable=False,
                status_code=code,
            )
        target = urljoin(req.full_url, newurl)
        if self.validator:
            try:
                target = self.validator(target)
            except ValueError as exc:
                raise FetchError(
                    "UNSAFE_REDIRECT",
                    f"redirect target was rejected: {exc}",
                    retryable=False,
                    status_code=code,
                    final_url=target,
                ) from exc
        redirected = super().redirect_request(req, fp, code, msg, headers, target)
        if redirected is not None:
            setattr(redirected, "_infoq_redirects", redirects)
        return redirected


class InfoQHttpClient:
    def __init__(
        self,
        *,
        timeout_seconds: float = 15.0,
        maximum_attempts: int = 3,
        minimum_article_interval_seconds: float = 3.0,
        maximum_response_bytes: int = MAX_RESPONSE_BYTES,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        user_agent: str = "TCP-Tech-Article-Pipeline/0.2",
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.maximum_attempts = maximum_attempts
        self.minimum_article_interval_seconds = minimum_article_interval_seconds
        self.maximum_response_bytes = maximum_response_bytes
        self.sleep = sleep
        self.clock = clock
        self.user_agent = user_agent
        self._last_article_request_at: float | None = None

    def fetch_feed(self, url: str) -> HttpResult:
        safe_url = validate_infoq_feed_url(url)
        return self._fetch(safe_url, validator=validate_infoq_feed_url, rate_limited=False)

    def fetch_listing(self, url: str, source_path: str) -> HttpResult:
        validator = lambda target: validate_infoq_listing_url(target, expected_path=source_path)
        safe_url = validator(url)
        return self._fetch(safe_url, validator=validator, rate_limited=False)

    def fetch_robots(self, url: str) -> HttpResult:
        safe_url = validate_infoq_robots_url(url)
        return self._fetch(safe_url, validator=validate_infoq_robots_url, rate_limited=False)

    def fetch_article(self, url: str) -> HttpResult:
        safe_url = validate_infoq_article_url(url)
        return self._fetch(safe_url, validator=validate_infoq_article_url, rate_limited=True)

    def _fetch(
        self,
        url: str,
        *,
        validator: Callable[[str], str] | None,
        rate_limited: bool,
    ) -> HttpResult:
        opener = build_opener(_SafeRedirectHandler(validator, maximum_redirects=3))
        last_error: FetchError | None = None
        for attempt in range(1, self.maximum_attempts + 1):
            if rate_limited:
                self._wait_for_article_slot()
            request = Request(
                url,
                headers={
                    "User-Agent": self.user_agent,
                    "Accept": "application/rss+xml, application/xml, text/html;q=0.9, */*;q=0.1",
                },
            )
            if rate_limited:
                self._last_article_request_at = self.clock()
            try:
                with opener.open(request, timeout=self.timeout_seconds) as response:
                    status = int(response.status)
                    body = self._read_limited(response)
                    charset = response.headers.get_content_charset() or "utf-8"
                    try:
                        decoded = body.decode(charset, errors="replace")
                    except LookupError:
                        decoded = body.decode("utf-8", errors="replace")
                    final_url = response.geturl()
                    if validator is not None:
                        final_url = validator(final_url)
                    return HttpResult(
                        body=decoded,
                        final_url=final_url,
                        status_code=status,
                        attempt=attempt,
                    )
            except FetchError:
                raise
            except HTTPError as exc:
                retryable = exc.code in RETRYABLE_STATUS_CODES
                code = "NOT_FOUND" if exc.code == 404 else "UPSTREAM_HTTP_ERROR"
                last_error = FetchError(
                    code,
                    f"InfoQ returned HTTP {exc.code}",
                    retryable=retryable,
                    status_code=exc.code,
                    attempt=attempt,
                    final_url=exc.geturl(),
                    details={"maximumAttempts": self.maximum_attempts},
                )
                if not retryable or attempt == self.maximum_attempts:
                    raise last_error
                self.sleep(self._retry_delay(attempt, exc.headers.get("Retry-After")))
            except (TimeoutError, URLError, OSError) as exc:
                last_error = FetchError(
                    "NETWORK_ERROR",
                    f"InfoQ request failed: {exc}",
                    retryable=True,
                    attempt=attempt,
                    details={"maximumAttempts": self.maximum_attempts},
                )
                if attempt == self.maximum_attempts:
                    raise last_error
                self.sleep(self._retry_delay(attempt, None))
        assert last_error is not None
        raise last_error

    def _read_limited(self, response) -> bytes:  # noqa: ANN001
        declared = response.headers.get("Content-Length")
        if declared:
            try:
                declared_size = int(declared)
            except ValueError:
                declared_size = 0
            if declared_size > self.maximum_response_bytes:
                raise FetchError(
                    "RESPONSE_TOO_LARGE",
                    "InfoQ response exceeded the configured size limit",
                    retryable=False,
                    status_code=getattr(response, "status", None),
                    details={"maximumBytes": self.maximum_response_bytes},
                )
        data = response.read(self.maximum_response_bytes + 1)
        if len(data) > self.maximum_response_bytes:
            raise FetchError(
                "RESPONSE_TOO_LARGE",
                "InfoQ response exceeded the configured size limit",
                retryable=False,
                status_code=getattr(response, "status", None),
                details={"maximumBytes": self.maximum_response_bytes},
            )
        return data

    def _wait_for_article_slot(self) -> None:
        if self._last_article_request_at is None:
            return
        remaining = self.minimum_article_interval_seconds - (self.clock() - self._last_article_request_at)
        if remaining > 0:
            self.sleep(remaining)

    @staticmethod
    def _retry_delay(attempt: int, retry_after: str | None) -> float:
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                try:
                    delay = (parsedate_to_datetime(retry_after).timestamp() - time.time())
                    return max(0.0, delay)
                except (TypeError, ValueError, OverflowError):
                    pass
        return min(8.0, float(2 ** (attempt - 1)))
