from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

from ..fingerprints.core import Fingerprint


class AutomaticDecision(StrEnum):
    UNIQUE = "UNIQUE"
    DUPLICATE = "DUPLICATE"
    POSSIBLE_DUPLICATE = "POSSIBLE_DUPLICATE"


@dataclass(frozen=True, slots=True)
class PreparedAdmission:
    request: dict[str, Any]
    input_digest: bytes
    request_key: str
    fingerprint: Fingerprint
    prepared_at: datetime


@dataclass(frozen=True, slots=True)
class ReferenceRecord:
    article_id: str
    title: str
    content: str
    canonical_url: str
    final_url: str | None
    original_published_at: datetime | None
    created_at: datetime
    content_version: int
    fingerprint_version: str
    content_normalization_version: str
    fingerprint_content_version: int
    content_sha256: bytes
    minhash_signature: bytes
    shingle_count: int
    buckets: tuple[bytes, ...]
    band_match_count: int


@dataclass(frozen=True, slots=True)
class CandidateBatch:
    records: tuple[ReferenceRecord, ...]
    truncated: bool = False


@dataclass(frozen=True, slots=True)
class CandidateEvidence:
    article_id: str
    matched_by: tuple[str, ...]
    content_jaccard: float
    minhash_similarity: float
    band_match_count: int
    title_similarity: float | None
    intersection_count: int
    union_count: int

    def projection(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "articleId": self.article_id,
            "matchedBy": list(self.matched_by),
            "contentJaccard": self.content_jaccard,
            "minHashSimilarity": self.minhash_similarity,
            "bandMatchCount": self.band_match_count,
            # Keep the exact rational score so replay and review resolution never
            # make a threshold decision from a rounded floating-point value.
            "intersectionCount": self.intersection_count,
            "unionCount": self.union_count,
        }
        if self.title_similarity is not None:
            value["titleSimilarity"] = self.title_similarity
        return value


@dataclass(frozen=True, slots=True)
class DecisionResult:
    decision: AutomaticDecision
    matched_article_id: str | None
    matched_by: tuple[str, ...]
    candidates: tuple[CandidateEvidence, ...]
    candidate_search_status: str = "COMPLETED"

    @property
    def possible_candidate_ids(self) -> frozenset[str]:
        return frozenset(
            item.article_id
            for item in self.candidates
            if 5 * item.intersection_count >= 4 * item.union_count
        )
