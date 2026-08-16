from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

from .sanitization import html_to_text
from .urls import expected_article_path, validate_infoq_article_url


DC = "{http://purl.org/dc/elements/1.1/}"
ATOM = "{http://www.w3.org/2005/Atom}"


class ParseError(ValueError):
    def __init__(self, code: str, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details


@dataclass(slots=True)
class FeedCandidate:
    discovered_url: str
    discovered_from_url: str
    source_identifier: str | None
    title: str | None
    authors: list[str]
    published_at_raw: str | None
    description: str | None


def _text(element: ET.Element | None) -> str | None:
    if element is None or element.text is None:
        return None
    value = element.text.strip()
    return value or None


def parse_infoq_feed(xml_text: str, feed_url: str) -> list[FeedCandidate]:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise ParseError("RSS_PARSE_FAILED", f"InfoQ RSS could not be parsed: {exc}") from exc

    expected_path = expected_article_path(feed_url)
    items = root.findall(".//item")
    if not items and root.tag.endswith("feed"):
        items = root.findall(f".//{ATOM}entry")

    candidates: list[FeedCandidate] = []
    seen: set[str] = set()
    for item in items:
        link = _text(item.find("link"))
        if link is None:
            atom_link = item.find(f"{ATOM}link")
            if atom_link is not None:
                link = atom_link.attrib.get("href")
        if not link:
            continue
        try:
            discovered_url = validate_infoq_article_url(link, expected_path=expected_path)
        except ValueError:
            continue
        if discovered_url in seen:
            continue
        seen.add(discovered_url)

        authors = [
            value
            for value in (
                _text(author)
                for author in item.findall(f"{DC}creator") + item.findall("author")
            )
            if value
        ]
        description = _text(item.find("description")) or _text(item.find(f"{ATOM}summary"))
        if not authors and description:
            byline = re.search(r"\bBy\s+([^<\n]+)", html.unescape(description), flags=re.IGNORECASE)
            if byline:
                authors = [part.strip() for part in re.split(r",|\band\b", byline.group(1)) if part.strip()]

        published = (
            _text(item.find(f"{DC}date"))
            or _text(item.find("pubDate"))
            or _text(item.find(f"{ATOM}published"))
            or _text(item.find(f"{ATOM}updated"))
        )
        candidates.append(
            FeedCandidate(
                discovered_url=discovered_url,
                discovered_from_url=feed_url,
                source_identifier=_text(item.find("guid")) or _text(item.find(f"{ATOM}id")),
                title=_text(item.find("title")) or _text(item.find(f"{ATOM}title")),
                authors=authors,
                published_at_raw=published,
                description=description,
            )
        )
    return candidates


class _ListingLinkParser(HTMLParser):
    def __init__(self, listing_url: str, source_path: str) -> None:
        super().__init__(convert_charrefs=True)
        self.listing_url = listing_url
        self.source_path = source_path
        self.links: list[tuple[str, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        values = {key.lower(): value or "" for key, value in attrs}
        href = values.get("href")
        if not href:
            return
        try:
            article_url = validate_infoq_article_url(
                urljoin(self.listing_url, href),
                expected_path=self.source_path,
            )
        except ValueError:
            return
        title = values.get("aria-label") or values.get("title") or None
        self.links.append((article_url, title))


def parse_infoq_listing(html_text: str, listing_url: str, source_path: str) -> list[FeedCandidate]:
    parser = _ListingLinkParser(listing_url, source_path)
    parser.feed(html_text)
    parser.close()
    candidates: list[FeedCandidate] = []
    seen: set[str] = set()
    for discovered_url, title in parser.links:
        if discovered_url in seen:
            continue
        seen.add(discovered_url)
        candidates.append(
            FeedCandidate(
                discovered_url=discovered_url,
                discovered_from_url=listing_url,
                source_identifier=None,
                title=title,
                authors=[],
                published_at_raw=None,
                description=None,
            )
        )
    return candidates


@dataclass(slots=True)
class ParsedPage:
    canonical_url: str | None
    title: str | None
    authors: list[str]
    published_at_raw: str | None
    content_html: str
    content_text: str
    language_hint: str | None


class _InfoQPageParser(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.canonical_url: str | None = None
        self.og_url: str | None = None
        self.title: str | None = None
        self.authors: list[str] = []
        self.published_at_raw: str | None = None
        self.language_hint: str | None = None
        self.article_matches = 0
        self._capture_depth = 0
        self._capture: list[str] = []
        self._title_depth = 0
        self._title_parts: list[str] = []

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key.lower(): value or "" for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = self._attrs(attrs)
        lower_tag = tag.lower()
        if lower_tag == "html" and values.get("lang"):
            self.language_hint = values["lang"].split("-")[0].lower()
        if lower_tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonical_url = values.get("href") or self.canonical_url
        if lower_tag == "meta":
            name = (values.get("name") or values.get("property") or "").lower()
            content = values.get("content", "").strip()
            if name == "og:url" and content and not self.og_url:
                self.og_url = html.unescape(content)
            elif name in {"og:title", "twitter:title"} and content and not self.title:
                self.title = html.unescape(content)
            elif name in {"author", "article:author"} and content and content not in self.authors:
                self.authors.append(html.unescape(content))
            elif name in {"article:published_time", "date", "datepublished"} and content:
                self.published_at_raw = content

        classes = set(values.get("class", "").split())
        if lower_tag == "div" and "article__data" in classes:
            self.article_matches += 1
            if self._capture_depth == 0:
                self._capture_depth = 1
                self._capture.append(self.get_starttag_text())
                return
        if self._capture_depth > 0:
            self._capture.append(self.get_starttag_text())
            if lower_tag not in self.VOID_TAGS:
                self._capture_depth += 1
        if lower_tag == "h1" and self._title_depth == 0:
            self._title_depth = 1
        elif self._title_depth > 0 and lower_tag not in self.VOID_TAGS:
            self._title_depth += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._capture_depth > 0:
            self._capture.append(self.get_starttag_text())

    def handle_endtag(self, tag: str) -> None:
        if self._capture_depth > 0:
            self._capture.append(f"</{tag}>")
            self._capture_depth -= 1
        if self._title_depth > 0:
            self._title_depth -= 1
            if self._title_depth == 0 and not self.title:
                value = " ".join("".join(self._title_parts).split())
                if value:
                    self.title = html.unescape(value)

    def handle_data(self, data: str) -> None:
        if self._capture_depth > 0:
            self._capture.append(data)
        if self._title_depth > 0:
            self._title_parts.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._capture_depth > 0:
            self._capture.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self._capture_depth > 0:
            self._capture.append(f"&#{name};")

    @property
    def article_html(self) -> str:
        return "".join(self._capture)


def parse_infoq_page(html_text: str, final_url: str) -> ParsedPage:
    parser = _InfoQPageParser()
    parser.feed(html_text)
    parser.close()
    if parser.article_matches != 1 or not parser.article_html:
        raise ParseError(
            "BODY_STRUCTURE_CHANGED",
            "Expected exactly one .article__data element.",
            details={"selector": ".article__data", "matchedCount": parser.article_matches},
        )
    canonical: str | None = None
    for canonical_candidate in (parser.canonical_url, parser.og_url):
        if not canonical_candidate:
            continue
        try:
            canonical = validate_infoq_article_url(urljoin(final_url, canonical_candidate))
            break
        except ValueError:
            continue
    content_text = html_to_text(parser.article_html)
    if not content_text:
        raise ParseError("ARTICLE_BODY_NOT_FOUND", "The extracted article body was empty.")
    return ParsedPage(
        canonical_url=canonical,
        title=parser.title,
        authors=parser.authors,
        published_at_raw=parser.published_at_raw,
        content_html=parser.article_html,
        content_text=content_text,
        language_hint=parser.language_hint,
    )
