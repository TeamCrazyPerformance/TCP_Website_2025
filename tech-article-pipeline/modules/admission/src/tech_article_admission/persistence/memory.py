from __future__ import annotations

import copy
from contextlib import AbstractContextManager
from datetime import date, datetime, timedelta
from threading import RLock
from typing import Any

from ..constants import CONTENT_NORMALIZATION_VERSION, FINGERPRINT_VERSION
from ..digests import url_sha256
from ..domain.models import CandidateBatch, DecisionResult, PreparedAdmission, ReferenceRecord
from ..errors import AdmissionError
from ..fingerprints import Fingerprint


class _MemoryTransaction(AbstractContextManager["_MemoryTransaction"]):
    def __init__(self, repository: MemoryAdmissionRepository) -> None:
        self.repository = repository
        self._snapshot: dict[str, Any] | None = None

    def __enter__(self) -> _MemoryTransaction:
        self.repository._lock.acquire()
        self._snapshot = self.repository._snapshot()
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> bool:
        if exc_type is not None and self._snapshot is not None:
            self.repository._restore(self._snapshot)
        self.repository._lock.release()
        return False


class MemoryAdmissionRepository:
    def __init__(self) -> None:
        self._lock = RLock()
        self.checks: dict[str, dict[str, Any]] = {}
        self.check_by_request: dict[str, str] = {}
        self.articles: dict[str, dict[str, Any]] = {}
        self.fingerprints: dict[str, dict[str, Any]] = {}
        self.buckets: dict[str, tuple[bytes, ...]] = {}
        self.review_cases: dict[str, dict[str, Any]] = {}
        self.review_by_check: dict[str, str] = {}
        self.resolutions: dict[str, dict[str, Any]] = {}
        self.deletion_audits: dict[str, dict[str, Any]] = {}
        self.sequences: dict[date, int] = {}
        self.fail_on: set[str] = set()

    def _snapshot(self) -> dict[str, Any]:
        return copy.deepcopy(
            {
                "checks": self.checks,
                "check_by_request": self.check_by_request,
                "articles": self.articles,
                "fingerprints": self.fingerprints,
                "buckets": self.buckets,
                "review_cases": self.review_cases,
                "review_by_check": self.review_by_check,
                "resolutions": self.resolutions,
                "deletion_audits": self.deletion_audits,
                "sequences": self.sequences,
            }
        )

    def _restore(self, state: dict[str, Any]) -> None:
        for name, value in state.items():
            setattr(self, name, value)

    def _maybe_fail(self, operation: str) -> None:
        if operation in self.fail_on:
            raise AdmissionError(
                code="PERSISTENCE_ERROR",
                message=f"Injected persistence failure at {operation}.",
                retryable=True,
            )

    def transaction(self) -> _MemoryTransaction:
        return _MemoryTransaction(self)

    def check_readiness(self) -> None:
        return None

    def acquire_global_lock(self, tx: Any) -> None:
        self._maybe_fail("global_lock")

    def load_candidates(self, tx: Any, prepared: PreparedAdmission) -> CandidateBatch:
        self._maybe_fail("load_candidates")
        policy = prepared.request["duplicatePolicy"]
        incoming = prepared.fingerprint
        exact_ids: set[str] = set()
        lsh: list[tuple[str, int]] = []
        cutoff: datetime | None = None
        if policy.get("candidateMaximumAgeDays") is not None:
            cutoff = prepared.prepared_at - timedelta(days=policy["candidateMaximumAgeDays"])

        for article_id, article in self.articles.items():
            fingerprint = self.fingerprints.get(article_id)
            buckets = self.buckets.get(article_id)
            if fingerprint is None or buckets is None or len(buckets) != 16:
                raise AdmissionError(
                    code="REFERENCE_CORPUS_INCOMPLETE",
                    message="A current article is missing its fingerprint index.",
                    retryable=True,
                    details={"articleId": article_id},
                )
            if policy["checkContentHash"] and fingerprint["content_sha256"] == (
                incoming.content_sha256
            ):
                exact_ids.add(article_id)
            if policy["checkCanonicalUrl"] and (
                article["canonical_url"] == prepared.request["urls"]["canonicalUrl"]
                or (
                    prepared.request["urls"].get("finalUrl") is not None
                    and article["final_url"] == prepared.request["urls"].get("finalUrl")
                )
            ):
                exact_ids.add(article_id)
            band_count = sum(
                left == right
                for left, right in zip(incoming.buckets, buckets, strict=True)
            )
            candidate_time = article["original_published_at"] or article["created_at"]
            if band_count and (cutoff is None or candidate_time >= cutoff):
                lsh.append((article_id, band_count))

        lsh.sort(key=lambda item: (-item[1], item[0]))
        maximum = policy["maximumCandidateCount"]
        truncated = len(lsh) > maximum
        selected_band_counts = dict(lsh[:maximum])
        selected_ids = exact_ids | set(selected_band_counts)
        records = tuple(
            self._reference_record(article_id, selected_band_counts.get(article_id, 0))
            for article_id in sorted(selected_ids)
        )
        return CandidateBatch(records=records, truncated=truncated)

    def _reference_record(self, article_id: str, band_count: int) -> ReferenceRecord:
        article = self.articles[article_id]
        fingerprint = self.fingerprints[article_id]
        return ReferenceRecord(
            article_id=article_id,
            title=article["title"],
            content=article["content"],
            canonical_url=article["canonical_url"],
            final_url=article["final_url"],
            original_published_at=article["original_published_at"],
            created_at=article["created_at"],
            content_version=article["content_version"],
            fingerprint_version=fingerprint["fingerprint_version"],
            content_normalization_version=fingerprint["content_normalization_version"],
            fingerprint_content_version=fingerprint["content_version"],
            content_sha256=fingerprint["content_sha256"],
            minhash_signature=fingerprint["minhash_signature"],
            shingle_count=fingerprint["shingle_count"],
            buckets=self.buckets[article_id],
            band_match_count=band_count,
        )

    def find_check_by_request(self, tx: Any, request_key: str) -> dict[str, Any] | None:
        check_id = self.check_by_request.get(request_key)
        return None if check_id is None else copy.deepcopy(self.checks[check_id])

    def find_article(self, tx: Any, article_id: str) -> dict[str, Any] | None:
        article = self.articles.get(article_id)
        return None if article is None else copy.deepcopy(article)

    def deletion_audit_exists(self, tx: Any, article_id: str) -> bool:
        return any(
            row["article_id_snapshot"] == article_id
            for row in self.deletion_audits.values()
        )

    def insert_check_processing(
        self,
        tx: Any,
        *,
        check_id: str,
        request_key: str,
        check_kind: str,
        parent_check_id: str | None,
        prepared: PreparedAdmission,
    ) -> None:
        self._maybe_fail("insert_check")
        if request_key in self.check_by_request:
            raise AdmissionError("IDEMPOTENCY_KEY_REUSE", "Duplicate request key.")
        row = {
            "check_id": check_id,
            "request_key": request_key,
            "check_kind": check_kind,
            "parent_check_id": parent_check_id,
            "crawl_run_id": prepared.request["crawlRunId"],
            "crawl_item_id": prepared.request["crawlItemId"],
            "input_digest": prepared.input_digest,
            "status": "PROCESSING",
            "decision": None,
            "policy_version": prepared.request["duplicatePolicy"]["policyVersion"],
            "fingerprint_version": FINGERPRINT_VERSION,
            "content_sha256": prepared.fingerprint.content_sha256,
            "matched_article_id": None,
            "new_article_id": None,
            "matched_by": None,
            "candidates": None,
            "candidate_search_status": None,
            "checked_at": None,
        }
        self.checks[check_id] = row
        self.check_by_request[request_key] = check_id

    def complete_check(
        self,
        tx: Any,
        *,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        checked_at: datetime,
        new_article_id: str | None,
    ) -> None:
        self._maybe_fail("complete_check")
        row = self.checks[check_id]
        row.update(
            {
                "status": "SUCCESS",
                "decision": decision.decision.value,
                "matched_article_id": decision.matched_article_id,
                "new_article_id": new_article_id,
                "matched_by": list(decision.matched_by),
                "candidates": [item.projection() for item in decision.candidates],
                "candidate_search_status": decision.candidate_search_status,
                "checked_at": checked_at,
            }
        )

    def allocate_article_id(self, tx: Any, sequence_date: date) -> str:
        self._maybe_fail("allocate_article_id")
        value = self.sequences.get(sequence_date, 0) + 1
        self.sequences[sequence_date] = value
        return f"article-{sequence_date:%Y%m%d}-{value:06d}"

    def insert_article(
        self,
        tx: Any,
        *,
        article_id: str,
        origin_check_id: str,
        origin_resolution_request_id: str | None,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        self._maybe_fail("insert_article")
        request = prepared.request
        article = request["article"]
        urls = request["urls"]
        normalization = request.get("normalization") or {}
        self.articles[article_id] = {
            "article_id": article_id,
            "origin_check_id": origin_check_id,
            "origin_resolution_request_id": origin_resolution_request_id,
            "crawl_run_id": request["crawlRunId"],
            "crawl_item_id": request["crawlItemId"],
            "ingest_input_digest": prepared.input_digest,
            "source_id": request["source"]["sourceId"],
            "discovery": copy.deepcopy(request.get("discovery")),
            "discovered_url": urls.get("discoveredUrl"),
            "discovered_url_sha256": url_sha256(urls.get("discoveredUrl")),
            "final_url": urls.get("finalUrl"),
            "final_url_sha256": url_sha256(urls.get("finalUrl")),
            "canonical_url": urls["canonicalUrl"],
            "canonical_url_sha256": url_sha256(urls["canonicalUrl"]),
            "title": article["title"],
            "authors": copy.deepcopy(article["authors"]),
            "content": article["content"],
            "language": article["language"],
            "original_published_at": _parse_time(article["originalPublishedAt"]),
            "normalizer_version": normalization.get("normalizerVersion"),
            "normalization_warnings": copy.deepcopy(normalization.get("warnings")),
            "processing_status": "INGESTED",
            "review_status": "NOT_REQUIRED",
            "publication_status": "UNPUBLISHED",
            "record_version": 1,
            "content_version": 1,
            "created_at": created_at,
            "updated_at": created_at,
        }

    def insert_fingerprint(
        self,
        tx: Any,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        self._maybe_fail("insert_fingerprint")
        value = prepared.fingerprint
        self.fingerprints[article_id] = {
            "fingerprint_version": value.version,
            "content_normalization_version": CONTENT_NORMALIZATION_VERSION,
            "content_version": 1,
            "content_sha256": value.content_sha256,
            "minhash_signature": value.signature,
            "shingle_count": value.shingle_count,
            "created_at": created_at,
        }

    def insert_buckets(
        self,
        tx: Any,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        self._maybe_fail("insert_buckets")
        self.buckets[article_id] = prepared.fingerprint.buckets

    def insert_review_case(
        self,
        tx: Any,
        *,
        review_case_id: str,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        created_at: datetime,
    ) -> None:
        self._maybe_fail("insert_review_case")
        row = {
            "review_case_id": review_case_id,
            "original_check_id": check_id,
            "crawl_run_id": prepared.request["crawlRunId"],
            "crawl_item_id": prepared.request["crawlItemId"],
            "admission_input_digest": prepared.input_digest,
            "admission_payload": copy.deepcopy(prepared.request),
            "original_candidate_snapshot": [
                item.projection() for item in decision.candidates
            ],
            "status": "PENDING",
            "case_version": 1,
            "created_at": created_at,
            "resolved_at": None,
        }
        self.review_cases[review_case_id] = row
        self.review_by_check[check_id] = review_case_id

    def find_review_by_original_check(
        self, tx: Any, check_id: str
    ) -> dict[str, Any] | None:
        review_id = self.review_by_check.get(check_id)
        return None if review_id is None else copy.deepcopy(self.review_cases[review_id])

    def find_review_case(
        self, tx: Any, review_case_id: str, *, for_update: bool
    ) -> dict[str, Any] | None:
        row = self.review_cases.get(review_case_id)
        return None if row is None else copy.deepcopy(row)

    def find_resolution(
        self, tx: Any, resolution_request_id: str
    ) -> dict[str, Any] | None:
        row = self.resolutions.get(resolution_request_id)
        return None if row is None else copy.deepcopy(row)

    def insert_resolution_processing(
        self,
        tx: Any,
        *,
        request: dict[str, Any],
        request_digest: bytes,
        requested_at: datetime,
    ) -> None:
        self._maybe_fail("insert_resolution")
        self.resolutions[request["resolutionRequestId"]] = {
            "resolution_request_id": request["resolutionRequestId"],
            "review_case_id": request["reviewCaseId"],
            "request_digest": request_digest,
            "expected_case_version": request["expectedCaseVersion"],
            "action": request["action"],
            "administrator_id": request["administratorId"],
            "status": "PROCESSING",
            "final_decision": None,
            "final_check_id": None,
            "matched_article_id": None,
            "new_article_id": None,
            "error": None,
            "requested_at": requested_at,
            "completed_at": None,
        }

    def complete_resolution(
        self,
        tx: Any,
        *,
        resolution_request_id: str,
        status: str,
        final_decision: str | None,
        final_check_id: str | None,
        matched_article_id: str | None,
        new_article_id: str | None,
        error: dict[str, Any] | None,
        completed_at: datetime,
    ) -> None:
        self._maybe_fail("complete_resolution")
        self.resolutions[resolution_request_id].update(
            {
                "status": status,
                "final_decision": final_decision,
                "final_check_id": final_check_id,
                "matched_article_id": matched_article_id,
                "new_article_id": new_article_id,
                "error": copy.deepcopy(error),
                "completed_at": completed_at,
            }
        )

    def update_review_case(
        self,
        tx: Any,
        *,
        review_case_id: str,
        status: str,
        case_version: int,
        candidate_snapshot: list[dict[str, Any]],
        resolved_at: datetime | None,
    ) -> None:
        self._maybe_fail("update_review_case")
        self.review_cases[review_case_id].update(
            {
                "status": status,
                "case_version": case_version,
                "original_candidate_snapshot": copy.deepcopy(candidate_snapshot),
                "resolved_at": resolved_at,
            }
        )

    def find_deletion_audit(
        self, tx: Any, deletion_request_id: str
    ) -> dict[str, Any] | None:
        row = self.deletion_audits.get(deletion_request_id)
        return None if row is None else copy.deepcopy(row)

    def find_article_for_update(
        self, tx: Any, article_id: str
    ) -> dict[str, Any] | None:
        return self.find_article(tx, article_id)

    def insert_deletion_audit(
        self,
        tx: Any,
        *,
        request: dict[str, Any],
        deleted_at: datetime,
    ) -> None:
        self._maybe_fail("insert_deletion_audit")
        self.deletion_audits[request["deletionRequestId"]] = {
            "deletion_request_id": request["deletionRequestId"],
            "article_id_snapshot": request["articleId"],
            "expected_record_version": request["expectedRecordVersion"],
            "administrator_id": request["administratorId"],
            "reason_code": request["reasonCode"],
            "deleted_at": deleted_at,
        }

    def purge_origin_review_payload(
        self,
        tx: Any,
        *,
        origin_resolution_request_id: str | None,
        purged_at: datetime,
    ) -> None:
        if origin_resolution_request_id is None:
            return
        resolution = self.resolutions.get(origin_resolution_request_id)
        if resolution is None:
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="The article origin resolution is missing.",
            )
        review = self.review_cases.get(resolution["review_case_id"])
        if review is None:
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="The article origin review case is missing.",
            )
        review["admission_payload"] = None
        review["payload_purged_at"] = purged_at

    def delete_article(self, tx: Any, article_id: str) -> None:
        self._maybe_fail("delete_article")
        if article_id not in self.articles:
            raise AdmissionError(
                code="ARTICLE_NOT_FOUND",
                message="The article does not exist.",
            )
        del self.articles[article_id]
        self.fingerprints.pop(article_id, None)
        self.buckets.pop(article_id, None)

    def list_backfill_candidates(
        self, tx: Any, *, after_article_id: str, limit: int
    ) -> tuple[dict[str, Any], ...]:
        values = [
            {
                "article_id": article_id,
                "content": article["content"],
                "content_version": article["content_version"],
            }
            for article_id, article in sorted(self.articles.items())
            if article_id > after_article_id and article_id not in self.fingerprints
        ]
        return tuple(copy.deepcopy(values[:limit]))

    def store_backfill_fingerprint(
        self,
        tx: Any,
        *,
        article_id: str,
        expected_content_version: int,
        expected_content: str,
        fingerprint: Fingerprint,
        created_at: datetime,
    ) -> str:
        self._maybe_fail("store_backfill_fingerprint")
        article = self.articles.get(article_id)
        if article is None:
            return "STALE"
        if article_id in self.fingerprints:
            return "NO_CHANGE"
        if (
            article["content_version"] != expected_content_version
            or article["content"] != expected_content
        ):
            return "STALE"
        if any(
            row["content_sha256"] == fingerprint.content_sha256
            for row in self.fingerprints.values()
        ):
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="Backfill found articles with the same normalized content hash.",
                details={"articleId": article_id},
            )
        self.fingerprints[article_id] = {
            "fingerprint_version": fingerprint.version,
            "content_normalization_version": CONTENT_NORMALIZATION_VERSION,
            "content_version": expected_content_version,
            "content_sha256": fingerprint.content_sha256,
            "minhash_signature": fingerprint.signature,
            "shingle_count": fingerprint.shingle_count,
            "created_at": created_at,
        }
        self.buckets[article_id] = fingerprint.buckets
        return "CREATED"


def _parse_time(value: str | None) -> datetime | None:
    return None if value is None else datetime.fromisoformat(value[:-1] + "+00:00")
