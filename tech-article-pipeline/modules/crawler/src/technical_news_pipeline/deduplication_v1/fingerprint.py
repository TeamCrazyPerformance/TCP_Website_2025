from __future__ import annotations

import hashlib

from .models import DuplicateValidationError, Fingerprints


def create_fingerprints(normalized_content: str) -> Fingerprints:
    """Hash the normalized article content exactly as received."""
    if not isinstance(normalized_content, str) or not normalized_content:
        raise DuplicateValidationError("article.content must be a non-empty string")
    digest = hashlib.sha256(normalized_content.encode("utf-8")).hexdigest()
    return Fingerprints(content_sha256=digest)
