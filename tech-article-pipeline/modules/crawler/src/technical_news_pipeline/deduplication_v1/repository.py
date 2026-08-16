from __future__ import annotations

import re
from typing import Any, Iterable, Protocol

from .models import ArticleRecord, DuplicateValidationError


class DuplicateArticleRepository(Protocol):
    """String-index lookups required by the exact duplicate stage."""

    def find_by_canonical_url(self, canonical_url: str) -> ArticleRecord | None: ...

    def find_by_content_sha256(self, content_sha256: str) -> ArticleRecord | None: ...


def _optional_string(value: Any, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise DuplicateValidationError(f"{field_name} must be a non-empty string or null")
    return value


def _optional_content_sha256(value: Any) -> str | None:
    content_sha256 = _optional_string(value, "existing contentSha256")
    if content_sha256 is not None and re.fullmatch(r"[0-9a-f]{64}", content_sha256) is None:
        raise DuplicateValidationError("existing contentSha256 must be 64 lowercase hexadecimal characters")
    return content_sha256


def _record_from_dict(value: dict[str, Any]) -> ArticleRecord:
    if not isinstance(value, dict):
        raise DuplicateValidationError("existing article must be an object")

    urls = value.get("urls") or {}
    fingerprints = value.get("fingerprints") or {}
    article_id = value.get("articleId")
    if not isinstance(article_id, str) or not article_id:
        raise DuplicateValidationError("existing articleId is required")
    if not isinstance(urls, dict) or not isinstance(fingerprints, dict):
        raise DuplicateValidationError("existing urls and fingerprints must be objects")

    return ArticleRecord(
        article_id=article_id,
        canonical_url=_optional_string(
            value.get("canonicalUrl", urls.get("canonicalUrl")), "existing canonicalUrl"
        ),
        content_sha256=_optional_content_sha256(
            value.get("contentSha256", fingerprints.get("contentSha256"))
        ),
    )


class InMemoryDuplicateArticleRepository:
    """In-memory exact indexes for examples and tests."""

    def __init__(self, records: Iterable[ArticleRecord] = ()) -> None:
        self.records = list(records)
        self.calls = {"canonicalUrl": 0, "contentSha256": 0}

    @classmethod
    def from_dicts(cls, values: Iterable[dict[str, Any]]) -> "InMemoryDuplicateArticleRepository":
        return cls(_record_from_dict(value) for value in values)

    def find_by_canonical_url(self, canonical_url: str) -> ArticleRecord | None:
        self.calls["canonicalUrl"] += 1
        return next((record for record in self.records if record.canonical_url == canonical_url), None)

    def find_by_content_sha256(self, content_sha256: str) -> ArticleRecord | None:
        self.calls["contentSha256"] += 1
        return next((record for record in self.records if record.content_sha256 == content_sha256), None)
