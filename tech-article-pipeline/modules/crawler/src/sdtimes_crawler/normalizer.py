import datetime
from typing import List, Optional

from .models import (
    CrawlItemProduced, NormalizedDocument, NormalizationOptions,
    ArticleNormalized, NormalizationResult, CommonError
)
from .url_normalizer import normalize_url_pipeline
from .text_normalizer import (
    clean_title_or_author, extract_article_body_text, parse_to_iso8601_utc, clean_text_nfkc
)


class SDTimesNormalizer:
    """
    Normalizes CrawlItemProduced items into standardized NormalizedDocument format
    according to team pipeline specification (v1.0.0) and URL/Body guidelines.
    """

    def __init__(self, version: str = "1.0.0"):
        self.version = version

    def normalize(
        self,
        item: CrawlItemProduced,
        options: NormalizationOptions | None = None,
    ) -> NormalizedDocument:
        options = options or NormalizationOptions()
        normalized_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        warnings: List[str] = []
        error: Optional[CommonError] = None

        # Check crawl status first
        if item.crawl.status != "SUCCESS" or not item.rawArticle:
            return NormalizedDocument(
                crawlRunId=item.crawlRunId,
                crawlItemId=item.crawlItemId,
                source=item.source,
                discovery=item.discovery,
                urls=item.urls,
                article=ArticleNormalized(
                    title="",
                    authors=[],
                    originalPublishedAt=None,
                    content="",
                    language="en"
                ),
                normalization=NormalizationResult(
                    status="FAILED",
                    normalizedAt=normalized_at,
                    normalizerVersion=self.version,
                    warnings=warnings,
                    error=item.crawl.error or CommonError(
                        code="NORMALIZATION_SKIPPED_CRAWL_FAILED",
                        message="Crawl failed for this item.",
                        retryable=False
                    )
                )
            )

        raw = item.rawArticle

        # 1. Clean Title
        cleaned_title = clean_title_or_author(raw.title or "")
        if not cleaned_title:
            warnings.append("TITLE_MISSING")

        # 2. Clean Authors
        cleaned_authors = []
        for author in raw.authors:
            c_author = clean_title_or_author(author)
            if c_author and c_author not in cleaned_authors:
                cleaned_authors.append(c_author)
        if not cleaned_authors:
            warnings.append("AUTHOR_MISSING")

        # 3. Parse Date to ISO 8601 UTC
        iso_published_at = parse_to_iso8601_utc(raw.publishedAtRaw)
        if not iso_published_at:
            warnings.append("PUBLISHED_AT_MISSING")

        # 4. Body Content Cleaning & Boilerplate Removal
        if raw.contentHtml and options.removeBoilerplate:
            cleaned_content = extract_article_body_text(raw.contentHtml)
        elif raw.contentText:
            cleaned_content = clean_text_nfkc(raw.contentText)
        else:
            cleaned_content = ""

        if not cleaned_content or len(cleaned_content) < 50:
            warnings.append("CONTENT_SHORT_AFTER_CLEANUP")

        # 5. 3-step URL Normalization
        disc_url, fin_url, canon_url = normalize_url_pipeline(
            discovered_url=item.urls.discoveredUrl,
            final_url=item.urls.finalUrl,
            html_content=raw.contentHtml,
            base_url="https://sdtimes.com"
        )
        normalized_urls = item.urls.model_copy(
            update={
                "discoveredUrl": disc_url,
                "finalUrl": fin_url,
                "canonicalUrl": canon_url,
            }
        )

        if not canon_url:
            warnings.append("CANONICAL_URL_MISSING")

        required_missing = not cleaned_title or not cleaned_content or not canon_url
        if required_missing:
            error = CommonError(
                code="NORMALIZED_REQUIRED_FIELD_MISSING",
                message="title, content, and canonicalUrl are required after normalization.",
                retryable=False,
            )

        return NormalizedDocument(
            crawlRunId=item.crawlRunId,
            crawlItemId=item.crawlItemId,
            source=item.source,
            discovery=item.discovery,
            urls=normalized_urls,
            article=ArticleNormalized(
                title=cleaned_title,
                authors=cleaned_authors,
                originalPublishedAt=iso_published_at,
                content=cleaned_content,
                language="en"
            ),
            normalization=NormalizationResult(
                status="FAILED" if required_missing else "SUCCESS",
                normalizedAt=normalized_at,
                normalizerVersion=self.version,
                warnings=warnings,
                error=error
            )
        )
