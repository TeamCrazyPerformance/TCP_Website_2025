from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from datetime import UTC, datetime

from bs4 import BeautifulSoup
from langdetect import DetectorFactory, LangDetectException, detect

from .contracts import (
    ArticleNormalized,
    ArticlePayload,
    CrawlItemProduced,
    ErrorInfo,
    NormalizationResult,
)

Clock = Callable[[], datetime]
DetectorFactory.seed = 0


def _utcnow() -> datetime:
    return datetime.now(UTC)


class GitHubTrendingNormalizer:
    def __init__(self, *, clock: Clock = _utcnow, version: str = "1.0.0") -> None:
        self.clock = clock
        self.version = version

    def normalize(self, item: CrawlItemProduced) -> ArticleNormalized:
        warnings: list[str] = []
        raw = item.raw_article
        if item.crawl.status != "SUCCESS" or raw is None:
            return self._failure(
                item,
                "NORMALIZATION_SKIPPED_CRAWL_FAILED",
                "Crawl failed before README normalization.",
                warnings,
            )

        warnings.append("PUBLICATION_TIME_APPROXIMATED_FROM_CRAWL")
        readme_text = self._html_to_text(raw.content_html or "")
        description = self._normalize_text(raw.description or "")
        if not description:
            warnings.append("DESCRIPTION_MISSING")
        content = "\n\n".join(part for part in (description, readme_text) if part).strip()
        if not content:
            return self._failure(
                item,
                "NORMALIZED_REQUIRED_FIELD_MISSING",
                "GitHub README did not produce normalized text.",
                warnings,
            )
        if len(content) < 200:
            warnings.append("CONTENT_SHORT_AFTER_CLEANUP")

        try:
            language = detect(content)
        except LangDetectException:
            language = "en"
            warnings.append("LANGUAGE_DETECTION_FALLBACK_EN")

        canonical_url = item.urls.canonical_url
        if not canonical_url:
            return self._failure(
                item,
                "NORMALIZED_REQUIRED_FIELD_MISSING",
                "GitHub repository canonical URL is missing.",
                warnings,
            )
        return ArticleNormalized(
            crawlRunId=item.crawl_run_id,
            crawlItemId=item.crawl_item_id,
            source=item.source,
            discovery=item.discovery,
            urls=item.urls,
            article=ArticlePayload(
                title=raw.title,
                authors=raw.authors,
                originalPublishedAt=item.crawl.crawled_at,
                content=content,
                language=language,
            ),
            normalization=NormalizationResult(
                status="SUCCESS",
                normalizedAt=self.clock().astimezone(UTC),
                normalizerVersion=self.version,
                warnings=warnings,
                error=None,
            ),
        )

    @classmethod
    def _html_to_text(cls, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for node in soup.select("script, style, noscript, svg, img"):
            node.decompose()
        return cls._normalize_text(soup.get_text("\n"))

    @staticmethod
    def _normalize_text(value: str) -> str:
        normalized = unicodedata.normalize("NFKC", value).replace("\r\n", "\n")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in normalized.split("\n")]
        output: list[str] = []
        for line in lines:
            if line or (output and output[-1]):
                output.append(line)
        return "\n".join(output).strip()

    def _failure(
        self,
        item: CrawlItemProduced,
        code: str,
        message: str,
        warnings: list[str],
    ) -> ArticleNormalized:
        return ArticleNormalized(
            crawlRunId=item.crawl_run_id,
            crawlItemId=item.crawl_item_id,
            source=item.source,
            discovery=item.discovery,
            urls=item.urls,
            article=None,
            normalization=NormalizationResult(
                status="FAILED",
                normalizedAt=self.clock().astimezone(UTC),
                normalizerVersion=self.version,
                warnings=warnings,
                error=ErrorInfo(
                    code=code,
                    message=message,
                    retryable=False,
                ),
            ),
        )
