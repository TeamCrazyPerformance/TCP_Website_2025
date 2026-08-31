from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from time import struct_time
from typing import Any

import feedparser
from defusedxml import ElementTree as DefusedElementTree

from .urls import normalize_source_url


class FeedParseError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class FeedEntry:
    title: str
    url: str
    authors: tuple[str, ...]
    published_at_raw: str | None
    published_at: datetime | None
    content_html: str | None
    summary_html: str | None


def parse_feed(body: bytes, allowed_hosts: tuple[str, ...]) -> list[FeedEntry]:
    try:
        DefusedElementTree.fromstring(body)
    except Exception as exc:
        raise FeedParseError("The source returned malformed or unsafe XML.") from exc

    parsed = feedparser.parse(body, sanitize_html=True, resolve_relative_uris=False)
    if parsed.bozo and not parsed.entries:
        raise FeedParseError("The source feed could not be parsed.")

    entries: list[FeedEntry] = []
    seen: set[str] = set()
    for native in parsed.entries:
        raw_link = str(native.get("link") or "").strip()
        title = str(native.get("title") or "").strip()
        if not raw_link or not title:
            continue
        try:
            url = normalize_source_url(raw_link, allowed_hosts)
        except ValueError:
            continue
        if url in seen:
            continue
        seen.add(url)
        published_raw = _first_string(native, "published", "updated", "created")
        entries.append(
            FeedEntry(
                title=title,
                url=url,
                authors=_authors(native),
                published_at_raw=published_raw,
                published_at=_published_at(native, published_raw),
                content_html=_content_html(native),
                summary_html=_first_string(native, "summary", "description"),
            )
        )
    return entries


def _first_string(native: Any, *keys: str) -> str | None:
    for key in keys:
        value = native.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _authors(native: Any) -> tuple[str, ...]:
    values: list[str] = []
    native_authors = native.get("authors") or []
    if isinstance(native_authors, list):
        for author in native_authors:
            if isinstance(author, dict):
                name = str(author.get("name") or "").strip()
                if name and name not in values:
                    values.append(name)
    direct = _first_string(native, "author")
    if direct and direct not in values:
        values.append(direct)
    return tuple(values)


def _content_html(native: Any) -> str | None:
    contents = native.get("content") or []
    if isinstance(contents, list):
        for content in contents:
            if isinstance(content, dict):
                value = content.get("value")
                if isinstance(value, str) and value.strip():
                    return value.strip()
    return None


def _published_at(native: Any, raw: str | None) -> datetime | None:
    for key in ("published_parsed", "updated_parsed", "created_parsed"):
        value = native.get(key)
        if isinstance(value, struct_time):
            return datetime(*value[:6], tzinfo=UTC)
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(raw)
        except (TypeError, ValueError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)
