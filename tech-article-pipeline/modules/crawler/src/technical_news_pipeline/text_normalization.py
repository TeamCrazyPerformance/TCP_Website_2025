from __future__ import annotations

import html
import unicodedata


def normalize_inline_text(value: str) -> str:
    """Normalize title/byline text to one NFKC whitespace-collapsed line."""
    decoded = html.unescape(value)
    normalized = unicodedata.normalize("NFKC", decoded)
    return " ".join(normalized.split())


def normalize_article_text(value: str) -> str:
    """Normalize article text while preserving a single blank line between paragraphs."""
    decoded = html.unescape(value)
    normalized = unicodedata.normalize("NFKC", decoded).replace("\r\n", "\n").replace("\r", "\n")

    output: list[str] = []
    pending_blank = False
    for raw_line in normalized.split("\n"):
        line = " ".join(raw_line.split())
        if not line:
            if output:
                pending_blank = True
            continue
        if pending_blank and output:
            output.append("")
        output.append(line)
        pending_blank = False
    return "\n".join(output)
