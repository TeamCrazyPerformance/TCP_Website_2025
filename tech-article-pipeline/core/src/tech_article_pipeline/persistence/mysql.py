from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from tech_article_pipeline.catalog import language_projection, source_projection
from tech_article_pipeline.contracts import (
    CrawlJobRecord,
    JobRecord,
    PublicationPolicy,
    Stage,
)

from .base import IdempotencyConflictError, NotFoundError, VersionConflictError


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def _decode(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _payload_digest(value: dict[str, Any]) -> bytes:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).digest()


class MySQLPipelineRepository:
    """MySQL 8.4 repository sharing the admission module's connection pool."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    def _connection(self) -> Any:
        connection = self._pool.get_connection()
        connection.autocommit = False
        cursor = connection.cursor()
        try:
            cursor.execute("SET SESSION time_zone = '+00:00'")
        finally:
            cursor.close()
        return connection

    def check_readiness(self) -> None:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT version FROM pipeline_migration_history "
                    "WHERE version IN ('001', '002', '003')"
                )
                if {row["version"] for row in cursor.fetchall()} != {"001", "002", "003"}:
                    raise RuntimeError("required pipeline migrations have not been applied")
                cursor.execute("SELECT 1 AS ready")
                cursor.fetchone()
            finally:
                cursor.close()
        finally:
            connection.close()

    def submit(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
    ) -> tuple[dict[str, Any], bool]:
        submission_id = f"submission-{uuid4().hex}"
        job_id = f"job-{uuid4().hex}"
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "INSERT IGNORE INTO pipeline_submissions "
                    "(submission_id, idempotency_key, body_digest, payload, state) "
                    "VALUES (%s, %s, %s, %s, 'QUEUED')",
                    (submission_id, idempotency_key, body_digest, _json(payload)),
                )
                created = cursor.rowcount == 1
                cursor.execute(
                    "SELECT submission_id, body_digest, initial_job_id "
                    "FROM pipeline_submissions WHERE idempotency_key = %s FOR UPDATE",
                    (idempotency_key,),
                )
                row = cursor.fetchone()
                assert row is not None
                if bytes(row["body_digest"]) != body_digest:
                    raise IdempotencyConflictError(idempotency_key)
                submission_id = row["submission_id"]
                if created:
                    cursor.execute(
                        "INSERT INTO pipeline_jobs "
                        "(job_id, submission_id, unique_key, stage, status, max_attempts) "
                        "VALUES (%s, %s, %s, 'ADMISSION', 'PENDING', %s)",
                        (job_id, submission_id, f"{submission_id}:ADMISSION", max_attempts),
                    )
                    cursor.execute(
                        "UPDATE pipeline_submissions SET initial_job_id = %s "
                        "WHERE submission_id = %s",
                        (job_id, submission_id),
                    )
                else:
                    job_id = row["initial_job_id"]
                cursor.execute(
                    "SELECT stage, status FROM pipeline_jobs WHERE job_id = %s", (job_id,)
                )
                job = cursor.fetchone()
                assert job is not None
                connection.commit()
                return {
                    "submissionId": submission_id,
                    "jobId": job_id,
                    "stage": job["stage"],
                    "status": job["status"],
                }, created
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def submit_crawl(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
    ) -> tuple[dict[str, Any], bool]:
        crawl_run_id = f"crawl-run-{uuid4().hex}"
        job_id = f"crawl-job-{uuid4().hex}"
        now = datetime.now(UTC)
        request_payload = dict(payload)
        request_payload["crawlRunId"] = crawl_run_id
        request_payload["requestedAt"] = now.isoformat().replace("+00:00", "Z")
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "INSERT IGNORE INTO crawl_runs "
                    "(crawl_run_id, idempotency_key, body_digest, source_id, job_id, status, "
                    "request_payload) VALUES (%s, %s, %s, %s, %s, 'QUEUED', %s)",
                    (
                        crawl_run_id,
                        idempotency_key,
                        body_digest,
                        payload["source"]["sourceId"],
                        job_id,
                        _json(request_payload),
                    ),
                )
                created = cursor.rowcount == 1
                cursor.execute(
                    "SELECT crawl_run_id, body_digest, source_id, job_id, status "
                    "FROM crawl_runs WHERE idempotency_key = %s FOR UPDATE",
                    (idempotency_key,),
                )
                row = cursor.fetchone()
                assert row is not None
                if bytes(row["body_digest"]) != body_digest:
                    raise IdempotencyConflictError(idempotency_key)
                crawl_run_id = row["crawl_run_id"]
                job_id = row["job_id"]
                if created:
                    cursor.execute(
                        "INSERT INTO crawl_jobs "
                        "(job_id, crawl_run_id, status, max_attempts) "
                        "VALUES (%s, %s, 'PENDING', %s)",
                        (job_id, crawl_run_id, max_attempts),
                    )
                    job_status = "PENDING"
                else:
                    cursor.execute(
                        "SELECT status FROM crawl_jobs WHERE job_id = %s", (job_id,)
                    )
                    job_status = cursor.fetchone()["status"]
                connection.commit()
                return {
                    "crawlRunId": crawl_run_id,
                    "jobId": job_id,
                    "sourceId": row["source_id"],
                    "status": row["status"],
                    "jobStatus": job_status,
                }, created
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def get_crawl_run(self, crawl_run_id: str) -> dict[str, Any] | None:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT r.*, j.status AS job_status, j.attempt_count, j.max_attempts, "
                    "j.available_at, j.lease_expires_at, j.result AS job_result, "
                    "j.error AS job_error FROM crawl_runs r JOIN crawl_jobs j "
                    "ON j.job_id = r.job_id WHERE r.crawl_run_id = %s",
                    (crawl_run_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    return None
                cursor.execute(
                    "SELECT crawl_item_id, item_payload, normalization_payload, submission_id "
                    "FROM crawl_items WHERE crawl_run_id = %s ORDER BY created_at",
                    (crawl_run_id,),
                )
                items = []
                for item in cursor.fetchall():
                    raw = _decode(item["item_payload"])
                    items.append(
                        {
                            "crawlItemId": item["crawl_item_id"],
                            "crawlStatus": raw.get("crawl", {}).get("status"),
                            "submissionId": item["submission_id"],
                            "normalizationStatus": (
                                "SUCCESS" if item["normalization_payload"] is not None else None
                            ),
                        }
                    )
                return {
                    "crawlRunId": row["crawl_run_id"],
                    "sourceId": row["source_id"],
                    "status": row["status"],
                    "requestPayload": _decode(row["request_payload"]),
                    "statistics": _decode(row["statistics"]),
                    "error": _decode(row["error"]),
                    "job": {
                        "jobId": row["job_id"],
                        "crawlRunId": row["crawl_run_id"],
                        "status": row["job_status"],
                        "attemptCount": int(row["attempt_count"]),
                        "maxAttempts": int(row["max_attempts"]),
                        "availableAt": _utc(row["available_at"]),
                        "leaseExpiresAt": _utc(row["lease_expires_at"]),
                        "result": _decode(row["job_result"]),
                        "error": _decode(row["job_error"]),
                    },
                    "items": items,
                }
            finally:
                cursor.close()
        finally:
            connection.close()

    def claim_crawl_job(self, *, lease_seconds: int) -> CrawlJobRecord | None:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                expired_error = _json(
                    {
                        "code": "LEASE_EXPIRED",
                        "message": "Crawler worker lease expired.",
                        "retryable": True,
                    }
                )
                cursor.execute(
                    "UPDATE crawl_jobs SET status = IF(attempt_count < max_attempts, 'RETRY', 'DEAD'), "
                    "error = %s, lease_token = NULL, lease_expires_at = NULL "
                    "WHERE status = 'RUNNING' AND lease_expires_at < UTC_TIMESTAMP(6)",
                    (expired_error,),
                )
                cursor.execute(
                    "UPDATE crawl_runs r JOIN crawl_jobs j ON j.crawl_run_id = r.crawl_run_id "
                    "SET r.status = IF(j.status = 'DEAD', 'FAILED', 'RETRY'), r.error = j.error "
                    "WHERE j.error = %s AND j.status IN ('RETRY', 'DEAD')",
                    (expired_error,),
                )
                cursor.execute(
                    "SELECT * FROM crawl_jobs WHERE status IN ('PENDING', 'RETRY') "
                    "AND available_at <= UTC_TIMESTAMP(6) "
                    "ORDER BY available_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
                )
                row = cursor.fetchone()
                if row is None:
                    connection.commit()
                    return None
                lease_token = uuid4().hex
                cursor.execute(
                    "UPDATE crawl_jobs SET status = 'RUNNING', attempt_count = attempt_count + 1, "
                    "lease_token = %s, lease_expires_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL %s SECOND) "
                    "WHERE job_id = %s",
                    (lease_token, lease_seconds, row["job_id"]),
                )
                cursor.execute(
                    "UPDATE crawl_runs SET status = 'RUNNING', started_at = COALESCE(started_at, "
                    "UTC_TIMESTAMP(6)) WHERE crawl_run_id = %s",
                    (row["crawl_run_id"],),
                )
                connection.commit()
                return CrawlJobRecord.model_validate(
                    {
                        "jobId": row["job_id"],
                        "crawlRunId": row["crawl_run_id"],
                        "status": "RUNNING",
                        "attemptCount": int(row["attempt_count"]) + 1,
                        "maxAttempts": int(row["max_attempts"]),
                        "availableAt": _utc(row["available_at"]),
                        "leaseExpiresAt": datetime.now(UTC).replace(microsecond=0)
                        + timedelta(seconds=lease_seconds),
                        "leaseToken": lease_token,
                        "result": _decode(row["result"]),
                        "error": _decode(row["error"]),
                    }
                )
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def complete_crawl_job(
        self, job: CrawlJobRecord, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                normalized_by_id = {
                    item["crawlItemId"]: item for item in result["normalizedArticles"]
                }
                submission_count = 0
                for item in result["crawlItems"]:
                    item_id = item["crawlItemId"]
                    normalized = normalized_by_id.get(item_id)
                    submission_id = None
                    if normalized is not None:
                        digest = _payload_digest(normalized)
                        idempotency_key = f"crawl:{job.crawl_run_id}:{item_id}"
                        candidate_submission_id = f"submission-{uuid4().hex}"
                        cursor.execute(
                            "INSERT IGNORE INTO pipeline_submissions "
                            "(submission_id, idempotency_key, body_digest, payload, state) "
                            "VALUES (%s, %s, %s, %s, 'QUEUED')",
                            (
                                candidate_submission_id,
                                idempotency_key,
                                digest,
                                _json(normalized),
                            ),
                        )
                        created = cursor.rowcount == 1
                        cursor.execute(
                            "SELECT submission_id, body_digest FROM pipeline_submissions "
                            "WHERE idempotency_key = %s FOR UPDATE",
                            (idempotency_key,),
                        )
                        submission = cursor.fetchone()
                        assert submission is not None
                        if bytes(submission["body_digest"]) != digest:
                            raise IdempotencyConflictError(idempotency_key)
                        submission_id = submission["submission_id"]
                        if created:
                            child_job_id = f"job-{uuid4().hex}"
                            cursor.execute(
                                "INSERT INTO pipeline_jobs "
                                "(job_id, submission_id, unique_key, stage, status, max_attempts) "
                                "VALUES (%s, %s, %s, 'ADMISSION', 'PENDING', %s)",
                                (
                                    child_job_id,
                                    submission_id,
                                    f"{submission_id}:ADMISSION",
                                    max_attempts,
                                ),
                            )
                            cursor.execute(
                                "UPDATE pipeline_submissions SET initial_job_id = %s "
                                "WHERE submission_id = %s",
                                (child_job_id, submission_id),
                            )
                        submission_count += 1
                    cursor.execute(
                        "INSERT INTO crawl_items "
                        "(crawl_item_id, crawl_run_id, item_payload, normalization_payload, "
                        "submission_id, produced_at) VALUES (%s, %s, %s, %s, %s, UTC_TIMESTAMP(6)) "
                        "ON DUPLICATE KEY UPDATE item_payload = VALUES(item_payload), "
                        "normalization_payload = VALUES(normalization_payload), "
                        "submission_id = VALUES(submission_id)",
                        (
                            item_id,
                            job.crawl_run_id,
                            _json(item),
                            _json(normalized) if normalized else None,
                            submission_id,
                        ),
                    )
                completion = result["completion"]
                normalization_error = (
                    _json({"normalizationFailures": result["normalizationFailures"]})
                    if result["normalizationFailures"]
                    else None
                )
                cursor.execute(
                    "UPDATE crawl_runs SET status = %s, statistics = %s, error = %s, "
                    "completed_at = UTC_TIMESTAMP(6) WHERE crawl_run_id = %s",
                    (
                        completion["status"],
                        _json(completion.get("statistics", {})),
                        normalization_error,
                        job.crawl_run_id,
                    ),
                )
                job_result = {
                    "completion": completion,
                    "submissionCount": submission_count,
                    "normalizationFailures": result["normalizationFailures"],
                }
                cursor.execute(
                    "UPDATE crawl_jobs SET status = 'SUCCEEDED', result = %s, error = NULL, "
                    "lease_token = NULL, lease_expires_at = NULL "
                    "WHERE job_id = %s AND lease_token = %s",
                    (_json(job_result), job.job_id, job.lease_token),
                )
                if cursor.rowcount != 1:
                    raise VersionConflictError("crawler job lease changed")
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def fail_crawl_job(
        self,
        job: CrawlJobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None:
        status = "RETRY" if retryable and job.attempt_count < job.max_attempts else "DEAD"
        run_status = "RETRY" if status == "RETRY" else "FAILED"
        connection = self._connection()
        try:
            cursor = connection.cursor()
            try:
                for item in error.get("details", {}).get("crawlItems", []):
                    cursor.execute(
                        "INSERT INTO crawl_items "
                        "(crawl_item_id, crawl_run_id, item_payload, produced_at) "
                        "VALUES (%s, %s, %s, UTC_TIMESTAMP(6)) "
                        "ON DUPLICATE KEY UPDATE item_payload = VALUES(item_payload), "
                        "produced_at = VALUES(produced_at)",
                        (item["crawlItemId"], job.crawl_run_id, _json(item)),
                    )
                cursor.execute(
                    "UPDATE crawl_jobs SET status = %s, error = %s, available_at = %s, "
                    "lease_token = NULL, lease_expires_at = NULL "
                    "WHERE job_id = %s AND lease_token = %s",
                    (
                        status,
                        _json(error),
                        available_at.astimezone(UTC).replace(tzinfo=None),
                        job.job_id,
                        job.lease_token,
                    ),
                )
                if cursor.rowcount != 1:
                    raise VersionConflictError("crawler job lease changed")
                cursor.execute(
                    "UPDATE crawl_runs SET status = %s, error = %s, "
                    "completed_at = IF(%s = 'FAILED', UTC_TIMESTAMP(6), NULL) "
                    "WHERE crawl_run_id = %s",
                    (run_status, _json(error), run_status, job.crawl_run_id),
                )
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT j.*, s.state AS pipeline_state, s.article_id "
                    "FROM pipeline_jobs j JOIN pipeline_submissions s "
                    "ON s.submission_id = j.submission_id WHERE j.job_id = %s",
                    (job_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    return None
                projection = self._job_projection(row)
                cursor.execute(
                    "SELECT * FROM pipeline_jobs WHERE submission_id = %s "
                    "ORDER BY created_at", (row["submission_id"],)
                )
                projection.update(
                    {
                        "pipelineState": row["pipeline_state"],
                        "articleId": row["article_id"],
                        "jobs": [
                            self._job_projection(item) for item in cursor.fetchall()
                        ],
                    }
                )
                return projection
            finally:
                cursor.close()
        finally:
            connection.close()

    @staticmethod
    def _job_projection(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "jobId": row["job_id"],
            "submissionId": row["submission_id"],
            "stage": row["stage"],
            "status": row["status"],
            "attemptCount": int(row["attempt_count"]),
            "maxAttempts": int(row["max_attempts"]),
            "availableAt": _utc(row["available_at"]),
            "leaseExpiresAt": _utc(row["lease_expires_at"]),
            "leaseToken": row["lease_token"],
            "result": _decode(row["result"]),
            "error": _decode(row["error"]),
        }

    def claim_job(self, *, lease_seconds: int) -> JobRecord | None:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "UPDATE pipeline_jobs SET "
                    "status = IF(attempt_count < max_attempts, 'RETRY', 'DEAD'), "
                    "lease_token = NULL, lease_expires_at = NULL, "
                    "error = JSON_OBJECT('code', 'LEASE_EXPIRED', 'message', "
                    "'Worker lease expired.', 'retryable', TRUE) "
                    "WHERE status = 'RUNNING' AND lease_expires_at < UTC_TIMESTAMP(6)"
                )
                cursor.execute(
                    "UPDATE pipeline_submissions s JOIN pipeline_jobs j "
                    "ON j.submission_id = s.submission_id "
                    "SET s.state = 'PROCESSING_FAILED' "
                    "WHERE j.status = 'DEAD' "
                    "AND JSON_UNQUOTE(JSON_EXTRACT(j.error, '$.code')) = 'LEASE_EXPIRED'"
                )
                cursor.execute(
                    "UPDATE articles a JOIN pipeline_submissions s ON s.article_id = a.article_id "
                    "JOIN pipeline_jobs j ON j.submission_id = s.submission_id "
                    "SET a.processing_status = 'PROCESSING_FAILED', "
                    "a.record_version = a.record_version + 1 "
                    "WHERE j.status = 'DEAD' "
                    "AND JSON_UNQUOTE(JSON_EXTRACT(j.error, '$.code')) = 'LEASE_EXPIRED' "
                    "AND a.processing_status <> 'PROCESSING_FAILED'"
                )
                cursor.execute(
                    "SELECT * FROM pipeline_jobs "
                    "WHERE status IN ('PENDING', 'RETRY') "
                    "AND available_at <= UTC_TIMESTAMP(6) "
                    "ORDER BY available_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED"
                )
                row = cursor.fetchone()
                if row is None:
                    connection.commit()
                    return None
                token = uuid4().hex
                cursor.execute(
                    "UPDATE pipeline_jobs SET status = 'RUNNING', "
                    "attempt_count = attempt_count + 1, lease_token = %s, "
                    "lease_expires_at = DATE_ADD(UTC_TIMESTAMP(6), INTERVAL %s SECOND) "
                    "WHERE job_id = %s",
                    (token, lease_seconds, row["job_id"]),
                )
                cursor.execute("SELECT * FROM pipeline_jobs WHERE job_id = %s", (row["job_id"],))
                claimed = cursor.fetchone()
                connection.commit()
                assert claimed is not None
                return JobRecord.model_validate(self._job_projection(claimed))
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def get_submission(self, submission_id: str) -> dict[str, Any]:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT s.*, EXISTS("
                    "SELECT 1 FROM quality_review_cases q "
                    "WHERE q.submission_id = s.submission_id "
                    "AND q.status = 'RESOLVED_APPROVE'"
                    ") AS quality_review_approved "
                    "FROM pipeline_submissions s WHERE s.submission_id = %s",
                    (submission_id,),
                )
                row = cursor.fetchone()
                if row is None:
                    raise NotFoundError(submission_id)
                for name in ("payload", "admission_result", "quality_result", "enrichment_result"):
                    row[name] = _decode(row[name])
                row["quality_review_approved"] = bool(
                    row["quality_review_approved"]
                )
                return row
            finally:
                cursor.close()
        finally:
            connection.close()

    def mark_admission_result(self, submission_id: str, result: dict[str, Any]) -> None:
        outcome = result["outcome"]
        article_id = None
        review_case_id = None
        if outcome == "ARTICLE_INGESTED":
            state = "QUALITY_PENDING"
            article_id = result["articleIngested"]["articleId"]
        elif outcome == "DUPLICATE_REVIEW_REQUESTED":
            state = "DUPLICATE_REVIEW_PENDING"
            review_case_id = result["reviewCase"]["reviewCaseId"]
        else:
            state = "DUPLICATE"
        self._update_submission(
            submission_id,
            "state = %s, article_id = %s, duplicate_review_case_id = %s, admission_result = %s",
            (state, article_id, review_case_id, _json(result)),
        )

    def mark_quality_result(self, submission_id: str, result: dict[str, Any]) -> None:
        evaluation = result["qualityEvaluation"]
        decision = evaluation["decision"]
        score = evaluation.get("score", {}).get("overall")
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT article_id FROM pipeline_submissions "
                    "WHERE submission_id = %s FOR UPDATE",
                    (submission_id,),
                )
                submission = cursor.fetchone()
                if not submission or not submission["article_id"]:
                    raise NotFoundError(submission_id)
                article_id = submission["article_id"]
                if decision == "PASS":
                    state, processing, review = "ENRICHMENT_PENDING", "ENRICHMENT_PENDING", "NOT_REQUIRED"
                elif decision == "REVIEW_REQUIRED":
                    state, processing, review = "QUALITY_REVIEW_PENDING", "QUALITY_EVALUATED", "PENDING"
                else:
                    state, processing, review = "QUALITY_REJECTED", "QUALITY_REJECTED", "NOT_REQUIRED"
                cursor.execute(
                    "UPDATE pipeline_submissions SET state = %s, quality_result = %s "
                    "WHERE submission_id = %s",
                    (state, _json(result), submission_id),
                )
                cursor.execute(
                    "UPDATE articles SET quality_score = %s, quality_decision = %s, "
                    "processing_status = %s, review_status = %s, "
                    "record_version = record_version + 1 WHERE article_id = %s",
                    (score, decision, processing, review, article_id),
                )
                cursor.execute(
                    "INSERT INTO article_processing_results "
                    "(article_id, submission_id, stage, status, result_payload) "
                    "VALUES (%s, %s, 'QUALITY', 'SUCCESS', %s) "
                    "ON DUPLICATE KEY UPDATE status = VALUES(status), "
                    "result_payload = VALUES(result_payload), error = NULL",
                    (article_id, submission_id, _json(result)),
                )
                if decision == "REVIEW_REQUIRED":
                    cursor.execute(
                        "INSERT IGNORE INTO quality_review_cases "
                        "(case_id, submission_id, article_id, evaluation_payload, status) "
                        "VALUES (%s, %s, %s, %s, 'PENDING')",
                        (f"quality-review-{uuid4().hex}", submission_id, article_id, _json(result)),
                    )
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def mark_enrichment_result(
        self,
        submission_id: str,
        result: dict[str, Any],
        publication_policy: PublicationPolicy,
    ) -> None:
        enrichment = result["enrichment"]
        published = publication_policy == PublicationPolicy.IMMEDIATE
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT article_id FROM pipeline_submissions "
                    "WHERE submission_id = %s FOR UPDATE", (submission_id,)
                )
                submission = cursor.fetchone()
                if not submission or not submission["article_id"]:
                    raise NotFoundError(submission_id)
                article_id = submission["article_id"]
                state = "PUBLISHED" if published else "PUBLICATION_REVIEW_PENDING"
                cursor.execute(
                    "UPDATE pipeline_submissions SET state = %s, enrichment_result = %s "
                    "WHERE submission_id = %s", (state, _json(result), submission_id)
                )
                cursor.execute(
                    "UPDATE articles SET localized_title = %s, tags = %s, "
                    "one_line_summary = %s, summary = %s, localized_content = %s, "
                    "processing_status = 'ENRICHED', review_status = %s, "
                    "publication_status = %s, published_at = %s, "
                    "record_version = record_version + 1 WHERE article_id = %s",
                    (
                        enrichment.get("localizedTitle"),
                        _json(enrichment.get("tags", [])),
                        enrichment.get("oneLineSummary"),
                        enrichment.get("summary"),
                        enrichment.get("localizedContent"),
                        "NOT_REQUIRED" if published else "PENDING",
                        "PUBLISHED" if published else "UNPUBLISHED",
                        datetime.now(UTC).replace(tzinfo=None) if published else None,
                        article_id,
                    ),
                )
                cursor.execute(
                    "INSERT INTO article_processing_results "
                    "(article_id, submission_id, stage, status, result_payload) "
                    "VALUES (%s, %s, 'ENRICHMENT', 'SUCCESS', %s) "
                    "ON DUPLICATE KEY UPDATE status = VALUES(status), "
                    "result_payload = VALUES(result_payload), error = NULL",
                    (article_id, submission_id, _json(result)),
                )
                if published:
                    cursor.execute(
                        "INSERT INTO publication_events "
                        "(article_id, action, previous_status, new_status, administrator_id, reason) "
                        "VALUES (%s, 'PUBLISH', 'UNPUBLISHED', 'PUBLISHED', 'pipeline-system', "
                        "'Immediate publication policy')", (article_id,)
                    )
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def enqueue(
        self,
        submission_id: str,
        stage: Stage,
        *,
        max_attempts: int,
        unique_key: str,
    ) -> str:
        job_id = f"job-{uuid4().hex}"
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "INSERT IGNORE INTO pipeline_jobs "
                    "(job_id, submission_id, unique_key, stage, status, max_attempts) "
                    "VALUES (%s, %s, %s, %s, 'PENDING', %s)",
                    (job_id, submission_id, unique_key, stage.value, max_attempts),
                )
                cursor.execute("SELECT job_id FROM pipeline_jobs WHERE unique_key = %s", (unique_key,))
                row = cursor.fetchone()
                connection.commit()
                assert row is not None
                return row["job_id"]
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def complete_job(self, job: JobRecord, result: dict[str, Any]) -> None:
        self._finish_job(job, "SUCCEEDED", result=result, error=None)

    def fail_job(
        self,
        job: JobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None:
        status = "RETRY" if retryable and job.attempt_count < job.max_attempts else "DEAD"
        connection = self._connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute(
                    "UPDATE pipeline_jobs SET status = %s, error = %s, available_at = %s, "
                    "lease_token = NULL, lease_expires_at = NULL "
                    "WHERE job_id = %s AND lease_token = %s",
                    (status, _json(error), available_at.astimezone(UTC).replace(tzinfo=None), job.job_id, job.lease_token),
                )
                if cursor.rowcount != 1:
                    raise VersionConflictError("job lease changed")
                cursor.execute(
                    "INSERT INTO article_processing_results "
                    "(article_id, submission_id, stage, status, error) "
                    "SELECT article_id, submission_id, %s, 'FAILED', %s "
                    "FROM pipeline_submissions WHERE submission_id = %s "
                    "AND article_id IS NOT NULL "
                    "ON DUPLICATE KEY UPDATE status = 'FAILED', error = VALUES(error)",
                    (job.stage.value, _json(error), job.submission_id),
                )
                if status == "DEAD":
                    cursor.execute(
                        "UPDATE pipeline_submissions SET state = 'PROCESSING_FAILED' "
                        "WHERE submission_id = %s", (job.submission_id,)
                    )
                    cursor.execute(
                        "UPDATE articles a JOIN pipeline_submissions s ON s.article_id = a.article_id "
                        "SET a.processing_status = 'PROCESSING_FAILED', "
                        "a.record_version = a.record_version + 1 "
                        "WHERE s.submission_id = %s", (job.submission_id,)
                    )
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _finish_job(
        self,
        job: JobRecord,
        status: str,
        *,
        result: dict[str, Any] | None,
        error: dict[str, Any] | None,
    ) -> None:
        connection = self._connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute(
                    "UPDATE pipeline_jobs SET status = %s, result = %s, error = %s, "
                    "lease_token = NULL, lease_expires_at = NULL "
                    "WHERE job_id = %s AND lease_token = %s",
                    (status, _json(result) if result else None, _json(error) if error else None, job.job_id, job.lease_token),
                )
                if cursor.rowcount != 1:
                    raise VersionConflictError("job lease changed")
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def publication_policy(self) -> tuple[PublicationPolicy, int]:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT setting_value, record_version FROM pipeline_settings "
                    "WHERE setting_key = 'publication_policy'"
                )
                row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("publication policy setting is missing")
                return PublicationPolicy(row["setting_value"]), int(row["record_version"])
            finally:
                cursor.close()
        finally:
            connection.close()

    def set_publication_policy(
        self, policy: PublicationPolicy, expected_version: int | None
    ) -> tuple[PublicationPolicy, int]:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT setting_value, record_version FROM pipeline_settings "
                    "WHERE setting_key = 'publication_policy' FOR UPDATE"
                )
                row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("publication policy setting is missing")
                version = int(row["record_version"])
                if expected_version is not None and expected_version != version:
                    raise VersionConflictError("publication policy version changed")
                if row["setting_value"] != policy.value:
                    version += 1
                    cursor.execute(
                        "UPDATE pipeline_settings SET setting_value = %s, record_version = %s "
                        "WHERE setting_key = 'publication_policy'", (policy.value, version)
                    )
                connection.commit()
                return policy, version
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _article_conditions(
        *,
        public_only: bool = False,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
        publication_status: str | None = None,
        include_admin_fields: bool = False,
        extra: str | None = None,
    ) -> tuple[str, tuple[Any, ...]]:
        clauses: list[str] = []
        params: list[Any] = []
        if public_only:
            clauses.extend(
                ["a.processing_status = 'ENRICHED'", "a.publication_status = 'PUBLISHED'"]
            )
        if keyword:
            like = f"%{keyword.lower()}%"
            if include_admin_fields:
                clauses.append(
                    "(LOWER(COALESCE(a.localized_title, a.title)) LIKE %s "
                    "OR LOWER(COALESCE(a.one_line_summary, '')) LIKE %s "
                    "OR LOWER(a.source_id) LIKE %s "
                    "OR LOWER(CAST(COALESCE(a.tags, JSON_ARRAY()) AS CHAR)) LIKE %s)"
                )
                params.extend([like, like, like, like])
            else:
                clauses.append(
                    "(LOWER(COALESCE(a.localized_title, a.title)) LIKE %s "
                    "OR LOWER(COALESCE(a.one_line_summary, '')) LIKE %s)"
                )
                params.extend([like, like])
        if tags:
            clauses.append(
                "(" + " OR ".join(
                    "JSON_CONTAINS(COALESCE(a.tags, JSON_ARRAY()), JSON_QUOTE(%s))"
                    for _ in tags
                ) + ")"
            )
            params.extend(tags)
        if publication_status:
            clauses.append("a.publication_status = %s")
            params.append(publication_status)
        if extra:
            clauses.append(extra)
        return " AND ".join(clauses) if clauses else "1 = 1", tuple(params)

    def list_public_articles(
        self,
        *,
        limit: int,
        offset: int,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
    ) -> list[dict[str, Any]]:
        where, params = self._article_conditions(
            public_only=True, keyword=keyword, tags=tags
        )
        return self._list_articles(
            where, params, limit=limit, offset=offset, sort="NEWEST"
        )

    def count_public_articles(
        self, *, keyword: str | None = None, tags: tuple[str, ...] = ()
    ) -> int:
        where, params = self._article_conditions(
            public_only=True, keyword=keyword, tags=tags
        )
        return self._count_articles(where, params)

    def last_crawled_at(self) -> datetime | None:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute("SELECT MAX(produced_at) FROM crawl_items")
                return _utc(cursor.fetchone()[0])
            finally:
                cursor.close()
        finally:
            connection.close()

    def get_public_article(self, article_id: str) -> dict[str, Any] | None:
        rows = self._list_articles(
            "a.article_id = %s AND a.processing_status = 'ENRICHED' "
            "AND a.publication_status = 'PUBLISHED'",
            (article_id,),
            limit=1,
            offset=0,
            sort="NEWEST",
        )
        return rows[0] if rows else None

    def list_articles(
        self,
        *,
        limit: int,
        offset: int,
        keyword: str | None = None,
        publication_status: str | None = None,
        sort: str = "NEWEST",
    ) -> list[dict[str, Any]]:
        where, params = self._article_conditions(
            keyword=keyword,
            publication_status=publication_status,
            include_admin_fields=True,
        )
        return self._list_articles(where, params, limit=limit, offset=offset, sort=sort)

    def count_articles(
        self, *, keyword: str | None = None, publication_status: str | None = None
    ) -> int:
        where, params = self._article_conditions(
            keyword=keyword,
            publication_status=publication_status,
            include_admin_fields=True,
        )
        return self._count_articles(where, params)

    def get_article(self, article_id: str) -> dict[str, Any] | None:
        rows = self._list_articles(
            "a.article_id = %s", (article_id,), limit=1, offset=0, sort="NEWEST"
        )
        return rows[0] if rows else None

    def _count_articles(self, where: str, params: tuple[Any, ...]) -> int:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute(f"SELECT COUNT(*) FROM articles a WHERE {where}", params)
                return int(cursor.fetchone()[0])
            finally:
                cursor.close()
        finally:
            connection.close()

    def _list_articles(
        self,
        where: str,
        params: tuple[Any, ...],
        *,
        limit: int,
        offset: int,
        sort: str,
    ) -> list[dict[str, Any]]:
        order_by = {
            "NEWEST": "COALESCE(a.original_published_at, a.created_at) DESC, a.article_id DESC",
            "SCORE_DESC": "a.quality_score DESC, a.article_id DESC",
            "SCORE_ASC": "a.quality_score ASC, a.article_id ASC",
        }[sort]
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT a.article_id, a.crawl_run_id, a.crawl_item_id, a.source_id, "
                    "a.title, a.authors, a.content, a.language, a.original_published_at, "
                    "a.canonical_url, a.quality_score, a.quality_decision, a.localized_title, "
                    "a.tags, a.one_line_summary, a.summary, a.localized_content, "
                    "a.processing_status, a.review_status, a.publication_status, "
                    "a.published_at, a.record_version, a.created_at, a.updated_at, "
                    "ps.payload AS submission_payload, ps.quality_result, "
                    "ci.item_payload AS crawl_item_payload, ci.produced_at AS collected_at "
                    "FROM articles a "
                    "LEFT JOIN pipeline_submissions ps ON ps.article_id = a.article_id "
                    "LEFT JOIN crawl_items ci ON ci.crawl_item_id = a.crawl_item_id "
                    f"WHERE {where} ORDER BY {order_by} LIMIT %s OFFSET %s",
                    (*params, limit, offset),
                )
                return [self._article_projection(row) for row in cursor.fetchall()]
            finally:
                cursor.close()
        finally:
            connection.close()

    @staticmethod
    def _article_projection(row: dict[str, Any]) -> dict[str, Any]:
        submission = _decode(row.get("submission_payload")) or {}
        source = submission.get("source") or {}
        quality_result = _decode(row.get("quality_result")) or {}
        return {
            "articleId": row["article_id"],
            "crawlRunId": row.get("crawl_run_id"),
            "crawlItemId": row.get("crawl_item_id"),
            "title": row["title"],
            "authors": _decode(row.get("authors")) or [],
            "content": row["content"],
            "language": row["language"],
            "originalLanguage": language_projection(row.get("language")),
            "originalPublishedAt": _utc(row["original_published_at"]),
            "canonicalUrl": row["canonical_url"],
            "source": source_projection(
                row.get("source_id"), source.get("sourceType"), row.get("canonical_url")
            ),
            "collectedAt": _utc(row.get("collected_at")),
            "normalizedAt": (submission.get("normalization") or {}).get("normalizedAt"),
            "qualityScore": row["quality_score"],
            "valueScore": row["quality_score"],
            "qualityDecision": row["quality_decision"],
            "evaluation": quality_result.get("qualityEvaluation"),
            "localizedTitle": row["localized_title"],
            "tags": _decode(row["tags"]) or [],
            "oneLineSummary": row["one_line_summary"],
            "summary": row["summary"],
            "summaryMarkdown": row["summary"],
            "localizedContent": row["localized_content"],
            "processingStatus": row["processing_status"],
            "duplicateStatus": "UNIQUE",
            "reviewStatus": row["review_status"],
            "publicationStatus": row["publication_status"],
            "publishedAt": _utc(row["published_at"]),
            "recordVersion": int(row["record_version"]),
            "createdAt": _utc(row.get("created_at")),
            "updatedAt": _utc(row.get("updated_at")),
        }

    def article_stats(self) -> dict[str, Any]:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT publication_status AS value, COUNT(*) AS count "
                    "FROM articles GROUP BY publication_status"
                )
                publication = {row["value"]: int(row["count"]) for row in cursor.fetchall()}
                cursor.execute(
                    "SELECT processing_status AS value, COUNT(*) AS count "
                    "FROM articles GROUP BY processing_status"
                )
                processing = {row["value"]: int(row["count"]) for row in cursor.fetchall()}
                cursor.execute(
                    "SELECT COUNT(*) AS count FROM duplicate_review_cases WHERE status = 'PENDING'"
                )
                duplicates = int(cursor.fetchone()["count"])
                cursor.execute(
                    "SELECT COUNT(*) AS count FROM quality_review_cases WHERE status = 'PENDING'"
                )
                quality = int(cursor.fetchone()["count"])
                cursor.execute(
                    "SELECT COUNT(*) AS count FROM articles "
                    "WHERE processing_status = 'ENRICHED' AND review_status = 'PENDING'"
                )
                publication_reviews = int(cursor.fetchone()["count"])
                return {
                    "totalCount": sum(publication.values()),
                    "publication": publication,
                    "processing": processing,
                    "reviews": {
                        "duplicates": duplicates,
                        "quality": quality,
                        "publication": publication_reviews,
                    },
                }
            finally:
                cursor.close()
        finally:
            connection.close()

    @staticmethod
    def _review_conditions(
        kind: str, keyword: str | None, filter_value: str | None
    ) -> tuple[str, tuple[Any, ...]]:
        clauses = {
            "duplicate": ["r.status = 'PENDING'"],
            "quality": ["q.status = 'PENDING'"],
            "publication": [
                "a.processing_status = 'ENRICHED'",
                "a.review_status = 'PENDING'",
            ],
        }[kind]
        params: list[Any] = []
        if keyword:
            if kind == "duplicate":
                clauses.append(
                    "(LOWER(CAST(r.admission_payload AS CHAR)) LIKE %s "
                    "OR LOWER(CAST(r.original_candidate_snapshot AS CHAR)) LIKE %s)"
                )
            elif kind == "quality":
                clauses.append(
                    "(LOWER(COALESCE(a.localized_title, a.title)) LIKE %s "
                    "OR LOWER(a.source_id) LIKE %s "
                    "OR LOWER(CAST(q.evaluation_payload AS CHAR)) LIKE %s)"
                )
            else:
                clauses.append(
                    "(LOWER(COALESCE(a.localized_title, a.title)) LIKE %s "
                    "OR LOWER(COALESCE(a.one_line_summary, '')) LIKE %s "
                    "OR LOWER(a.source_id) LIKE %s "
                    "OR LOWER(CAST(COALESCE(a.tags, JSON_ARRAY()) AS CHAR)) LIKE %s)"
                )
            like = f"%{keyword.lower()}%"
            params.extend([like] * (2 if kind == "duplicate" else 3 if kind == "quality" else 4))
        if filter_value:
            if kind == "duplicate" and filter_value == "JACCARD":
                clauses.append(
                    "JSON_EXTRACT(r.original_candidate_snapshot, '$[0].contentJaccard') IS NOT NULL"
                )
            elif kind in {"quality", "publication"}:
                clauses.append(
                    "JSON_UNQUOTE(JSON_EXTRACT(ps.payload, '$.source.sourceType')) = %s"
                )
                params.append(filter_value)
        return " AND ".join(clauses), tuple(params)

    def list_review_queue(
        self,
        kind: str,
        *,
        limit: int,
        offset: int = 0,
        keyword: str | None = None,
        filter_value: str | None = None,
        sort: str = "NEWEST",
    ) -> list[dict[str, Any]]:
        where, params = self._review_conditions(kind, keyword, filter_value)
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                if kind == "duplicate":
                    order_by = (
                        "JSON_EXTRACT(r.original_candidate_snapshot, '$[0].contentJaccard') DESC"
                        if sort == "SIMILARITY_DESC"
                        else "r.created_at DESC"
                    )
                    cursor.execute(
                        "SELECT r.review_case_id AS reviewCaseId, r.original_check_id AS checkId, "
                        "r.crawl_run_id AS crawlRunId, r.crawl_item_id AS crawlItemId, "
                        "r.admission_payload AS admissionPayload, "
                        "r.original_candidate_snapshot AS candidates, r.status, "
                        "r.case_version AS caseVersion, r.created_at AS createdAt "
                        "FROM duplicate_review_cases r "
                        f"WHERE {where} ORDER BY {order_by} LIMIT %s OFFSET %s",
                        (*params, limit, offset),
                    )
                elif kind == "quality":
                    cursor.execute(
                        "SELECT q.case_id AS caseId, q.submission_id AS submissionId, "
                        "q.article_id AS articleId, q.evaluation_payload AS evaluation, q.status, "
                        "q.case_version AS caseVersion, q.created_at AS createdAt, "
                        "a.title, a.localized_title AS localizedTitle, a.source_id AS sourceId, "
                        "a.canonical_url AS canonicalUrl, a.language, a.original_published_at AS originalPublishedAt, "
                        "ps.payload AS submissionPayload "
                        "FROM quality_review_cases q JOIN articles a ON a.article_id = q.article_id "
                        "LEFT JOIN pipeline_submissions ps ON ps.submission_id = q.submission_id "
                        f"WHERE {where} ORDER BY q.created_at DESC LIMIT %s OFFSET %s",
                        (*params, limit, offset),
                    )
                elif kind == "publication":
                    cursor.execute(
                        "SELECT a.article_id AS articleId, a.title, "
                        "a.localized_title AS localizedTitle, a.one_line_summary AS oneLineSummary, "
                        "a.summary, a.tags, a.quality_score AS qualityScore, "
                        "a.review_status AS reviewStatus, a.publication_status AS publicationStatus, "
                        "a.record_version AS recordVersion, a.source_id AS sourceId, "
                        "a.canonical_url AS canonicalUrl, a.language, "
                        "a.authors, a.original_published_at AS originalPublishedAt, "
                        "a.processing_status AS processingStatus, 'UNIQUE' AS duplicateStatus, "
                        "a.created_at AS createdAt, a.updated_at AS updatedAt, "
                        "a.published_at AS publishedAt, ps.payload AS submissionPayload, "
                        "ps.quality_result AS qualityResult "
                        "FROM articles a LEFT JOIN pipeline_submissions ps ON ps.article_id = a.article_id "
                        f"WHERE {where} ORDER BY a.updated_at DESC LIMIT %s OFFSET %s",
                        (*params, limit, offset),
                    )
                else:
                    raise ValueError(f"unknown review kind: {kind}")
                rows = cursor.fetchall()
                candidate_article_ids = {
                    candidate.get("articleId")
                    for row in rows
                    for candidate in (_decode(row.get("candidates")) or [])
                    if candidate.get("articleId")
                }
                candidate_articles: dict[str, dict[str, Any]] = {}
                if candidate_article_ids:
                    placeholders = ",".join("%s" for _ in candidate_article_ids)
                    cursor.execute(
                        "SELECT a.article_id, a.title, a.localized_title, a.source_id, "
                        "a.canonical_url, a.language, a.original_published_at, "
                        "ps.payload AS submissionPayload FROM articles a "
                        "LEFT JOIN pipeline_submissions ps ON ps.article_id = a.article_id "
                        f"WHERE a.article_id IN ({placeholders})",
                        tuple(candidate_article_ids),
                    )
                    for article in cursor.fetchall():
                        candidate_submission = _decode(article.get("submissionPayload")) or {}
                        candidate_source = candidate_submission.get("source") or {}
                        candidate_articles[article["article_id"]] = {
                            "articleId": article["article_id"],
                            "title": article.get("localized_title") or article["title"],
                            "source": source_projection(
                                article.get("source_id"),
                                candidate_source.get("sourceType"),
                                article.get("canonical_url"),
                            ),
                            "articleUrl": article.get("canonical_url"),
                            "originalLanguage": language_projection(article.get("language")),
                            "originalPublishedAt": _utc(article.get("original_published_at")),
                        }
                for row in rows:
                    for key in (
                        "candidates",
                        "evaluation",
                        "admissionPayload",
                        "submissionPayload",
                        "qualityResult",
                        "tags",
                        "authors",
                    ):
                        if key in row:
                            row[key] = _decode(row[key])
                    if "caseVersion" in row:
                        row["caseVersion"] = int(row["caseVersion"])
                    if "recordVersion" in row:
                        row["recordVersion"] = int(row["recordVersion"])
                    for key in (
                        "originalPublishedAt",
                        "createdAt",
                        "updatedAt",
                        "publishedAt",
                    ):
                        if key in row:
                            row[key] = _utc(row[key])
                    submission = row.get("submissionPayload") or row.get("admissionPayload") or {}
                    source = submission.get("source") or {}
                    if row.get("sourceId") or source:
                        row["source"] = source_projection(
                            row.get("sourceId") or source.get("sourceId"),
                            source.get("sourceType"),
                            row.get("canonicalUrl")
                            or (submission.get("urls") or {}).get("canonicalUrl"),
                        )
                    if row.get("language"):
                        row["originalLanguage"] = language_projection(row["language"])
                    if isinstance(row.get("evaluation"), dict):
                        row["evaluation"] = row["evaluation"].get(
                            "qualityEvaluation", row["evaluation"]
                        )
                    if isinstance(row.get("qualityResult"), dict):
                        row["evaluation"] = row["qualityResult"].get("qualityEvaluation")
                    row.pop("qualityResult", None)
                    admission = row.pop("admissionPayload", None)
                    row.pop("submissionPayload", None)
                    if admission:
                        incoming_article = admission.get("article") or {}
                        incoming_source = admission.get("source") or {}
                        incoming_urls = admission.get("urls") or {}
                        row["candidate"] = {
                            "title": incoming_article.get("title"),
                            "source": source_projection(
                                incoming_source.get("sourceId"),
                                incoming_source.get("sourceType"),
                                incoming_urls.get("canonicalUrl"),
                            ),
                            "originalLanguage": language_projection(
                                incoming_article.get("language")
                            ),
                            "articleUrl": incoming_urls.get("canonicalUrl"),
                            "originalPublishedAt": incoming_article.get(
                                "originalPublishedAt"
                            ),
                        }
                    if row.get("candidates"):
                        row["candidates"] = [
                            candidate
                            | {"article": candidate_articles.get(candidate.get("articleId"))}
                            for candidate in row["candidates"]
                        ]
                return rows
            finally:
                cursor.close()
        finally:
            connection.close()

    def count_review_queue(
        self,
        kind: str,
        *,
        keyword: str | None = None,
        filter_value: str | None = None,
    ) -> int:
        where, params = self._review_conditions(kind, keyword, filter_value)
        table = {
            "duplicate": "duplicate_review_cases r",
            "quality": (
                "quality_review_cases q JOIN articles a ON a.article_id = q.article_id "
                "LEFT JOIN pipeline_submissions ps ON ps.submission_id = q.submission_id"
            ),
            "publication": (
                "articles a LEFT JOIN pipeline_submissions ps ON ps.article_id = a.article_id"
            ),
        }.get(kind)
        if table is None:
            raise ValueError(f"unknown review kind: {kind}")
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", params)
                return int(cursor.fetchone()[0])
            finally:
                cursor.close()
        finally:
            connection.close()

    def resolve_quality_review(
        self,
        case_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        max_attempts: int,
    ) -> dict[str, Any]:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute("SELECT * FROM quality_review_cases WHERE case_id = %s FOR UPDATE", (case_id,))
                case = cursor.fetchone()
                if case is None:
                    raise NotFoundError(case_id)
                if case["status"] != "PENDING" or int(case["case_version"]) != expected_version:
                    raise VersionConflictError(case_id)
                status = f"RESOLVED_{action}"
                cursor.execute(
                    "UPDATE quality_review_cases SET status = %s, case_version = case_version + 1, "
                    "administrator_id = %s, resolved_at = UTC_TIMESTAMP(6) WHERE case_id = %s",
                    (status, administrator_id, case_id),
                )
                if action == "APPROVE":
                    cursor.execute(
                        "UPDATE articles SET review_status = 'APPROVED', "
                        "processing_status = 'ENRICHMENT_PENDING', record_version = record_version + 1 "
                        "WHERE article_id = %s", (case["article_id"],)
                    )
                    cursor.execute(
                        "UPDATE pipeline_submissions SET state = 'ENRICHMENT_PENDING' "
                        "WHERE submission_id = %s", (case["submission_id"],)
                    )
                    job_id = f"job-{uuid4().hex}"
                    cursor.execute(
                        "INSERT IGNORE INTO pipeline_jobs "
                        "(job_id, submission_id, unique_key, stage, status, max_attempts) "
                        "VALUES (%s, %s, %s, 'ENRICHMENT', 'PENDING', %s)",
                        (job_id, case["submission_id"], f"{case['submission_id']}:ENRICHMENT", max_attempts),
                    )
                else:
                    cursor.execute(
                        "UPDATE articles SET review_status = 'REJECTED', "
                        "processing_status = 'QUALITY_REJECTED', record_version = record_version + 1 "
                        "WHERE article_id = %s", (case["article_id"],)
                    )
                    cursor.execute(
                        "UPDATE pipeline_submissions SET state = 'QUALITY_REJECTED' "
                        "WHERE submission_id = %s", (case["submission_id"],)
                    )
                connection.commit()
                return {"caseId": case_id, "status": status, "caseVersion": expected_version + 1}
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def apply_publication_action(
        self,
        article_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        reason: str,
    ) -> dict[str, Any]:
        new_status = {"PUBLISH": "PUBLISHED", "HIDE": "HIDDEN", "ARCHIVE": "ARCHIVED"}[action]
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT publication_status, record_version FROM articles "
                    "WHERE article_id = %s FOR UPDATE", (article_id,)
                )
                article = cursor.fetchone()
                if article is None:
                    raise NotFoundError(article_id)
                if int(article["record_version"]) != expected_version:
                    raise VersionConflictError(article_id)
                cursor.execute(
                    "UPDATE articles SET publication_status = %s, "
                    "review_status = IF(%s = 'PUBLISH', 'APPROVED', review_status), "
                    "published_at = IF(%s = 'PUBLISH', UTC_TIMESTAMP(6), published_at), "
                    "record_version = record_version + 1 WHERE article_id = %s",
                    (new_status, action, action, article_id),
                )
                cursor.execute(
                    "INSERT INTO publication_events "
                    "(article_id, action, previous_status, new_status, administrator_id, reason) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (article_id, action, article["publication_status"], new_status, administrator_id, reason),
                )
                connection.commit()
                return {"articleId": article_id, "publicationStatus": new_status, "recordVersion": expected_version + 1}
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def continue_after_duplicate_resolution(
        self, review_case_id: str, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        connection = self._connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT submission_id FROM pipeline_submissions "
                    "WHERE duplicate_review_case_id = %s FOR UPDATE", (review_case_id,)
                )
                row = cursor.fetchone()
                if row is None:
                    raise NotFoundError(review_case_id)
                submission_id = row["submission_id"]
                resolution = result.get("resolution", {})
                if result.get("outcome") == "RESOLUTION_COMPLETED" and resolution.get("finalDecision") == "UNIQUE":
                    article_id = resolution["newArticleId"]
                    cursor.execute(
                        "UPDATE pipeline_submissions SET state = 'QUALITY_PENDING', article_id = %s, "
                        "admission_result = %s WHERE submission_id = %s",
                        (article_id, _json(result), submission_id),
                    )
                    cursor.execute(
                        "INSERT IGNORE INTO pipeline_jobs "
                        "(job_id, submission_id, unique_key, stage, status, max_attempts) "
                        "VALUES (%s, %s, %s, 'QUALITY', 'PENDING', %s)",
                        (f"job-{uuid4().hex}", submission_id, f"{submission_id}:QUALITY", max_attempts),
                    )
                elif result.get("outcome") == "RESOLUTION_COMPLETED":
                    cursor.execute(
                        "UPDATE pipeline_submissions SET state = 'DUPLICATE', admission_result = %s "
                        "WHERE submission_id = %s", (_json(result), submission_id)
                    )
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _update_submission(self, submission_id: str, assignment: str, values: tuple[Any, ...]) -> None:
        connection = self._connection()
        try:
            cursor = connection.cursor()
            try:
                cursor.execute(
                    f"UPDATE pipeline_submissions SET {assignment} WHERE submission_id = %s",
                    (*values, submission_id),
                )
                if cursor.rowcount != 1:
                    raise NotFoundError(submission_id)
                connection.commit()
            finally:
                cursor.close()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()
