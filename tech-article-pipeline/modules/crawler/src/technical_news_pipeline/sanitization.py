from __future__ import annotations

from html.parser import HTMLParser

from .text_normalization import normalize_article_text


class _TextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "iframe", "form", "button", "noscript"}
    BLOCK_TAGS = {"p", "div", "section", "article", "li", "h1", "h2", "h3", "h4", "pre", "br"}
    VOID_TAGS = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "track",
        "wbr",
    }
    SKIP_CLASSES = {"nocontent", "related__vc", "author-section-full"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        classes = set(values.get("class", "").split())
        lower_tag = tag.lower()
        if self._skip_depth > 0:
            if lower_tag not in self.VOID_TAGS:
                self._skip_depth += 1
            return
        if lower_tag in self.SKIP_TAGS or classes.intersection(self.SKIP_CLASSES):
            self._skip_depth = 1
            return
        if lower_tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag.lower() in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(data)

    def text(self) -> str:
        return normalize_article_text("".join(self.parts))


def html_to_text(content_html: str) -> str:
    parser = _TextExtractor()
    parser.feed(content_html)
    parser.close()
    return parser.text()
