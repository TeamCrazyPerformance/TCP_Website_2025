from __future__ import annotations

import copy
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from ..constants import MAX_EXTERNAL_CANDIDATES, SCHEMA_VERSION
from ..contracts import ContractValidator
from ..digests import sha256_digest
from ..domain import (
    AutomaticDecision,
    DecisionResult,
    PreparedAdmission,
    evaluate_candidates,
)
from ..errors import AdmissionError
from ..fingerprints import assert_runtime_unicode, build_fingerprint
from ..persistence.base import AdmissionRepository
from ..storage import ArticleStore

Clock = Callable[[], datetime]
IdFactory = Callable[[str], str]


def _default_clock() -> datetime:
    return datetime.now(UTC)


def _default_id_factory(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex}"


class ArticleAdmissionService:
    def __init__(
        self,
        repository: AdmissionRepository,
        *,
        validator: ContractValidator | None = None,
        clock: Clock = _default_clock,
        id_factory: IdFactory = _default_id_factory,
        enforce_unicode_version: bool = True,
        hard_delete_enabled: bool = False,
    ) -> None:
        if enforce_unicode_version:
            assert_runtime_unicode()
        self._repository = repository
        self._validator = validator or ContractValidator()
        self._clock = clock
        self._id_factory = id_factory
        self._store = ArticleStore(repository)
        self._hard_delete_enabled = hard_delete_enabled

    @property
    def repository(self) -> AdmissionRepository:
        return self._repository

    def check_readiness(self) -> None:
        assert_runtime_unicode()
        self._repository.check_readiness()

    def admit(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return self._admit(payload)
        except AdmissionError as exc:
            return self._admission_failure(payload, exc)
        except Exception:
            return self._admission_failure(
                payload,
                AdmissionError(
                    code="INTERNAL_ERROR",
                    message="The article admission failed internally.",
                    retryable=True,
                ),
            )

    def _admit(self, payload: dict[str, Any]) -> dict[str, Any]:
        prepared = self._prepare(payload, self._clock())

        # The preview keeps fingerprinting and the first exact comparison outside the final lock.
        with self._repository.transaction() as preview_tx:
            preview_batch = self._repository.load_candidates(preview_tx, prepared)
            evaluate_candidates(prepared, preview_batch)

        checked_at = self._clock()
        with self._repository.transaction() as tx:
            self._repository.acquire_global_lock(tx)
            existing = self._repository.find_check_by_request(tx, prepared.request_key)
            if existing is not None:
                return self._replay_admission(tx, prepared, existing)

            final_batch = self._repository.load_candidates(tx, prepared)
            decision = evaluate_candidates(prepared, final_batch)
            check_id = self._id_factory("check")
            self._repository.insert_check_processing(
                tx,
                check_id=check_id,
                request_key=prepared.request_key,
                check_kind="INITIAL",
                parent_check_id=None,
                prepared=prepared,
            )

            article_id: str | None = None
            review_case_id: str | None = None
            if decision.decision == AutomaticDecision.UNIQUE:
                article_id = self._repository.allocate_article_id(tx, checked_at.date())
                self._store.store_unique(
                    tx,
                    article_id=article_id,
                    origin_check_id=check_id,
                    origin_resolution_request_id=None,
                    prepared=prepared,
                    created_at=checked_at,
                )
            elif decision.decision == AutomaticDecision.POSSIBLE_DUPLICATE:
                review_case_id = self._id_factory("review-case")
                self._repository.insert_review_case(
                    tx,
                    review_case_id=review_case_id,
                    check_id=check_id,
                    prepared=prepared,
                    decision=decision,
                    created_at=checked_at,
                )

            self._repository.complete_check(
                tx,
                check_id=check_id,
                prepared=prepared,
                decision=decision,
                checked_at=checked_at,
                new_article_id=article_id,
            )

        return self._admission_result(
            prepared,
            check_id=check_id,
            decision=decision,
            checked_at=checked_at,
            article_id=article_id,
            review_case_id=review_case_id,
            operation="CREATED",
        )

    def resolve_review(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return self._resolve_review(payload)
        except AdmissionError as exc:
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "RESOLUTION_FAILED",
                "error": exc.to_dict(),
            }
        except Exception:
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "RESOLUTION_FAILED",
                "error": AdmissionError(
                    code="INTERNAL_ERROR",
                    message="The duplicate review resolution failed internally.",
                    retryable=True,
                ).to_dict(),
            }

    def delete_permanently(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            request = self._validator.validate_hard_delete(payload)
            if not self._hard_delete_enabled:
                raise AdmissionError(
                    code="HARD_DELETE_NOT_ENABLED",
                    message="Permanent article deletion has not passed its activation gate.",
                )
            deleted_at = self._clock()
            with self._repository.transaction() as tx:
                self._repository.acquire_global_lock(tx)
                existing = self._repository.find_deletion_audit(
                    tx, request["deletionRequestId"]
                )
                if existing is not None:
                    expected = (
                        request["articleId"],
                        request["expectedRecordVersion"],
                        request["administratorId"],
                        request["reasonCode"],
                    )
                    actual = (
                        existing["article_id_snapshot"],
                        int(existing["expected_record_version"]),
                        existing["administrator_id"],
                        existing["reason_code"],
                    )
                    if expected != actual:
                        raise AdmissionError(
                            code="DELETION_KEY_REUSE",
                            message=(
                                "The deletion request ID was reused with different input."
                            ),
                        )
                    return self._deletion_result(
                        request,
                        existing["deleted_at"],
                        operation="NO_CHANGE",
                    )

                article = self._repository.find_article_for_update(
                    tx, request["articleId"]
                )
                if article is None:
                    raise AdmissionError(
                        code="ARTICLE_NOT_FOUND",
                        message="The article does not exist.",
                    )
                if int(article["record_version"]) != request["expectedRecordVersion"]:
                    raise AdmissionError(
                        code="ARTICLE_VERSION_CONFLICT",
                        message="The article record version has changed.",
                        retryable=True,
                        details={"currentRecordVersion": int(article["record_version"])},
                    )
                self._repository.insert_deletion_audit(
                    tx, request=request, deleted_at=deleted_at
                )
                self._repository.purge_origin_review_payload(
                    tx,
                    origin_resolution_request_id=article.get(
                        "origin_resolution_request_id"
                    ),
                    purged_at=deleted_at,
                )
                self._repository.delete_article(tx, request["articleId"])
            return self._deletion_result(request, deleted_at, operation="DELETED")
        except AdmissionError as exc:
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "ARTICLE_DELETION_FAILED",
                "error": exc.to_dict(),
            }
        except Exception:
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "ARTICLE_DELETION_FAILED",
                "error": AdmissionError(
                    code="INTERNAL_ERROR",
                    message="The permanent article deletion failed internally.",
                    retryable=True,
                ).to_dict(),
            }

    def backfill_missing_fingerprints(self, *, batch_size: int = 100) -> dict[str, int]:
        if not 1 <= batch_size <= 1_000:
            raise AdmissionError(
                code="INVALID_INPUT",
                message="Backfill batch size must be 1 through 1,000.",
            )
        counts = {"created": 0, "noChange": 0, "stale": 0}
        after_article_id = ""
        while True:
            with self._repository.transaction() as read_tx:
                batch = self._repository.list_backfill_candidates(
                    read_tx,
                    after_article_id=after_article_id,
                    limit=batch_size,
                )
            if not batch:
                break
            for candidate in batch:
                after_article_id = candidate["article_id"]
                fingerprint = build_fingerprint(candidate["content"])
                with self._repository.transaction() as write_tx:
                    self._repository.acquire_global_lock(write_tx)
                    outcome = self._repository.store_backfill_fingerprint(
                        write_tx,
                        article_id=candidate["article_id"],
                        expected_content_version=int(candidate["content_version"]),
                        expected_content=candidate["content"],
                        fingerprint=fingerprint,
                        created_at=self._clock(),
                    )
                counter = {
                    "CREATED": "created",
                    "NO_CHANGE": "noChange",
                    "STALE": "stale",
                }[outcome]
                counts[counter] += 1
            if len(batch) < batch_size:
                break
        return counts

    def _resolve_review(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = self._validator.validate_resolution(payload)
        request_digest = sha256_digest(request)
        resolved_at = _parse_time(request["resolvedAt"])
        resolution_id = request["resolutionRequestId"]

        with self._repository.transaction() as tx:
            self._repository.acquire_global_lock(tx)
            existing = self._repository.find_resolution(tx, resolution_id)
            if existing is not None:
                if existing["request_digest"] != request_digest:
                    raise AdmissionError(
                        code="RESOLUTION_KEY_REUSE",
                        message="The resolution request ID was reused with different input.",
                    )
                return self._resolution_replay(tx, existing)

            review = self._repository.find_review_case(
                tx, request["reviewCaseId"], for_update=True
            )
            if review is None:
                raise AdmissionError(
                    code="REVIEW_CASE_NOT_FOUND",
                    message="The duplicate review case does not exist.",
                )
            if review["status"] != "PENDING":
                raise AdmissionError(
                    code="REVIEW_CASE_ALREADY_RESOLVED",
                    message="The duplicate review case is already resolved.",
                )
            if review["case_version"] != request["expectedCaseVersion"]:
                raise AdmissionError(
                    code="REVIEW_CASE_VERSION_CONFLICT",
                    message="The duplicate review case version has changed.",
                    retryable=True,
                    details={"currentCaseVersion": review["case_version"]},
                )
            admission_payload = review.get("admission_payload")
            if not isinstance(admission_payload, dict):
                raise AdmissionError(
                    code="LEGACY_REVIEW_UNRESOLVABLE",
                    message="The review case no longer contains its admission payload.",
                )
            prepared = self._prepare(admission_payload, resolved_at)
            if prepared.input_digest != review["admission_input_digest"]:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="The review payload digest is inconsistent.",
                )

            final_batch = self._repository.load_candidates(tx, prepared)
            decision = evaluate_candidates(prepared, final_batch)
            check_id = self._id_factory("check")
            self._repository.insert_resolution_processing(
                tx,
                request=request,
                request_digest=request_digest,
                requested_at=resolved_at,
            )
            self._repository.insert_check_processing(
                tx,
                check_id=check_id,
                request_key=f"resolve:{resolution_id}",
                check_kind="RESOLUTION_RECHECK",
                parent_check_id=review["original_check_id"],
                prepared=prepared,
            )

            result = self._apply_resolution(
                tx=tx,
                request=request,
                request_digest=request_digest,
                review=review,
                prepared=prepared,
                decision=decision,
                check_id=check_id,
                resolved_at=resolved_at,
            )
        return result

    def _apply_resolution(
        self,
        *,
        tx: Any,
        request: dict[str, Any],
        request_digest: bytes,
        review: dict[str, Any],
        prepared: PreparedAdmission,
        decision: DecisionResult,
        check_id: str,
        resolved_at: datetime,
    ) -> dict[str, Any]:
        del request_digest  # The repository already persisted it before this method.
        resolution_id = request["resolutionRequestId"]
        article_id: str | None = None
        matched_article_id: str | None = None
        final_decision: str

        if decision.decision == AutomaticDecision.DUPLICATE:
            final_decision = "DUPLICATE"
            matched_article_id = decision.matched_article_id
        elif request["action"] == "CONFIRM_DUPLICATE":
            matched_article_id = request["matchedArticleId"]
            assert isinstance(matched_article_id, str)
            if self._repository.find_article(tx, matched_article_id) is None:
                return self._persist_stale_resolution(
                    tx,
                    request=request,
                    prepared=prepared,
                    review=review,
                    decision=decision,
                    check_id=check_id,
                    resolved_at=resolved_at,
                    message="The administrator-selected article no longer exists.",
                    increment_case=False,
                )
            final_decision = "DUPLICATE"
        else:
            if decision.decision == AutomaticDecision.POSSIBLE_DUPLICATE:
                original_ids = {
                    item["articleId"]
                    for item in review["original_candidate_snapshot"]
                    if (
                        isinstance(item, dict)
                        and isinstance(item.get("articleId"), str)
                        and isinstance(item.get("intersectionCount"), int)
                        and isinstance(item.get("unionCount"), int)
                        and item["unionCount"] > 0
                        and 5 * item["intersectionCount"] >= 4 * item["unionCount"]
                    )
                }
                new_ids = decision.possible_candidate_ids - original_ids
                if new_ids:
                    return self._persist_stale_resolution(
                        tx,
                        request=request,
                        prepared=prepared,
                        review=review,
                        decision=decision,
                        check_id=check_id,
                        resolved_at=resolved_at,
                        message="New possible-duplicate candidates appeared.",
                        increment_case=True,
                    )
            final_decision = "UNIQUE"
            article_id = self._repository.allocate_article_id(tx, resolved_at.date())
            self._store.store_unique(
                tx,
                article_id=article_id,
                origin_check_id=check_id,
                origin_resolution_request_id=resolution_id,
                prepared=prepared,
                created_at=resolved_at,
            )

        self._repository.complete_check(
            tx,
            check_id=check_id,
            prepared=prepared,
            decision=decision,
            checked_at=resolved_at,
            new_article_id=article_id,
        )
        self._repository.update_review_case(
            tx,
            review_case_id=review["review_case_id"],
            status=f"RESOLVED_{final_decision}",
            case_version=review["case_version"],
            candidate_snapshot=[item.projection() for item in decision.candidates],
            resolved_at=resolved_at,
        )
        self._repository.complete_resolution(
            tx,
            resolution_request_id=resolution_id,
            status="SUCCESS",
            final_decision=final_decision,
            final_check_id=check_id,
            matched_article_id=matched_article_id,
            new_article_id=article_id,
            error=None,
            completed_at=resolved_at,
        )
        return self._resolution_result(
            request=request,
            prepared=prepared,
            decision=decision,
            check_id=check_id,
            final_decision=final_decision,
            matched_article_id=matched_article_id,
            article_id=article_id,
            resolved_at=resolved_at,
            operation="CREATED",
        )

    def _persist_stale_resolution(
        self,
        tx: Any,
        *,
        request: dict[str, Any],
        prepared: PreparedAdmission,
        review: dict[str, Any],
        decision: DecisionResult,
        check_id: str,
        resolved_at: datetime,
        message: str,
        increment_case: bool,
    ) -> dict[str, Any]:
        error = AdmissionError(
            code="REVIEW_STALE",
            message=message,
            retryable=True,
        )
        self._repository.complete_check(
            tx,
            check_id=check_id,
            prepared=prepared,
            decision=decision,
            checked_at=resolved_at,
            new_article_id=None,
        )
        new_version = review["case_version"] + (1 if increment_case else 0)
        if increment_case:
            self._repository.update_review_case(
                tx,
                review_case_id=review["review_case_id"],
                status="PENDING",
                case_version=new_version,
                candidate_snapshot=[item.projection() for item in decision.candidates],
                resolved_at=None,
            )
        self._repository.complete_resolution(
            tx,
            resolution_request_id=request["resolutionRequestId"],
            status="FAILED",
            final_decision=None,
            final_check_id=check_id,
            matched_article_id=None,
            new_article_id=None,
            error=error.to_dict(),
            completed_at=resolved_at,
        )
        return {
            "schemaVersion": SCHEMA_VERSION,
            "outcome": "RESOLUTION_FAILED",
            "reviewCase": {
                "reviewCaseId": review["review_case_id"],
                "status": "PENDING",
                "caseVersion": new_version,
            },
            "duplicateCheckCompleted": self._duplicate_projection(
                prepared, check_id, decision, resolved_at
            ),
            "error": error.to_dict(),
        }

    def _prepare(self, payload: dict[str, Any], prepared_at: datetime) -> PreparedAdmission:
        request = self._validator.validate_admission(payload)
        fingerprint = build_fingerprint(request["article"]["content"])
        policy_version = request["duplicatePolicy"]["policyVersion"]
        request_key = f"admit:{request['crawlItemId']}:{policy_version}"
        if len(request_key) > 255 or not request_key.isascii():
            raise AdmissionError(
                code="INVALID_INPUT",
                message="The derived admission request key exceeds the MySQL contract.",
            )
        return PreparedAdmission(
            request=request,
            input_digest=sha256_digest(request),
            request_key=request_key,
            fingerprint=fingerprint,
            prepared_at=prepared_at.astimezone(UTC),
        )

    def _replay_admission(
        self,
        tx: Any,
        prepared: PreparedAdmission,
        existing: dict[str, Any],
    ) -> dict[str, Any]:
        if existing["input_digest"] != prepared.input_digest:
            raise AdmissionError(
                code="IDEMPOTENCY_KEY_REUSE",
                message="The admission request key was reused with different input.",
            )
        if existing["status"] != "SUCCESS":
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="A committed admission check is not in a terminal state.",
            )
        decision = _decision_from_row(existing)
        article_id = existing.get("new_article_id")
        review_case_id = None
        if decision.decision == AutomaticDecision.UNIQUE:
            assert isinstance(article_id, str)
            if self._repository.find_article(tx, article_id) is None:
                if self._repository.deletion_audit_exists(tx, article_id):
                    raise AdmissionError(
                        code="ADMISSION_RESULT_DELETED",
                        message="The article created by this admission was permanently deleted.",
                    )
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="A successful UNIQUE check has no article.",
                )
        elif decision.decision == AutomaticDecision.POSSIBLE_DUPLICATE:
            review = self._repository.find_review_by_original_check(tx, existing["check_id"])
            if review is None:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="A possible-duplicate check has no review case.",
                )
            review_case_id = review["review_case_id"]
        checked_at = existing["checked_at"] or prepared.prepared_at
        return self._admission_result(
            prepared,
            check_id=existing["check_id"],
            decision=decision,
            checked_at=checked_at,
            article_id=article_id,
            review_case_id=review_case_id,
            operation="NO_CHANGE",
        )

    def _admission_result(
        self,
        prepared: PreparedAdmission,
        *,
        check_id: str,
        decision: DecisionResult,
        checked_at: datetime,
        article_id: str | None,
        review_case_id: str | None,
        operation: str,
    ) -> dict[str, Any]:
        if decision.decision == AutomaticDecision.UNIQUE:
            assert article_id is not None
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "ARTICLE_INGESTED",
                "articleIngested": self._article_ingested(
                    prepared, article_id, checked_at, operation
                ),
            }
        duplicate = self._duplicate_projection(prepared, check_id, decision, checked_at)
        if decision.decision == AutomaticDecision.POSSIBLE_DUPLICATE:
            assert review_case_id is not None
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "DUPLICATE_REVIEW_REQUESTED",
                "duplicateCheckCompleted": duplicate,
                "reviewCase": {
                    "reviewCaseId": review_case_id,
                    "status": "PENDING",
                    "caseVersion": 1,
                },
            }
        return {
            "schemaVersion": SCHEMA_VERSION,
            "outcome": "DUPLICATE_CHECK_COMPLETED",
            "duplicateCheckCompleted": duplicate,
        }

    def _duplicate_projection(
        self,
        prepared: PreparedAdmission,
        check_id: str,
        decision: DecisionResult,
        checked_at: datetime,
    ) -> dict[str, Any]:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "crawlRunId": prepared.request["crawlRunId"],
            "crawlItemId": prepared.request["crawlItemId"],
            "fingerprints": prepared.fingerprint.artifact(),
            "duplicateCheck": {
                "checkId": check_id,
                "status": "SUCCESS",
                "decision": decision.decision.value,
                "checkedAt": _utc_text(checked_at),
                "policyVersion": prepared.request["duplicatePolicy"]["policyVersion"],
                "matchedArticleId": decision.matched_article_id,
                "matchedBy": list(decision.matched_by),
                "candidateSearchStatus": decision.candidate_search_status,
                "candidates": [
                    item.projection()
                    for item in decision.candidates[:MAX_EXTERNAL_CANDIDATES]
                ],
                "error": None,
            },
        }

    def _article_ingested(
        self,
        prepared: PreparedAdmission,
        article_id: str,
        saved_at: datetime,
        operation: str,
    ) -> dict[str, Any]:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "messageType": "ArticleIngested",
            "articleId": article_id,
            "crawlRunId": prepared.request["crawlRunId"],
            "crawlItemId": prepared.request["crawlItemId"],
            "recordVersion": 1,
            "source": {"sourceId": prepared.request["source"]["sourceId"]},
            "article": copy.deepcopy(prepared.request["article"]),
            "persistence": {
                "status": "SUCCESS",
                "operation": operation,
                "savedAt": _utc_text(saved_at),
                "error": None,
            },
            "workflow": {
                "processingStatus": "INGESTED",
                "reviewStatus": "NOT_REQUIRED",
                "publicationStatus": "UNPUBLISHED",
            },
        }

    def _resolution_result(
        self,
        *,
        request: dict[str, Any],
        prepared: PreparedAdmission,
        decision: DecisionResult,
        check_id: str,
        final_decision: str,
        matched_article_id: str | None,
        article_id: str | None,
        resolved_at: datetime,
        operation: str,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "schemaVersion": SCHEMA_VERSION,
            "outcome": "RESOLUTION_COMPLETED",
            "resolution": {
                "resolutionRequestId": request["resolutionRequestId"],
                "reviewCaseId": request["reviewCaseId"],
                "status": "SUCCESS",
                "finalDecision": final_decision,
                "matchedArticleId": matched_article_id,
                "newArticleId": article_id,
                "resolvedAt": _utc_text(resolved_at),
            },
            "duplicateCheckCompleted": self._duplicate_projection(
                prepared, check_id, decision, resolved_at
            ),
        }
        if article_id is not None:
            result["articleIngested"] = self._article_ingested(
                prepared, article_id, resolved_at, operation
            )
        return result

    def _resolution_replay(self, tx: Any, existing: dict[str, Any]) -> dict[str, Any]:
        review = self._repository.find_review_case(
            tx, existing["review_case_id"], for_update=False
        )
        if review is None or not isinstance(review.get("admission_payload"), dict):
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="The stored resolution has no review payload.",
            )
        if existing["status"] == "FAILED":
            return {
                "schemaVersion": SCHEMA_VERSION,
                "outcome": "RESOLUTION_FAILED",
                "error": existing["error"],
            }
        if existing["status"] != "SUCCESS":
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="A committed resolution is not terminal.",
            )
        prepared = self._prepare(
            review["admission_payload"], existing["completed_at"] or self._clock()
        )
        check = self._repository.find_check_by_request(
            tx, f"resolve:{existing['resolution_request_id']}"
        )
        if check is None:
            raise AdmissionError(
                code="REFERENCE_DATA_INVALID",
                message="The stored resolution has no final duplicate check.",
            )
        decision = _decision_from_row(check)
        request = {
            "resolutionRequestId": existing["resolution_request_id"],
            "reviewCaseId": existing["review_case_id"],
        }
        return self._resolution_result(
            request=request,
            prepared=prepared,
            decision=decision,
            check_id=check["check_id"],
            final_decision=existing["final_decision"],
            matched_article_id=existing["matched_article_id"],
            article_id=existing["new_article_id"],
            resolved_at=existing["completed_at"],
            operation="NO_CHANGE",
        )

    @staticmethod
    def _admission_failure(payload: dict[str, Any], error: AdmissionError) -> dict[str, Any]:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "outcome": "ADMISSION_FAILED",
            "crawlRunId": payload.get("crawlRunId") if isinstance(payload, dict) else None,
            "crawlItemId": payload.get("crawlItemId") if isinstance(payload, dict) else None,
            "error": error.to_dict(),
        }

    @staticmethod
    def _deletion_result(
        request: dict[str, Any], deleted_at: datetime, *, operation: str
    ) -> dict[str, Any]:
        return {
            "schemaVersion": SCHEMA_VERSION,
            "outcome": "ARTICLE_DELETED",
            "deletion": {
                "deletionRequestId": request["deletionRequestId"],
                "articleId": request["articleId"],
                "operation": operation,
                "deletedAt": _utc_text(deleted_at),
            },
        }


def _decision_from_row(row: dict[str, Any]) -> DecisionResult:
    from ..domain.models import CandidateEvidence

    candidates = tuple(
        CandidateEvidence(
            article_id=item["articleId"],
            matched_by=tuple(item.get("matchedBy") or []),
            content_jaccard=float(item["contentJaccard"]),
            minhash_similarity=float(item["minHashSimilarity"]),
            band_match_count=int(item["bandMatchCount"]),
            title_similarity=(
                None
                if item.get("titleSimilarity") is None
                else float(item["titleSimilarity"])
            ),
            intersection_count=int(item.get("intersectionCount", 0)),
            union_count=int(item.get("unionCount", 1)),
        )
        for item in row.get("candidates") or []
    )
    return DecisionResult(
        decision=AutomaticDecision(row["decision"]),
        matched_article_id=row.get("matched_article_id"),
        matched_by=tuple(row.get("matched_by") or []),
        candidates=candidates,
        candidate_search_status=row.get("candidate_search_status") or "COMPLETED",
    )


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value[:-1] + "+00:00").astimezone(UTC)


def _utc_text(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")
