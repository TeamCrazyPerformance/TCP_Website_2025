from __future__ import annotations

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from .contracts import (
    ArticleNormalized,
    ArticleUrls,
    CrawlItemProduced,
    ErrorInfo,
    ExecutionStatus,
    NormalizationExecution,
    NormalizationOptions,
    NormalizedArticle,
    utc_now,
)
from .sanitization import html_to_text
from .text_normalization import normalize_article_text, normalize_inline_text
from .urls import normalize_canonical_url


NORMALIZER_VERSION = "1.0.0"


def _parse_published_at(raw: str | None, default_time_zone: str) -> tuple[datetime | None, bool]:
    if not raw:
        return None, False
    value = raw.strip()
    parsed: datetime | None = None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            for pattern in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
                try:
                    parsed = datetime.strptime(value, pattern)
                    break
                except ValueError:
                    continue
    if parsed is None:
        return None, False
    assumed = parsed.tzinfo is None
    if assumed:
        parsed = parsed.replace(tzinfo=ZoneInfo(default_time_zone))
    return parsed.astimezone(timezone.utc), assumed


def _detect_language(text: str, hint: str | None) -> tuple[str, bool]:
    if hint and re.fullmatch(r"[a-zA-Z]{2}", hint):
        return hint.lower(), False
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return "und", True
    korean = sum("\uac00" <= char <= "\ud7a3" for char in letters)
    ascii_letters = sum(char.isascii() for char in letters)
    if korean / len(letters) >= 0.25:
        return "ko", False
    if ascii_letters / len(letters) >= 0.75:
        return "en", False
    return "und", True


def _normalized_absolute_url(value: str | None) -> str | None:
    if not value:
        return None
    try:
        normalized = normalize_canonical_url(value)
    except ValueError:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    return normalized


class ArticleNormalizer:
    def __init__(self, now=utc_now) -> None:  # noqa: ANN001
        self.now = now

    def normalize(
        self,
        item: CrawlItemProduced,
        options: NormalizationOptions | None = None,
    ) -> ArticleNormalized:
        options = options or NormalizationOptions()
        if item.crawl.status is not ExecutionStatus.SUCCESS or item.raw_article is None:
            return self._failure(
                item,
                "CRAWL_NOT_SUCCESSFUL",
                "Only successful crawl items can be normalized.",
                retryable=False,
            )

        raw = item.raw_article
        title = normalize_inline_text(raw.title or "")
        if not title:
            return self._failure(item, "TITLE_MISSING", "The article title is missing.", retryable=False)

        authors: list[str] = []
        for author in raw.authors:
            normalized = normalize_inline_text(author)
            if normalized and normalized not in authors:
                authors.append(normalized)

        content = raw.content_text or ""
        if options.remove_boilerplate and raw.content_html:
            content = html_to_text(raw.content_html)
        if options.normalize_whitespace:
            content = normalize_article_text(content)
        if not content:
            return self._failure(
                item,
                "ARTICLE_BODY_NOT_FOUND",
                "The normalized article body is empty.",
                retryable=False,
            )

        warnings: list[str] = []
        published_at, timezone_assumed = _parse_published_at(raw.published_at_raw, options.default_time_zone)
        if published_at is None:
            warnings.append("PUBLISHED_AT_MISSING")
        elif timezone_assumed:
            warnings.append("PUBLISHED_AT_TIMEZONE_ASSUMED")
        if not authors:
            warnings.append("AUTHOR_MISSING")
        source_canonical_url = _normalized_absolute_url(item.urls.canonical_url)
        if not source_canonical_url:
            warnings.append("CANONICAL_URL_MISSING")
        if len(content) < 500:
            warnings.append("CONTENT_SHORT_AFTER_CLEANUP")

        if options.detect_language:
            language, uncertain = _detect_language(content, raw.language_hint)
            if uncertain:
                warnings.append("LANGUAGE_UNCERTAIN")
        else:
            language = raw.language_hint or "und"

        canonical_url = source_canonical_url
        if options.resolve_canonical_url and canonical_url is None:
            canonical_url = _normalized_absolute_url(item.urls.final_url)

        return ArticleNormalized(
            crawl_run_id=item.crawl_run_id,
            crawl_item_id=item.crawl_item_id,
            source=item.source,
            discovery=item.discovery,
            urls=ArticleUrls(
                discovered_url=item.urls.discovered_url,
                final_url=item.urls.final_url,
                canonical_url=canonical_url,
            ),
            article=NormalizedArticle(
                title=title,
                authors=authors,
                original_published_at=published_at,
                content=content,
                language=language,
            ),
            normalization=NormalizationExecution(
                status=ExecutionStatus.SUCCESS,
                normalized_at=self.now(),
                normalizer_version=NORMALIZER_VERSION,
                warnings=warnings,
                error=None,
            ),
        )

    def _failure(
        self,
        item: CrawlItemProduced,
        code: str,
        message: str,
        *,
        retryable: bool,
    ) -> ArticleNormalized:
        return ArticleNormalized(
            crawl_run_id=item.crawl_run_id,
            crawl_item_id=item.crawl_item_id,
            source=item.source,
            discovery=item.discovery,
            urls=item.urls,
            article=None,
            normalization=NormalizationExecution(
                status=ExecutionStatus.FAILED,
                normalized_at=self.now(),
                normalizer_version=NORMALIZER_VERSION,
                warnings=[],
                error=ErrorInfo(code=code, message=message, retryable=retryable),
            ),
        )
