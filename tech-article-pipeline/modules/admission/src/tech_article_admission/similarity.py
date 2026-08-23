from __future__ import annotations

import unicodedata
from collections import Counter


def _title_tokens(value: str) -> Counter[str]:
    normalized = unicodedata.normalize("NFKC", value).lower()
    cleaned = " ".join("".join(char if char.isalnum() else " " for char in normalized).split())
    if len(cleaned) < 2:
        return Counter({cleaned: 1}) if cleaned else Counter()
    return Counter(cleaned[index : index + 2] for index in range(len(cleaned) - 1))


def title_similarity(left: str, right: str) -> float:
    left_tokens = _title_tokens(left)
    right_tokens = _title_tokens(right)
    left_count = sum(left_tokens.values())
    right_count = sum(right_tokens.values())
    if left_count == 0 and right_count == 0:
        return 1.0
    if left_count == 0 or right_count == 0:
        return 0.0
    intersection = sum((left_tokens & right_tokens).values())
    return round(2 * intersection / (left_count + right_count), 6)
