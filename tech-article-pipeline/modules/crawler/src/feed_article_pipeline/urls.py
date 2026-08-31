from __future__ import annotations

import html
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

TRACKING_PARAMETERS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
}


def normalize_source_url(value: str, allowed_hosts: tuple[str, ...]) -> str:
    decoded = html.unescape(value).strip()
    try:
        parsed = urlsplit(decoded)
        port = parsed.port
    except (TypeError, ValueError) as exc:
        raise ValueError("the URL cannot be parsed") from exc
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme.lower() != "https":
        raise ValueError("only HTTPS URLs are allowed")
    if hostname not in allowed_hosts:
        raise ValueError(f"URL host {hostname!r} is not allowed")
    if parsed.username or parsed.password:
        raise ValueError("URL user information is not allowed")
    if port not in (None, 443):
        raise ValueError("non-default URL ports are not allowed")

    raw_segments = (parsed.path or "/").split("/")
    decoded_segments = [unquote(segment) for segment in raw_segments]
    if any(
        decoded_segment in {".", ".."} and raw_segment not in {".", ".."}
        for raw_segment, decoded_segment in zip(raw_segments, decoded_segments, strict=True)
    ):
        raise ValueError("percent-encoded dot path segments are not allowed")
    path = _remove_dot_segments(parsed.path or "/")
    query = [
        (key, item)
        for key, item in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.casefold().startswith("utm_") and key.casefold() not in TRACKING_PARAMETERS
    ]
    return urlunsplit(("https", hostname, path, urlencode(sorted(query)), ""))


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
