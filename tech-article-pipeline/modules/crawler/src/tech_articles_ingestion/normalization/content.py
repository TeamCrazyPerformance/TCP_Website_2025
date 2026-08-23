from __future__ import annotations

import re

from lxml import etree, html

from tech_articles_ingestion.errors import IngestionError

from .code import CodeBlockNormalizer
from .table import TableNormalizer
from .text import normalize_general_text

_BLOCK_TAGS = {
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "dt",
    "dd",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",
}
_DROP_TAGS = {"script", "style", "iframe", "noscript", "template", "form", "button"}
_BOILERPLATE_MARKERS = {
    "cookie",
    "newsletter",
    "related-article",
    "related_article",
    "share-button",
    "share_button",
    "social-share",
    "advertisement",
}


class ContentNormalizer:
    def __init__(self, *, content_short_threshold: int) -> None:
        self._code = CodeBlockNormalizer()
        self._table = TableNormalizer()
        self._content_short_threshold = content_short_threshold

    def normalize(self, content_html: str, content_text: str) -> tuple[str, list[str]]:
        warnings: list[str] = []
        if not content_html.strip():
            return self._normalize_text_fallback(content_text)
        try:
            root = html.fragment_fromstring(content_html, create_parent="div")
        except (etree.ParserError, ValueError) as exc:
            try:
                return self._normalize_text_fallback(content_text)
            except IngestionError as fallback_error:
                raise fallback_error from exc

        self._remove_unsafe_and_boilerplate(root)
        rendered = self._render_flow(root)
        rendered = self._replace_supported_placeholders(rendered, warnings)
        rendered = normalize_general_text(rendered)
        if not rendered:
            raise IngestionError(
                code="ARTICLE_CONTENT_EMPTY",
                message="The normalized article content is empty.",
                stage="CONTENT",
            )
        if self._has_fatal_placeholder(rendered):
            self._raise_placeholder()
        warnings.extend(self._short_warning(rendered))
        return rendered, warnings

    def _normalize_text_fallback(self, content_text: str) -> tuple[str, list[str]]:
        fallback = normalize_general_text(content_text)
        if not fallback:
            raise IngestionError(
                code="ARTICLE_CONTENT_EMPTY",
                message="Neither HTML nor text content could be normalized.",
                stage="CONTENT",
            )
        if self._has_fatal_placeholder(fallback):
            self._raise_placeholder()
        return fallback, self._short_warning(fallback)

    def _render_flow(self, parent: html.HtmlElement) -> str:
        segments: list[str] = []
        inline_parts: list[str] = []

        def flush_inline() -> None:
            value = normalize_general_text("".join(inline_parts))
            inline_parts.clear()
            if value:
                segments.append(value)

        if parent.text:
            inline_parts.append(parent.text)
        for child in parent:
            tag = self._tag(child)
            if tag in _DROP_TAGS:
                if child.tail:
                    inline_parts.append(child.tail)
                continue
            if tag in _BLOCK_TAGS:
                flush_inline()
                rendered = self._render_block(child)
                if rendered:
                    segments.append(rendered)
            else:
                inline_parts.append(self._render_inline(child))
            if child.tail:
                inline_parts.append(child.tail)
        flush_inline()
        return "\n\n".join(segment for segment in segments if segment)

    def _render_block(self, element: html.HtmlElement) -> str:
        tag = self._tag(element)
        if tag == "pre":
            return self._code.normalize(element)
        if tag == "table":
            return self._table.normalize(element, self._render_flow)
        if tag in {"ul", "ol"}:
            return self._render_list(element, depth=0)
        if tag == "blockquote":
            value = self._render_flow(element)
            return "\n".join(f"> {line}" for line in value.splitlines())
        if tag == "hr":
            return ""
        return self._render_flow(element)

    def _render_inline(self, element: html.HtmlElement) -> str:
        tag = self._tag(element)
        if tag in _DROP_TAGS:
            return ""
        if tag == "br":
            return "\n"
        if tag == "code":
            return self._code.normalize_inline(element)
        if tag == "img":
            return element.get("alt") or ""
        if tag in _BLOCK_TAGS:
            return f"\n{self._render_block(element)}\n"
        parts: list[str] = [element.text or ""]
        for child in element:
            parts.append(self._render_inline(child))
            if child.tail:
                parts.append(child.tail)
        return "".join(parts)

    def _render_list(self, element: html.HtmlElement, *, depth: int) -> str:
        ordered = self._tag(element) == "ol"
        lines: list[str] = []
        items = [child for child in element if self._tag(child) == "li"]
        for index, item in enumerate(items, start=1):
            item_text, nested_lists = self._render_list_item(item)
            prefix = f"{index}. " if ordered else "- "
            indent = "  " * depth
            normalized = normalize_general_text(item_text)
            if normalized:
                item_lines = normalized.splitlines()
                lines.append(f"{indent}{prefix}{item_lines[0]}")
                continuation = indent + "  "
                lines.extend(f"{continuation}{line}" for line in item_lines[1:])
            for nested in nested_lists:
                nested_rendered = self._render_list(nested, depth=depth + 1)
                if nested_rendered:
                    lines.append(nested_rendered)
        return "\n".join(lines)

    def _render_list_item(self, item: html.HtmlElement) -> tuple[str, list[html.HtmlElement]]:
        parts: list[str] = [item.text or ""]
        nested: list[html.HtmlElement] = []
        for child in item:
            if self._tag(child) in {"ul", "ol"}:
                nested.append(child)
            elif self._tag(child) in _BLOCK_TAGS:
                parts.append(self._render_block(child))
            else:
                parts.append(self._render_inline(child))
            if child.tail:
                parts.append(child.tail)
        return "\n".join(part for part in parts if part), nested

    def _remove_unsafe_and_boilerplate(self, root: html.HtmlElement) -> None:
        for element in list(root.iterdescendants()):
            tag = self._tag(element)
            if tag in _DROP_TAGS or self._is_boilerplate(element):
                parent = element.getparent()
                if parent is not None:
                    tail = element.tail
                    previous = element.getprevious()
                    if tail:
                        if previous is not None:
                            previous.tail = (previous.tail or "") + tail
                        else:
                            parent.text = (parent.text or "") + tail
                    parent.remove(element)

    @staticmethod
    def _is_boilerplate(element: html.HtmlElement) -> bool:
        value = f"{element.get('id') or ''} {element.get('class') or ''}".casefold()
        tokens = set(re.split(r"[^a-z0-9_-]+", value))
        return bool(tokens & _BOILERPLATE_MARKERS)

    @staticmethod
    def _replace_supported_placeholders(value: str, warnings: list[str]) -> str:
        if "unsupported block: image" in value.casefold():
            value = re.sub(
                r"unsupported block:\s*image",
                "",
                value,
                flags=re.IGNORECASE,
            )
            warnings.append("CLOUDFLARE_UNSUPPORTED_IMAGE_BLOCK")
        return re.sub(
            r"unsupported block:\s*break",
            "\n",
            value,
            flags=re.IGNORECASE,
        )

    @staticmethod
    def _has_fatal_placeholder(value: str) -> bool:
        lowered = value.casefold()
        return any(
            marker in lowered
            for marker in (
                "unsupported block: code",
                "unsupported block: table",
                "unsupported block: htmlblock",
            )
        )

    @staticmethod
    def _raise_placeholder() -> None:
        raise IngestionError(
            code="CLOUDFLARE_UNSUPPORTED_BLOCK_REMAINED",
            message="A fatal Cloudflare unsupported block placeholder remains.",
            stage="CONTENT",
        )

    def _short_warning(self, value: str) -> list[str]:
        plain_length = len(re.sub(r"\s+", "", value))
        if plain_length < self._content_short_threshold:
            return ["CONTENT_SHORT_AFTER_CLEANUP"]
        return []

    @staticmethod
    def _tag(element: html.HtmlElement) -> str:
        if not isinstance(element.tag, str):
            return ""
        return element.tag.rsplit("}", 1)[-1].casefold()
