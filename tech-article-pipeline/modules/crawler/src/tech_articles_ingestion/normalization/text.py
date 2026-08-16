from __future__ import annotations

import html
import re
import unicodedata

_HORIZONTAL_WHITESPACE = re.compile(r"[^\S\n]+", re.UNICODE)
_TOO_MANY_NEWLINES = re.compile(r"\n{3,}")


def remove_control_characters(
    value: str,
    *,
    keep_newlines: bool = True,
    keep_tabs: bool = False,
) -> str:
    allowed = {"\n", "\r"} if keep_newlines else set()
    if keep_tabs:
        allowed.add("\t")
    return "".join(
        character
        for character in value
        if character in allowed or unicodedata.category(character) != "Cc"
    )


def normalize_scalar(value: str) -> str:
    decoded = html.unescape(value)
    normalized = unicodedata.normalize("NFC", decoded)
    normalized = remove_control_characters(normalized, keep_newlines=False)
    return _HORIZONTAL_WHITESPACE.sub(" ", normalized).strip()


def normalize_general_text(value: str) -> str:
    decoded = html.unescape(value)
    normalized = unicodedata.normalize("NFC", decoded)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = remove_control_characters(normalized, keep_newlines=True)
    lines = [_HORIZONTAL_WHITESPACE.sub(" ", line).strip() for line in normalized.split("\n")]
    return _TOO_MANY_NEWLINES.sub("\n\n", "\n".join(lines)).strip()
