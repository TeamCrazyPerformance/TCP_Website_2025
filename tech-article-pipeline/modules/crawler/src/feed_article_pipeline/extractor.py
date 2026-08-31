from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from bs4 import BeautifulSoup, Tag

from .profiles import FeedSourceProfile
from .urls import normalize_source_url


class ArticleExtractionError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class ExtractedArticle:
    title: str | None
    authors: tuple[str, ...]
    published_at_raw: str | None
    content_html: str
    canonical_url: str


def extract_article(
    body: bytes,
    final_url: str,
    profile: FeedSourceProfile,
) -> ExtractedArticle:
    soup = BeautifulSoup(body, "lxml")
    container = _content_container(soup, profile.article_selectors)
    if container is None:
        raise ArticleExtractionError("The configured article body selector did not match.")
    for unwanted in container.select(
        "script, style, noscript, iframe, form, button, nav, footer, aside, "
        "[aria-label='Related'], [data-testid*='related']"
    ):
        unwanted.decompose()
    content_html = container.decode_contents().strip()
    if not container.get_text(" ", strip=True):
        raise ArticleExtractionError("The extracted article body is empty.")

    structured = _json_ld_articles(soup)
    canonical = _canonical_url(soup, final_url, profile.allowed_hosts)
    title = _meta_content(soup, "property", "og:title") or _structured_value(structured, "headline")
    if not title:
        heading = soup.find("h1")
        title = heading.get_text(" ", strip=True) if heading else None
    published = (
        _meta_content(soup, "property", "article:published_time")
        or _structured_value(structured, "datePublished")
        or _time_value(soup)
    )
    return ExtractedArticle(
        title=title,
        authors=tuple(_structured_authors(structured)),
        published_at_raw=published,
        content_html=content_html,
        canonical_url=canonical,
    )


def _content_container(soup: BeautifulSoup, selectors: tuple[str, ...]) -> Tag | None:
    for selector in selectors:
        matched = soup.select_one(selector)
        if isinstance(matched, Tag) and matched.get_text(" ", strip=True):
            return matched
    return None


def _canonical_url(soup: BeautifulSoup, final_url: str, allowed_hosts: tuple[str, ...]) -> str:
    element = soup.select_one("link[rel='canonical']")
    candidate = element.get("href") if isinstance(element, Tag) else None
    if isinstance(candidate, str):
        try:
            return normalize_source_url(candidate, allowed_hosts)
        except ValueError:
            pass
    return normalize_source_url(final_url, allowed_hosts)


def _meta_content(soup: BeautifulSoup, key: str, value: str) -> str | None:
    element = soup.find("meta", attrs={key: value})
    if not isinstance(element, Tag):
        return None
    content = element.get("content")
    return content.strip() if isinstance(content, str) and content.strip() else None


def _time_value(soup: BeautifulSoup) -> str | None:
    element = soup.find("time")
    if not isinstance(element, Tag):
        return None
    value = element.get("datetime")
    if isinstance(value, str) and value.strip():
        return value.strip()
    text = element.get_text(" ", strip=True)
    return text or None


def _json_ld_articles(soup: BeautifulSoup) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    for element in soup.select("script[type='application/ld+json']"):
        try:
            payload = json.loads(element.string or element.get_text())
        except (TypeError, ValueError):
            continue
        values = payload if isinstance(payload, list) else [payload]
        for value in values:
            if not isinstance(value, dict):
                continue
            graph = value.get("@graph")
            candidates = graph if isinstance(graph, list) else [value]
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                article_type = candidate.get("@type")
                types = article_type if isinstance(article_type, list) else [article_type]
                if any(item in {"Article", "BlogPosting", "NewsArticle"} for item in types):
                    articles.append(candidate)
    return articles


def _structured_value(articles: list[dict[str, Any]], key: str) -> str | None:
    for article in articles:
        value = article.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _structured_authors(articles: list[dict[str, Any]]) -> list[str]:
    output: list[str] = []
    for article in articles:
        native = article.get("author")
        authors = native if isinstance(native, list) else [native]
        for author in authors:
            if isinstance(author, str):
                name = author.strip()
            elif isinstance(author, dict):
                name = str(author.get("name") or "").strip()
            else:
                name = ""
            if name and name not in output:
                output.append(name)
    return output
