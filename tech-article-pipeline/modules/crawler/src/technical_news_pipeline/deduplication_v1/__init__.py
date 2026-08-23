"""Exact canonical-URL and normalized-content-hash duplicate checks."""

from .fingerprint import create_fingerprints
from .repository import DuplicateArticleRepository, InMemoryDuplicateArticleRepository
from .service import (
    ExactDuplicateCheckService,
    check_exact_duplicate,
)

__all__ = [
    "DuplicateArticleRepository",
    "ExactDuplicateCheckService",
    "InMemoryDuplicateArticleRepository",
    "check_exact_duplicate",
    "create_fingerprints",
]
