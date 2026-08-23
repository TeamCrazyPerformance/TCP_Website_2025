from __future__ import annotations

import zlib
from dataclasses import dataclass
from typing import ClassVar
from urllib.parse import urljoin

import httpx

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.urls import normalize_cloudflare_url, validate_cloudflare_url


@dataclass(frozen=True, slots=True)
class HttpResponse:
    url: str
    status_code: int
    headers: dict[str, str]
    body: bytes


class SafeHttpClient:
    _REDIRECT_STATUSES: ClassVar[frozenset[int]] = frozenset({301, 302, 303, 307, 308})

    def __init__(self, config: IngestionConfig) -> None:
        self._config = config

    async def get(
        self,
        url: str,
        *,
        accept: str,
        allowed_content_types: set[str],
        error_prefix: str,
    ) -> HttpResponse:
        current_url = normalize_cloudflare_url(url)
        for redirect_count in range(self._config.maximum_redirects + 1):
            validate_cloudflare_url(current_url)
            try:
                response = await self._request_once(
                    current_url, accept=accept, error_prefix=error_prefix
                )
            except httpx.TimeoutException as exc:
                raise IngestionError(
                    code=f"{error_prefix}_REQUEST_FAILED",
                    message="The source request timed out.",
                    retryable=True,
                    stage=f"{error_prefix}_REQUEST",
                    details={"maximumAttempts": 1},
                ) from exc
            except httpx.RequestError as exc:
                raise IngestionError(
                    code=f"{error_prefix}_REQUEST_FAILED",
                    message="The source request could not be completed.",
                    retryable=True,
                    stage=f"{error_prefix}_REQUEST",
                    details={"maximumAttempts": 1},
                ) from exc

            if response.status_code in self._REDIRECT_STATUSES:
                if redirect_count >= self._config.maximum_redirects:
                    raise IngestionError(
                        code=f"{error_prefix}_REQUEST_FAILED",
                        message="The source exceeded the redirect limit.",
                        retryable=False,
                        stage=f"{error_prefix}_REQUEST",
                        http_status_code=response.status_code,
                        details={"maximumAttempts": 1},
                    )
                location = response.headers.get("location")
                if not location:
                    raise IngestionError(
                        code=f"{error_prefix}_REQUEST_FAILED",
                        message="The redirect response did not provide a location.",
                        retryable=False,
                        stage=f"{error_prefix}_REQUEST",
                        http_status_code=response.status_code,
                        details={"maximumAttempts": 1},
                    )
                redirected = urljoin(current_url, location)
                current_url = normalize_cloudflare_url(redirected)
                continue

            if not 200 <= response.status_code <= 299:
                self._raise_for_status(response, error_prefix)

            media_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            if media_type not in allowed_content_types:
                raise IngestionError(
                    code=f"{error_prefix}_INVALID_CONTENT_TYPE",
                    message="The source returned an unsupported content type.",
                    retryable=False,
                    stage=f"{error_prefix}_REQUEST",
                    http_status_code=response.status_code,
                    details={"maximumAttempts": 1},
                )
            return response
        raise AssertionError("redirect loop must return or raise")

    async def _request_once(self, url: str, *, accept: str, error_prefix: str) -> HttpResponse:
        headers = {
            "User-Agent": self._config.user_agent,
            "Accept": accept,
            "Accept-Encoding": "identity",
        }
        timeout = httpx.Timeout(self._config.request_timeout_seconds)
        async with (
            httpx.AsyncClient(
                follow_redirects=False,
                timeout=timeout,
                trust_env=False,
                cookies={},
            ) as client,
            client.stream("GET", url, headers=headers) as response,
        ):
            content_length = response.headers.get("content-length")
            if content_length is not None:
                try:
                    if int(content_length) > self._config.maximum_response_bytes:
                        self._raise_too_large(error_prefix)
                except ValueError:
                    pass
            body = await self._read_limited(response, error_prefix=error_prefix)
            return HttpResponse(
                url=str(response.url),
                status_code=response.status_code,
                headers={key.lower(): value for key, value in response.headers.items()},
                body=body,
            )

    async def _read_limited(self, response: httpx.Response, *, error_prefix: str) -> bytes:
        encoding = response.headers.get("content-encoding", "").strip().lower()
        decoder: zlib.Decompress | None
        if encoding in ("", "identity"):
            decoder = None
        elif encoding == "gzip":
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
        elif encoding == "deflate":
            decoder = zlib.decompressobj()
        else:
            raise IngestionError(
                code=f"{error_prefix}_INVALID_CONTENT_TYPE",
                message="The source returned an unsupported content encoding.",
                retryable=False,
                stage=f"{error_prefix}_REQUEST",
                details={"maximumAttempts": 1},
            )

        compressed_size = 0
        decoded = bytearray()
        async for chunk in response.aiter_raw():
            compressed_size += len(chunk)
            if compressed_size > self._config.maximum_response_bytes:
                self._raise_too_large(error_prefix)
            if decoder is None:
                output = chunk
            else:
                remaining = self._config.maximum_response_bytes - len(decoded)
                output = decoder.decompress(chunk, remaining + 1)
            decoded.extend(output)
            if len(decoded) > self._config.maximum_response_bytes:
                self._raise_too_large(error_prefix)
        if decoder is not None:
            remaining = self._config.maximum_response_bytes - len(decoded)
            decoded.extend(decoder.flush(remaining + 1))
        if len(decoded) > self._config.maximum_response_bytes:
            self._raise_too_large(error_prefix)
        return bytes(decoded)

    def _raise_too_large(self, prefix: str) -> None:
        raise IngestionError(
            code=f"{prefix}_RESPONSE_TOO_LARGE",
            message="The source response exceeded the configured byte limit.",
            retryable=False,
            stage=f"{prefix}_REQUEST",
            details={"maximumAttempts": 1},
        )

    @staticmethod
    def _raise_for_status(response: HttpResponse, prefix: str) -> None:
        status = response.status_code
        retryable = status in {408, 429, 500, 502, 503, 504}
        details: dict[str, object] = {"maximumAttempts": 1}
        retry_after = response.headers.get("retry-after")
        if retry_after:
            details["retryAfterRaw"] = retry_after[:256]
            if retry_after.isdigit():
                details["retryAfterSeconds"] = int(retry_after)
        if status in {401, 403}:
            code = "SOURCE_ACCESS_FORBIDDEN"
        elif status in {500, 502, 503, 504}:
            code = "UPSTREAM_UNAVAILABLE"
        else:
            code = f"{prefix}_REQUEST_FAILED"
        raise IngestionError(
            code=code,
            message=f"The source returned HTTP {status}.",
            retryable=retryable,
            stage=f"{prefix}_REQUEST",
            http_status_code=status,
            details=details,
        )
