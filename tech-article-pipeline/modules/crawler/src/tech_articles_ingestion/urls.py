from __future__ import annotations

import html
from urllib.parse import unquote, unquote_plus, urlsplit, urlunsplit

from tech_articles_ingestion.errors import IngestionError

FORBIDDEN_PATH_PREFIXES = ("/_emdash/admin", "/preview/", "/fragments/")
TRACKING_PARAMETERS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
}


def validate_cloudflare_url(value: str, *, allow_fragment: bool = False) -> None:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except (TypeError, ValueError) as exc:
        raise IngestionError("RSS_LINK_INVALID", "The URL cannot be parsed.") from exc
    if parsed.scheme != "https":
        raise IngestionError("RSS_LINK_INVALID", "Only HTTPS URLs are allowed.")
    if parsed.hostname != "blog.cloudflare.com":
        raise IngestionError("RSS_LINK_INVALID", "The URL host is not allowed.")
    if parsed.username or parsed.password:
        raise IngestionError("RSS_LINK_INVALID", "URL user information is not allowed.")
    if port not in (None, 443):
        raise IngestionError("RSS_LINK_INVALID", "A non-default port is not allowed.")
    if parsed.fragment and not allow_fragment:
        raise IngestionError("RSS_LINK_INVALID", "URL fragments are not allowed.")
    decoded_path = parsed.path or "/"
    for _ in range(3):
        next_value = unquote(decoded_path)
        if next_value == decoded_path:
            break
        decoded_path = next_value
    if any(decoded_path.startswith(prefix) for prefix in FORBIDDEN_PATH_PREFIXES):
        raise IngestionError("RSS_LINK_INVALID", "The URL path is forbidden.")


def normalize_cloudflare_url(value: str) -> str:
    decoded = html.unescape(value).strip()
    validate_cloudflare_url(decoded, allow_fragment=True)
    parsed = urlsplit(decoded)
    raw_segments = (parsed.path or "/").split("/")
    decoded_segments = [unquote(segment) for segment in raw_segments]
    if any(
        decoded_segment in {".", ".."} and raw_segment not in {".", ".."}
        for raw_segment, decoded_segment in zip(raw_segments, decoded_segments, strict=True)
    ):
        raise IngestionError(
            "RSS_LINK_INVALID", "Percent-encoded dot path segments are not allowed."
        )
    path = _remove_dot_segments(parsed.path or "/")
    query_parts: list[str] = []
    for part in parsed.query.split("&") if parsed.query else []:
        raw_key = part.split("=", 1)[0]
        if unquote_plus(raw_key).casefold() not in TRACKING_PARAMETERS:
            query_parts.append(part)
    normalized = urlunsplit(("https", "blog.cloudflare.com", path, "&".join(query_parts), ""))
    validate_cloudflare_url(normalized)
    return normalized


def _remove_dot_segments(path: str) -> str:
    leading_slash = path.startswith("/")
    trailing_slash = path.endswith("/")
    output: list[str] = []
    for segment in path.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            if output:
                output.pop()
            continue
        output.append(segment)
    normalized = "/".join(output)
    if leading_slash:
        normalized = "/" + normalized
    if trailing_slash and normalized != "/":
        normalized += "/"
    return normalized or "/"
