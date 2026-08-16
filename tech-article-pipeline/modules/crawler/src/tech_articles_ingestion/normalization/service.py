from __future__ import annotations

from datetime import UTC
from email.utils import parsedate_to_datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.contracts import ContractValidator
from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.timeutils import utc_iso, utc_now
from tech_articles_ingestion.urls import normalize_cloudflare_url

from .content import ContentNormalizer
from .language import LanguageNormalizer
from .text import normalize_scalar

_WARNING_ORDER = {
    "CANONICAL_URL_MISSING": 10,
    "PUBLISHED_AT_MISSING": 20,
    "PUBLISHED_AT_TIMEZONE_ASSUMED": 21,
    "AUTHOR_MISSING": 30,
    "CONTENT_SHORT_AFTER_CLEANUP": 40,
    "LANGUAGE_UNCERTAIN": 50,
    "CLOUDFLARE_UNSUPPORTED_IMAGE_BLOCK": 60,
}


class ArticleNormalizer:
    def __init__(self, config: IngestionConfig, validator: ContractValidator) -> None:
        self._config = config
        self._validator = validator
        self._content = ContentNormalizer(content_short_threshold=config.content_short_threshold)
        self._language = LanguageNormalizer(config.language_confidence_threshold)

    def normalize(self, candidate: dict[str, Any]) -> dict[str, Any]:
        source = self._validator.validate_normalization_input(candidate)
        warnings: list[str] = []
        urls = self._normalize_urls(source["urls"], warnings)
        title = normalize_scalar(source["rawArticle"]["title"])
        if not title:
            raise IngestionError(
                code="TITLE_EMPTY_AFTER_NORMALIZATION",
                message="The title is empty after normalization.",
                stage="TITLE",
            )
        authors = self._normalize_authors(source["rawArticle"].get("authors"))
        if not authors:
            warnings.append("AUTHOR_MISSING")
        published_at, date_warning = self._normalize_published_at(
            source["rawArticle"].get("publishedAtRaw"),
            source["normalizationOptions"]["defaultTimeZone"],
        )
        if date_warning:
            warnings.append(date_warning)
        content, content_warnings = self._content.normalize(
            source["rawArticle"].get("contentHtml") or "",
            source["rawArticle"].get("contentText") or "",
        )
        warnings.extend(content_warnings)
        language, uncertain = self._language.detect(content)
        if uncertain:
            warnings.append("LANGUAGE_UNCERTAIN")
        warnings = sorted(set(warnings), key=lambda warning: _WARNING_ORDER[warning])

        output = {
            "crawlRunId": source["crawlRunId"],
            "crawlItemId": source["crawlItemId"],
            "source": source["source"],
            "discovery": source["discovery"],
            "urls": urls,
            "article": {
                "title": title,
                "authors": authors,
                "originalPublishedAt": published_at,
                "content": content,
                "language": language,
            },
            "normalization": {
                "status": "SUCCESS",
                "normalizedAt": utc_iso(utc_now()),
                "normalizerVersion": self._config.normalizer_version,
                "warnings": warnings,
                "error": None,
            },
        }
        return self._validator.validate_normalization_output(
            output, expected_input=source, round_trip=True
        )

    @staticmethod
    def _normalize_urls(urls: dict[str, Any], warnings: list[str]) -> dict[str, str]:
        discovered_url = normalize_cloudflare_url(urls["discoveredUrl"])
        final_url = normalize_cloudflare_url(urls["finalUrl"])
        canonical_value = urls.get("canonicalUrl")
        if canonical_value:
            try:
                canonical_url = normalize_cloudflare_url(canonical_value)
            except IngestionError:
                canonical_url = final_url
                warnings.append("CANONICAL_URL_MISSING")
        else:
            canonical_url = final_url
            warnings.append("CANONICAL_URL_MISSING")
        return {
            "discoveredUrl": discovered_url,
            "finalUrl": final_url,
            "canonicalUrl": canonical_url,
        }

    @staticmethod
    def _normalize_authors(values: list[str] | None) -> list[str]:
        output: list[str] = []
        seen: set[str] = set()
        for value in values or []:
            normalized = normalize_scalar(value)
            key = normalized.casefold()
            if normalized and key not in seen:
                seen.add(key)
                output.append(normalized)
        return output

    @staticmethod
    def _normalize_published_at(
        value: str | None, default_timezone: str
    ) -> tuple[str | None, str | None]:
        if not value:
            return None, "PUBLISHED_AT_MISSING"
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            return None, "PUBLISHED_AT_MISSING"
        warning: str | None = None
        if parsed.tzinfo is None:
            try:
                timezone = ZoneInfo(default_timezone)
            except ZoneInfoNotFoundError as exc:
                raise IngestionError(
                    code="NORMALIZATION_INPUT_INVALID",
                    message="The configured default timezone is invalid.",
                    stage="PUBLISHED_AT",
                ) from exc
            parsed = parsed.replace(tzinfo=timezone)
            warning = "PUBLISHED_AT_TIMEZONE_ASSUMED"
        return utc_iso(parsed.astimezone(UTC)), warning
