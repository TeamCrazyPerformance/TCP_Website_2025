from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from tech_article_admission.config import MySQLSettings
from tech_article_admission.contracts import ContractValidator
from tech_article_admission.digests import sha256_digest
from tech_article_admission.domain.models import (
    AutomaticDecision,
    DecisionResult,
    PreparedAdmission,
)
from tech_article_admission.fingerprints import build_fingerprint
from tech_article_admission.persistence.mysql import (
    MySQLAdmissionRepository,
    MySQLConnectionPool,
)


class _CountingCursor:
    def __init__(self) -> None:
        self.rowcount = 1

    def execute(self, sql: str, parameters: tuple[Any, ...] = ()) -> None:
        assert sql.count("%s") == len(parameters), (sql, parameters)
        self.rowcount = 1

    def executemany(self, sql: str, rows: list[tuple[Any, ...]]) -> None:
        for row in rows:
            assert sql.count("%s") == len(row), (sql, row)
        self.rowcount = len(rows)

    def close(self) -> None:
        return None


class _CountingConnection:
    def cursor(self, **kwargs: Any) -> _CountingCursor:
        return _CountingCursor()


def _prepared(payload_factory) -> PreparedAdmission:
    request = ContractValidator().validate_admission(payload_factory())
    return PreparedAdmission(
        request=request,
        input_digest=sha256_digest(request),
        request_key="admit:crawl-item-001:duplicate-policy-v1",
        fingerprint=build_fingerprint(request["article"]["content"]),
        prepared_at=datetime(2026, 8, 14, tzinfo=UTC),
    )


def test_mysql_write_statements_bind_every_placeholder(payload_factory) -> None:
    repository = MySQLAdmissionRepository(SimpleNamespace())
    tx = SimpleNamespace(connection=_CountingConnection())
    prepared = _prepared(payload_factory)
    now = datetime(2026, 8, 14, tzinfo=UTC)
    decision = DecisionResult(
        decision=AutomaticDecision.UNIQUE,
        matched_article_id=None,
        matched_by=(),
        candidates=(),
    )

    repository.insert_check_processing(
        tx,
        check_id="check-1",
        request_key=prepared.request_key,
        check_kind="INITIAL",
        parent_check_id=None,
        prepared=prepared,
    )
    repository.complete_check(
        tx,
        check_id="check-1",
        prepared=prepared,
        decision=decision,
        checked_at=now,
        new_article_id="article-20260814-000001",
    )
    repository.insert_article(
        tx,
        article_id="article-20260814-000001",
        origin_check_id="check-1",
        origin_resolution_request_id=None,
        prepared=prepared,
        created_at=now,
    )
    repository.insert_fingerprint(
        tx,
        article_id="article-20260814-000001",
        prepared=prepared,
        created_at=now,
    )
    repository.insert_buckets(
        tx,
        article_id="article-20260814-000001",
        prepared=prepared,
        created_at=now,
    )
    repository.insert_review_case(
        tx,
        review_case_id="review-1",
        check_id="check-1",
        prepared=prepared,
        decision=decision,
        created_at=now,
    )
    resolution = {
        "resolutionRequestId": "resolution-1",
        "reviewCaseId": "review-1",
        "expectedCaseVersion": 1,
        "action": "APPROVE_UNIQUE",
        "administratorId": "admin-1",
    }
    repository.insert_resolution_processing(
        tx,
        request=resolution,
        request_digest=b"x" * 32,
        requested_at=now,
    )
    repository.complete_resolution(
        tx,
        resolution_request_id="resolution-1",
        status="SUCCESS",
        final_decision="UNIQUE",
        final_check_id="check-1",
        matched_article_id=None,
        new_article_id="article-20260814-000001",
        error=None,
        completed_at=now,
    )


def test_mysql_settings_and_retryable_error_mapping() -> None:
    MySQLSettings(
        host="mysql",
        port=3306,
        user="runtime",
        password="secret",
        database="tech_articles",
    ).validate()

    pool = MySQLConnectionPool.__new__(MySQLConnectionPool)
    deadlock = RuntimeError("deadlock")
    deadlock.errno = 1213  # type: ignore[attr-defined]
    mapped = pool.persistence_error(deadlock)
    assert mapped.code == "ADMISSION_DEADLOCK"
    assert mapped.retryable is True
