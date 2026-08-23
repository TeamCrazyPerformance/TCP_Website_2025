from __future__ import annotations

from lxml import etree, html

from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.models import ArticlePage
from tech_articles_ingestion.timeutils import utc_now
from tech_articles_ingestion.urls import normalize_cloudflare_url


class CloudflareArticleExtractor:
    def extract(
        self,
        html_bytes: bytes,
        *,
        discovered_url: str,
        final_url: str,
        http_status_code: int,
    ) -> ArticlePage:
        try:
            document = html.document_fromstring(html_bytes, base_url=final_url)
        except (etree.ParserError, ValueError) as exc:
            raise IngestionError(
                code="ARTICLE_BODY_NOT_FOUND",
                message="The article HTML could not be parsed.",
                stage="ARTICLE_EXTRACTION",
            ) from exc
        article_nodes = document.xpath(
            "//*[contains(concat(' ', normalize-space(@class), ' '), ' article-content ')]"
        )
        if not article_nodes:
            raise IngestionError(
                code="ARTICLE_BODY_NOT_FOUND",
                message="The article-content element was not found.",
                stage="ARTICLE_EXTRACTION",
                http_status_code=http_status_code,
            )
        if len(article_nodes) != 1:
            raise IngestionError(
                code="ARTICLE_BODY_SELECTOR_AMBIGUOUS",
                message="More than one article-content element was found.",
                stage="ARTICLE_EXTRACTION",
                http_status_code=http_status_code,
            )
        article_node = article_nodes[0]
        content_html = self._inner_html(article_node)
        content_text = article_node.text_content()
        if not content_html.strip() or not content_text.strip():
            raise IngestionError(
                code="ARTICLE_BODY_NOT_FOUND",
                message="The article-content element is empty.",
                stage="ARTICLE_EXTRACTION",
                http_status_code=http_status_code,
            )

        canonical_candidates = document.xpath(
            "//head//link["
            "contains(concat(' ', normalize-space(translate(@rel, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', "
            "'abcdefghijklmnopqrstuvwxyz')), ' '), ' canonical ')"
            "]/@href"
        )
        canonical_url: str | None = None
        if len(canonical_candidates) == 1:
            try:
                canonical_url = normalize_cloudflare_url(canonical_candidates[0])
            except IngestionError:
                canonical_url = None
        return ArticlePage(
            discovered_url=normalize_cloudflare_url(discovered_url),
            final_url=normalize_cloudflare_url(final_url),
            canonical_url=canonical_url,
            content_html=content_html,
            content_text=content_text,
            http_status_code=http_status_code,
            crawled_at=utc_now(),
        )

    @staticmethod
    def _inner_html(element: html.HtmlElement) -> str:
        parts: list[str] = []
        if element.text:
            parts.append(element.text)
        for child in element:
            parts.append(html.tostring(child, encoding="unicode", method="html"))
        return "".join(parts)
