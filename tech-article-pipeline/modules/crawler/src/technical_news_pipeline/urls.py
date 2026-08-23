from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse


INFOQ_ARTICLE_HOST = "www.infoq.com"
INFOQ_FEED_HOST = "feed.infoq.com"
TRACKING_PARAMETERS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
}


def _normalize_url(url: str, *, remove_trailing_slash: bool) -> str:
    parsed = urlparse(url.strip())
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URLs must not contain user information")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("URL port is invalid") from exc

    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"
    if port is not None and not (
        (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    ):
        netloc = f"{hostname}:{port}"
    else:
        netloc = hostname
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMETERS
    ]
    path = parsed.path or "/"
    if remove_trailing_slash and path != "/":
        path = path.rstrip("/") or "/"
    elif path.startswith(("/news/", "/articles/")) and not path.endswith("/"):
        path += "/"
    return urlunparse(
        (
            scheme,
            netloc,
            path,
            "",
            urlencode(sorted(query)),
            "",
        )
    )


def normalize_url(url: str) -> str:
    """Normalize crawl/request URLs while retaining InfoQ's article slash convention."""
    return _normalize_url(url, remove_trailing_slash=False)


def normalize_canonical_url(url: str) -> str:
    """Normalize a cross-source canonical identity URL and remove its trailing slash."""
    return _normalize_url(url, remove_trailing_slash=True)


def validate_infoq_article_url(url: str, expected_path: str | None = None) -> str:
    normalized = normalize_url(urljoin("https://www.infoq.com", url))
    parsed = urlparse(normalized)
    if parsed.scheme != "https":
        raise ValueError("InfoQ article URLs must use HTTPS")
    if parsed.hostname != INFOQ_ARTICLE_HOST:
        raise ValueError("InfoQ article host must be www.infoq.com")
    allowed_prefixes = ("/news/", "/articles/")
    if not parsed.path.startswith(allowed_prefixes):
        raise ValueError("InfoQ article path must start with /news/ or /articles/")
    if parsed.path.rstrip("/") in {"/news", "/articles"}:
        raise ValueError("InfoQ listing URLs are not article URLs")
    remainder = parsed.path.removeprefix("/news/").removeprefix("/articles/").strip("/")
    if remainder.isdigit():
        raise ValueError("InfoQ pagination URLs are not article URLs")
    if expected_path and not parsed.path.startswith(expected_path):
        raise ValueError(f"article path does not match feed type {expected_path}")
    return normalized


def validate_infoq_listing_url(url: str, expected_path: str | None = None) -> str:
    normalized = normalize_url(urljoin("https://www.infoq.com", url))
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or parsed.hostname != INFOQ_ARTICLE_HOST:
        raise ValueError("InfoQ listing URL must use https://www.infoq.com")
    matched_path = None
    for root_path in ("/news", "/articles"):
        source_path = f"{root_path}/"
        if parsed.path in {root_path, source_path}:
            matched_path = source_path
            break
        remainder = parsed.path.removeprefix(source_path).rstrip("/")
        if parsed.path.startswith(source_path) and remainder.isdigit():
            matched_path = source_path
            break
    if matched_path is None:
        raise ValueError("InfoQ listing path must be /news/ or /articles/ with an optional page number")
    if expected_path and matched_path != expected_path:
        raise ValueError(f"listing path does not match {expected_path}")
    return normalized


def validate_infoq_feed_url(url: str) -> str:
    normalized = normalize_url(url)
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or parsed.hostname != INFOQ_FEED_HOST:
        raise ValueError("InfoQ feed URL must use https://feed.infoq.com")
    if parsed.path not in {"/news", "/news/", "/articles", "/articles/"}:
        raise ValueError("only the InfoQ news and articles feeds are supported")
    return normalized


def validate_infoq_robots_url(url: str) -> str:
    normalized = normalize_url(url)
    parsed = urlparse(normalized)
    if (
        parsed.scheme != "https"
        or parsed.hostname != INFOQ_ARTICLE_HOST
        or parsed.path != "/robots.txt"
        or parsed.query
    ):
        raise ValueError("InfoQ robots URL must be https://www.infoq.com/robots.txt")
    return normalized


def expected_article_path(feed_url: str) -> str:
    path = urlparse(feed_url).path
    if path in {"/news", "/news/"}:
        return "/news/"
    if path in {"/articles", "/articles/"}:
        return "/articles/"
    raise ValueError("unsupported InfoQ feed")
