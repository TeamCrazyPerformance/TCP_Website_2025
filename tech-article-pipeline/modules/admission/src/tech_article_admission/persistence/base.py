from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import date, datetime
from typing import Any, Protocol

from ..domain.models import CandidateBatch, DecisionResult, PreparedAdmission
from ..fingerprints import Fingerprint


class AdmissionRepository(Protocol):
    def transaction(self) -> AbstractContextManager[Any]: ...

    def check_readiness(self) -> None: ...

    def acquire_global_lock(self, tx: Any) -> None: ...

    def load_candidates(self, tx: Any, prepared: PreparedAdmission) -> CandidateBatch: ...

    def find_check_by_request(self, tx: Any, request_key: str) -> dict[str, Any] | None: ...

    def find_article(self, tx: Any, article_id: str) -> dict[str, Any] | None: ...

    def deletion_audit_exists(self, tx: Any, article_id: str) -> bool: ...

    def insert_check_processing(
        self,
        tx: Any,
        *,
        check_id: str,
        request_key: str,
        check_kind: str,
        parent_check_id: str | None,
        prepared: PreparedAdmission,
    ) -> None: ...

    def complete_check(
        self,
        tx: Any,
        *,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        checked_at: datetime,
        new_article_id: str | None,
    ) -> None: ...

    def allocate_article_id(self, tx: Any, sequence_date: date) -> str: ...

    def insert_article(
        self,
        tx: Any,
        *,
        article_id: str,
        origin_check_id: str,
        origin_resolution_request_id: str | None,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None: ...

    def insert_fingerprint(
        self,
        tx: Any,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None: ...

    def insert_buckets(
        self,
        tx: Any,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None: ...

    def insert_review_case(
        self,
        tx: Any,
        *,
        review_case_id: str,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        created_at: datetime,
    ) -> None: ...

    def find_review_by_original_check(
        self, tx: Any, check_id: str
    ) -> dict[str, Any] | None: ...

    def find_review_case(
        self, tx: Any, review_case_id: str, *, for_update: bool
    ) -> dict[str, Any] | None: ...

    def find_resolution(
        self, tx: Any, resolution_request_id: str
    ) -> dict[str, Any] | None: ...

    def insert_resolution_processing(
        self,
        tx: Any,
        *,
        request: dict[str, Any],
        request_digest: bytes,
        requested_at: datetime,
    ) -> None: ...

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
    ) -> None: ...

    def update_review_case(
        self,
        tx: Any,
        *,
        review_case_id: str,
        status: str,
        case_version: int,
        candidate_snapshot: list[dict[str, Any]],
        resolved_at: datetime | None,
    ) -> None: ...

    def find_deletion_audit(
        self, tx: Any, deletion_request_id: str
    ) -> dict[str, Any] | None: ...

    def find_article_for_update(
        self, tx: Any, article_id: str
    ) -> dict[str, Any] | None: ...

    def insert_deletion_audit(
        self,
        tx: Any,
        *,
        request: dict[str, Any],
        deleted_at: datetime,
    ) -> None: ...

    def purge_origin_review_payload(
        self,
        tx: Any,
        *,
        origin_resolution_request_id: str | None,
        purged_at: datetime,
    ) -> None: ...

    def delete_article(self, tx: Any, article_id: str) -> None: ...

    def list_backfill_candidates(
        self, tx: Any, *, after_article_id: str, limit: int
    ) -> tuple[dict[str, Any], ...]: ...

    def store_backfill_fingerprint(
        self,
        tx: Any,
        *,
        article_id: str,
        expected_content_version: int,
        expected_content: str,
        fingerprint: Fingerprint,
        created_at: datetime,
    ) -> str: ...
