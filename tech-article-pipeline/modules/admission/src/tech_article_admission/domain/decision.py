from __future__ import annotations

import hashlib
from functools import cmp_to_key

from ..constants import (
    ALLOWED_MATCHED_BY,
    CONTENT_NORMALIZATION_VERSION,
    DUPLICATE_DENOMINATOR,
    DUPLICATE_NUMERATOR,
    POSSIBLE_DENOMINATOR,
    POSSIBLE_NUMERATOR,
)
from ..errors import AdmissionError, ResourceLimitExceeded
from ..fingerprints import (
    Fingerprint,
    create_shingles,
    exact_jaccard_counts,
    lsh_buckets,
    minhash_similarity,
    normalize_content,
)
from ..similarity import title_similarity
from .models import (
    AutomaticDecision,
    CandidateBatch,
    CandidateEvidence,
    DecisionResult,
    PreparedAdmission,
    ReferenceRecord,
)


def _reached(intersection: int, union: int, numerator: int, denominator: int) -> bool:
    return denominator * intersection >= numerator * union


def _validated_reference_fingerprint(record: ReferenceRecord) -> Fingerprint:
    if (
        record.content_version != record.fingerprint_content_version
        or record.content_normalization_version != CONTENT_NORMALIZATION_VERSION
        or len(record.buckets) != 16
    ):
        raise AdmissionError(
            code="REFERENCE_DATA_INVALID",
            message="A reference article has an inconsistent fingerprint index.",
            details={"articleId": record.article_id},
        )
    normalized = normalize_content(record.content)
    shingles = create_shingles(normalized)
    rebuilt_hash = hashlib.sha256(normalized.encode("utf-8")).digest()
    rebuilt_buckets = lsh_buckets(record.minhash_signature, record.fingerprint_version)
    if (
        rebuilt_hash != record.content_sha256
        or len(shingles) != record.shingle_count
        or rebuilt_buckets != record.buckets
    ):
        raise AdmissionError(
            code="REFERENCE_DATA_INVALID",
            message="A reference fingerprint does not match its article content.",
            details={"articleId": record.article_id},
        )
    return Fingerprint(
        version=record.fingerprint_version,
        normalized_content=normalized,
        content_sha256=rebuilt_hash,
        shingles=shingles,
        signature=record.minhash_signature,
        buckets=rebuilt_buckets,
    )


def _evidence(prepared: PreparedAdmission, record: ReferenceRecord) -> CandidateEvidence:
    request = prepared.request
    policy = request["duplicatePolicy"]
    incoming = prepared.fingerprint
    existing = _validated_reference_fingerprint(record)
    intersection, union = exact_jaccard_counts(incoming.shingles, existing.shingles)

    score = None
    matched: list[str] = []
    if policy["checkContentHash"] and incoming.content_sha256 == record.content_sha256:
        matched.append("CONTENT_HASH")
    if policy["checkCanonicalUrl"]:
        urls = request["urls"]
        if urls["canonicalUrl"] == record.canonical_url:
            matched.append("CANONICAL_URL")
        incoming_final = urls.get("finalUrl")
        if incoming_final is not None and incoming_final == record.final_url:
            matched.append("FINAL_URL")
    if policy["checkTitleSimilarity"]:
        score = title_similarity(request["article"]["title"], record.title)
        if score >= policy["possibleDuplicateThreshold"]:
            matched.append("TITLE_SIMILARITY")
    if not set(matched).issubset(ALLOWED_MATCHED_BY):
        raise AssertionError("Internal matchedBy projection contains an unsupported value.")

    return CandidateEvidence(
        article_id=record.article_id,
        matched_by=tuple(matched),
        content_jaccard=round(intersection / union, 6),
        minhash_similarity=round(
            minhash_similarity(incoming.signature, record.minhash_signature), 6
        ),
        band_match_count=record.band_match_count,
        title_similarity=score,
        intersection_count=intersection,
        union_count=union,
    )


def _compare_evidence(left: CandidateEvidence, right: CandidateEvidence) -> int:
    # Exact Jaccard descending, without sorting on a six-decimal projection.
    left_cross = left.intersection_count * right.union_count
    right_cross = right.intersection_count * left.union_count
    if left_cross != right_cross:
        return -1 if left_cross > right_cross else 1
    if left.band_match_count != right.band_match_count:
        return -1 if left.band_match_count > right.band_match_count else 1
    left_title = left.title_similarity if left.title_similarity is not None else -1.0
    right_title = right.title_similarity if right.title_similarity is not None else -1.0
    if left_title != right_title:
        return -1 if left_title > right_title else 1
    return (left.article_id > right.article_id) - (left.article_id < right.article_id)


def evaluate_candidates(
    prepared: PreparedAdmission,
    batch: CandidateBatch,
) -> DecisionResult:
    evidence = [_evidence(prepared, record) for record in batch.records]
    evidence.sort(key=cmp_to_key(_compare_evidence))

    hash_matches = [item for item in evidence if "CONTENT_HASH" in item.matched_by]
    if len(hash_matches) > 1:
        raise AdmissionError(
            code="REFERENCE_DATA_INVALID",
            message="Multiple current articles share one content hash.",
        )
    if hash_matches:
        selected = hash_matches[0]
        return DecisionResult(
            decision=AutomaticDecision.DUPLICATE,
            matched_article_id=selected.article_id,
            matched_by=selected.matched_by,
            candidates=tuple(evidence),
            candidate_search_status="TRUNCATED" if batch.truncated else "COMPLETED",
        )

    duplicate = next(
        (
            item
            for item in evidence
            if _reached(
                item.intersection_count,
                item.union_count,
                DUPLICATE_NUMERATOR,
                DUPLICATE_DENOMINATOR,
            )
        ),
        None,
    )
    if duplicate is not None:
        return DecisionResult(
            decision=AutomaticDecision.DUPLICATE,
            matched_article_id=duplicate.article_id,
            matched_by=duplicate.matched_by,
            candidates=tuple(evidence),
            candidate_search_status="TRUNCATED" if batch.truncated else "COMPLETED",
        )
    if batch.truncated:
        raise ResourceLimitExceeded(
            "CANDIDATE_COUNT",
            prepared.request["duplicatePolicy"]["maximumCandidateCount"],
        )

    possible = any(
        _reached(
            item.intersection_count,
            item.union_count,
            POSSIBLE_NUMERATOR,
            POSSIBLE_DENOMINATOR,
        )
        for item in evidence
    )
    return DecisionResult(
        decision=(
            AutomaticDecision.POSSIBLE_DUPLICATE
            if possible
            else AutomaticDecision.UNIQUE
        ),
        matched_article_id=None,
        matched_by=(),
        candidates=tuple(evidence),
    )
