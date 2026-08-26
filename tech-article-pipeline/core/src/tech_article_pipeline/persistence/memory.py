from __future__ import annotations

import copy
import hashlib
import json
import threading
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

from .base import (
    APPROVED_COMPATIBLE_PROCESSING,
    NEW_ARTICLE_WINDOW_HOURS,
    STAGE_NAMES,
    IdempotencyConflictError,
    NotFoundError,
    VersionConflictError,
    crawl_error_summary,
)


def _now() -> datetime:
    return datetime.now(UTC)


class MemoryPipelineRepository:
    """Thread-safe test/development backend; production uses MySQL."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.submissions: dict[str, dict[str, Any]] = {}
        self.idempotency: dict[str, str] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.job_keys: dict[str, str] = {}
        self.articles: dict[str, dict[str, Any]] = {}
        self.quality_reviews: dict[str, dict[str, Any]] = {}
        self.duplicate_reviews: dict[str, dict[str, Any]] = {}
        self.events: list[dict[str, Any]] = []
        self.policy = PublicationPolicy.IMMEDIATE
        self.policy_version = 1
        self.crawl_runs: dict[str, dict[str, Any]] = {}
        self.crawl_idempotency: dict[str, str] = {}
        self.crawl_jobs: dict[str, dict[str, Any]] = {}
        self.crawl_items: dict[str, dict[str, Any]] = {}
        # 아티클별 조회수. 사용자별 이력은 남기지 않습니다.
        self.article_views: dict[str, dict[str, Any]] = {}

    def check_readiness(self) -> None:
        return None

    def submit(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
    ) -> tuple[dict[str, Any], bool]:
        with self._lock:
            existing_id = self.idempotency.get(idempotency_key)
            if existing_id:
                existing = self.submissions[existing_id]
                if existing["body_digest"] != body_digest:
                    raise IdempotencyConflictError(idempotency_key)
                job = self.jobs[existing["initial_job_id"]]
                return self._submission_response(existing, job), False
            submission_id = f"submission-{uuid4().hex}"
            submission = {
                "submission_id": submission_id,
                "idempotency_key": idempotency_key,
                "body_digest": body_digest,
                "payload": copy.deepcopy(payload),
                "state": "QUEUED",
                "article_id": None,
                "duplicate_review_case_id": None,
                "created_at": _now(),
            }
            self.submissions[submission_id] = submission
            self.idempotency[idempotency_key] = submission_id
            job_id = self.enqueue(
                submission_id,
                Stage.ADMISSION,
                max_attempts=max_attempts,
                unique_key=f"{submission_id}:ADMISSION",
            )
            submission["initial_job_id"] = job_id
            return self._submission_response(submission, self.jobs[job_id]), True

    def submit_crawl(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
        trigger: str = "MANUAL",
    ) -> tuple[dict[str, Any], bool]:
        if trigger not in {"MANUAL", "SCHEDULED"}:
            raise ValueError(f"Unsupported crawl trigger: {trigger}")
        with self._lock:
            existing_id = self.crawl_idempotency.get(idempotency_key)
            if existing_id:
                existing = self.crawl_runs[existing_id]
                if existing["body_digest"] != body_digest:
                    raise IdempotencyConflictError(idempotency_key)
                return self._crawl_response(existing), False
            now = _now()
            crawl_run_id = f"crawl-run-{uuid4().hex}"
            job_id = f"crawl-job-{uuid4().hex}"
            request_payload = copy.deepcopy(payload)
            request_payload["crawlRunId"] = crawl_run_id
            request_payload["requestedAt"] = now.isoformat().replace("+00:00", "Z")
            run = {
                "crawl_run_id": crawl_run_id,
                "idempotency_key": idempotency_key,
                "body_digest": body_digest,
                "source_id": payload["source"]["sourceId"],
                "trigger_type": trigger,
                "status": "QUEUED",
                "request_payload": request_payload,
                "job_id": job_id,
                "statistics": None,
                "error": None,
                "created_at": now,
                "started_at": None,
                "completed_at": None,
                "updated_at": now,
            }
            self.crawl_runs[crawl_run_id] = run
            self.crawl_idempotency[idempotency_key] = crawl_run_id
            self.crawl_jobs[job_id] = {
                "job_id": job_id,
                "crawl_run_id": crawl_run_id,
                "status": "PENDING",
                "attempt_count": 0,
                "max_attempts": max_attempts,
                "available_at": now,
                "lease_expires_at": None,
                "lease_token": None,
                "result": None,
                "error": None,
                "created_at": now,
            }
            return self._crawl_response(run), True

    def get_crawl_run(self, crawl_run_id: str) -> dict[str, Any] | None:
        with self._lock:
            run = self.crawl_runs.get(crawl_run_id)
            if run is None:
                return None
            job = self.crawl_jobs[run["job_id"]]
            items = [
                item for item in self.crawl_items.values() if item["crawl_run_id"] == crawl_run_id
            ]
            return copy.deepcopy(
                self._external_crawl_run(
                    run,
                    job,
                    items=items,
                    include_request_payload=True,
                )
            )

    def list_crawl_runs(
        self,
        *,
        limit: int,
        offset: int = 0,
        status: str | None = None,
        source_id: str | None = None,
        trigger: str | None = None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            runs = [
                run
                for run in self.crawl_runs.values()
                if (status is None or run["status"] == status)
                and (source_id is None or run["source_id"] == source_id)
                and (trigger is None or run["trigger_type"] == trigger)
            ]
            runs.sort(
                key=lambda item: (item["created_at"], item["crawl_run_id"]),
                reverse=True,
            )
            return copy.deepcopy(
                [
                    self._external_crawl_run(
                        run,
                        self.crawl_jobs[run["job_id"]],
                        item_count=sum(
                            1
                            for item in self.crawl_items.values()
                            if item["crawl_run_id"] == run["crawl_run_id"]
                        ),
                        include_items=False,
                    )
                    for run in runs[offset : offset + limit]
                ]
            )

    def count_crawl_runs(
        self,
        *,
        status: str | None = None,
        source_id: str | None = None,
        trigger: str | None = None,
    ) -> int:
        with self._lock:
            return sum(
                1
                for run in self.crawl_runs.values()
                if (status is None or run["status"] == status)
                and (source_id is None or run["source_id"] == source_id)
                and (trigger is None or run["trigger_type"] == trigger)
            )

    def claim_crawl_job(self, *, lease_seconds: int) -> CrawlJobRecord | None:
        with self._lock:
            now = _now()
            for job in self.crawl_jobs.values():
                if job["status"] == "RUNNING" and job.get("lease_expires_at") <= now:
                    can_retry = job["attempt_count"] < job["max_attempts"]
                    job["status"] = "RETRY" if can_retry else "DEAD"
                    job["error"] = {
                        "code": "LEASE_EXPIRED",
                        "message": "Crawler worker lease expired.",
                        "retryable": can_retry,
                    }
                    job["lease_token"] = None
                    job["lease_expires_at"] = None
                    run = self.crawl_runs[job["crawl_run_id"]]
                    run["status"] = "RETRY" if can_retry else "FAILED"
                    run["error"] = copy.deepcopy(job["error"])
                    run["updated_at"] = now
                    run["completed_at"] = None if can_retry else now
            candidates = sorted(
                (
                    job
                    for job in self.crawl_jobs.values()
                    if job["status"] in {"PENDING", "RETRY"} and job["available_at"] <= now
                ),
                key=lambda item: (item["available_at"], item["created_at"]),
            )
            if not candidates:
                return None
            job = candidates[0]
            job["status"] = "RUNNING"
            job["attempt_count"] += 1
            job["lease_token"] = uuid4().hex
            job["lease_expires_at"] = now + timedelta(seconds=lease_seconds)
            run = self.crawl_runs[job["crawl_run_id"]]
            run["status"] = "RUNNING"
            run["started_at"] = run.get("started_at") or now
            run["updated_at"] = now
            return CrawlJobRecord.model_validate(
                {
                    "jobId": job["job_id"],
                    "crawlRunId": job["crawl_run_id"],
                    "status": job["status"],
                    "attemptCount": job["attempt_count"],
                    "maxAttempts": job["max_attempts"],
                    "availableAt": job["available_at"],
                    "leaseExpiresAt": job.get("lease_expires_at"),
                    "leaseToken": job.get("lease_token"),
                    "result": job.get("result"),
                    "error": job.get("error"),
                }
            )

    def complete_crawl_job(
        self, job: CrawlJobRecord, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        with self._lock:
            stored_job = self.crawl_jobs[job.job_id]
            if stored_job.get("lease_token") != job.lease_token:
                raise VersionConflictError("crawler job lease changed")
            normalized_by_id = {item["crawlItemId"]: item for item in result["normalizedArticles"]}
            for item in result["crawlItems"]:
                item_id = item["crawlItemId"]
                normalized = normalized_by_id.get(item_id)
                submission_id = None
                if normalized is not None:
                    encoded = json.dumps(
                        normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                    ).encode("utf-8")
                    response, _ = self.submit(
                        idempotency_key=f"crawl:{job.crawl_run_id}:{item_id}",
                        body_digest=hashlib.sha256(encoded).digest(),
                        payload=normalized,
                        max_attempts=max_attempts,
                    )
                    submission_id = response["submissionId"]
                self.crawl_items[item_id] = {
                    "crawl_item_id": item_id,
                    "crawl_run_id": job.crawl_run_id,
                    "item_payload": copy.deepcopy(item),
                    "normalization_payload": copy.deepcopy(normalized),
                    "submission_id": submission_id,
                    "produced_at": _now(),
                }
            completion = result["completion"]
            run = self.crawl_runs[job.crawl_run_id]
            run["status"] = completion["status"]
            run["statistics"] = copy.deepcopy(completion.get("statistics"))
            run["error"] = (
                {
                    "code": "NORMALIZATION_PARTIALLY_FAILED",
                    "message": (
                        f"{len(result['normalizationFailures'])} collected article(s) "
                        "failed normalization."
                    ),
                    "retryable": False,
                }
                if result["normalizationFailures"]
                else None
            )
            now = _now()
            run["completed_at"] = now
            run["updated_at"] = now
            stored_job.update(
                {
                    "status": "SUCCEEDED",
                    "result": {
                        "completion": completion,
                        "submissionCount": len(normalized_by_id),
                        "normalizationFailures": result["normalizationFailures"],
                    },
                    "error": None,
                    "lease_token": None,
                    "lease_expires_at": None,
                }
            )

    def fail_crawl_job(
        self,
        job: CrawlJobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None:
        with self._lock:
            stored = self.crawl_jobs[job.job_id]
            if stored.get("lease_token") != job.lease_token:
                raise VersionConflictError("crawler job lease changed")
            retry = retryable and job.attempt_count < job.max_attempts
            safe_error = crawl_error_summary(error, retryable=retry)
            stored.update(
                {
                    "status": "RETRY" if retry else "DEAD",
                    "error": safe_error,
                    "available_at": available_at,
                    "lease_token": None,
                    "lease_expires_at": None,
                }
            )
            run = self.crawl_runs[job.crawl_run_id]
            run["status"] = "RETRY" if retry else "FAILED"
            run["error"] = copy.deepcopy(safe_error)
            run["statistics"] = copy.deepcopy(
                error.get("details", {}).get("completion", {}).get("statistics")
            )
            run["updated_at"] = _now()
            run["completed_at"] = None if retry else run["updated_at"]
            for item in error.get("details", {}).get("crawlItems", []):
                self.crawl_items[item["crawlItemId"]] = {
                    "crawl_item_id": item["crawlItemId"],
                    "crawl_run_id": job.crawl_run_id,
                    "item_payload": copy.deepcopy(item),
                    "normalization_payload": None,
                    "submission_id": None,
                    "produced_at": _now(),
                }

    def _crawl_response(self, run: dict[str, Any]) -> dict[str, Any]:
        job = self.crawl_jobs.get(run["job_id"])
        return {
            "crawlRunId": run["crawl_run_id"],
            "jobId": run["job_id"],
            "sourceId": run["source_id"],
            "trigger": run["trigger_type"],
            "status": run["status"],
            "jobStatus": job["status"] if job else "PENDING",
        }

    @classmethod
    def _external_crawl_run(
        cls,
        run: dict[str, Any],
        job: dict[str, Any],
        *,
        items: list[dict[str, Any]] | None = None,
        item_count: int | None = None,
        include_items: bool = True,
        include_request_payload: bool = False,
    ) -> dict[str, Any]:
        payload = run["request_payload"]
        source = payload.get("source", {})
        count = len(items or []) if item_count is None else item_count
        status = run["status"]
        result: dict[str, Any] = {
            "crawlRunId": run["crawl_run_id"],
            "sourceId": run["source_id"],
            "sourceType": source.get("sourceType"),
            "sectionKey": source.get("sectionKey"),
            "trigger": run["trigger_type"],
            "status": status,
            "requestedAt": payload.get("requestedAt"),
            "createdAt": run.get("created_at"),
            "startedAt": run.get("started_at"),
            "completedAt": run.get("completed_at"),
            "updatedAt": run.get("updated_at"),
            "statistics": run.get("statistics"),
            "itemCount": count,
            "error": crawl_error_summary(
                run.get("error"), retryable=False if status == "FAILED" else None
            ),
            "job": cls._external_crawl_job(job),
        }
        if include_items:
            result["items"] = [
                {
                    "crawlItemId": item["crawl_item_id"],
                    "crawlStatus": item["item_payload"].get("crawl", {}).get("status"),
                    "submissionId": item.get("submission_id"),
                    "normalizationStatus": (
                        "SUCCESS" if item.get("normalization_payload") else None
                    ),
                }
                for item in (items or [])
            ]
        if include_request_payload:
            result["requestPayload"] = copy.deepcopy(payload)
        return result

    @staticmethod
    def _external_crawl_job(job: dict[str, Any]) -> dict[str, Any]:
        return {
            "jobId": job["job_id"],
            "crawlRunId": job["crawl_run_id"],
            "status": job["status"],
            "attemptCount": job["attempt_count"],
            "maxAttempts": job["max_attempts"],
            "availableAt": job["available_at"],
            "leaseExpiresAt": job.get("lease_expires_at"),
            "error": crawl_error_summary(
                job.get("error"), retryable=False if job["status"] == "DEAD" else None
            ),
        }

    @staticmethod
    def _submission_response(submission: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        return {
            "submissionId": submission["submission_id"],
            "jobId": job["job_id"],
            "stage": job["stage"],
            "status": job["status"],
        }

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self.jobs.get(job_id)
            if not job:
                return None
            submission = self.submissions[job["submission_id"]]
            projection = self._external_job(job)
            projection.update(
                {
                    "pipelineState": submission["state"],
                    "articleId": submission.get("article_id"),
                    "jobs": [
                        self._external_job(item)
                        for item in self.jobs.values()
                        if item["submission_id"] == job["submission_id"]
                    ],
                }
            )
            return copy.deepcopy(projection)

    @staticmethod
    def _external_job(job: dict[str, Any]) -> dict[str, Any]:
        return {
            "jobId": job["job_id"],
            "submissionId": job["submission_id"],
            "stage": job["stage"],
            "status": job["status"],
            "attemptCount": job["attempt_count"],
            "maxAttempts": job["max_attempts"],
            "availableAt": job["available_at"],
            "leaseExpiresAt": job.get("lease_expires_at"),
            "result": job.get("result"),
            "error": job.get("error"),
        }

    def claim_job(self, *, lease_seconds: int) -> JobRecord | None:
        with self._lock:
            now = _now()
            for job in self.jobs.values():
                if job["status"] == "RUNNING" and job.get("lease_expires_at") <= now:
                    can_retry = job["attempt_count"] < job["max_attempts"]
                    job["status"] = "RETRY" if can_retry else "DEAD"
                    job["error"] = {
                        "code": "LEASE_EXPIRED",
                        "message": "Worker lease expired.",
                        "retryable": can_retry,
                    }
                    job["lease_token"] = None
                    job["lease_expires_at"] = None
                    if not can_retry:
                        self.submissions[job["submission_id"]]["state"] = "PROCESSING_FAILED"
            candidates = sorted(
                (
                    job
                    for job in self.jobs.values()
                    if job["status"] in {"PENDING", "RETRY"} and job["available_at"] <= now
                ),
                key=lambda item: (item["available_at"], item["created_at"]),
            )
            if not candidates:
                return None
            job = candidates[0]
            job["status"] = "RUNNING"
            job["attempt_count"] += 1
            job["lease_token"] = uuid4().hex
            job["lease_expires_at"] = now + timedelta(seconds=lease_seconds)
            return JobRecord.model_validate(
                self._external_job(job) | {"leaseToken": job["lease_token"]}
            )

    def get_submission(self, submission_id: str) -> dict[str, Any]:
        with self._lock:
            try:
                submission = copy.deepcopy(self.submissions[submission_id])
            except KeyError as exc:
                raise NotFoundError(submission_id) from exc
            submission["quality_review_approved"] = any(
                review["submissionId"] == submission_id and review["status"] == "RESOLVED_APPROVE"
                for review in self.quality_reviews.values()
            )
            return submission

    def mark_admission_result(self, submission_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            submission = self.submissions[submission_id]
            outcome = result["outcome"]
            submission["admission_result"] = copy.deepcopy(result)
            if outcome == "ARTICLE_INGESTED":
                article = result["articleIngested"]
                article_id = article["articleId"]
                payload = submission["payload"]
                article_payload = payload["article"]
                now = _now()
                submission["article_id"] = article_id
                submission["state"] = "QUALITY_PENDING"
                self.articles.setdefault(
                    article_id,
                    {
                        "articleId": article_id,
                        "crawlRunId": payload["crawlRunId"],
                        "crawlItemId": payload["crawlItemId"],
                        "sourceId": payload["source"]["sourceId"],
                        "sourceType": payload["source"].get("sourceType"),
                        "title": article_payload["title"],
                        "authors": copy.deepcopy(article_payload.get("authors", [])),
                        "content": article_payload["content"],
                        "language": article_payload["language"],
                        "originalPublishedAt": article_payload.get("originalPublishedAt"),
                        "canonicalUrl": payload["urls"]["canonicalUrl"],
                        "normalizedAt": payload.get("normalization", {}).get("normalizedAt"),
                        "processingStatus": "INGESTED",
                        "reviewStatus": "NOT_REQUIRED",
                        "publicationStatus": "UNPUBLISHED",
                        "recordVersion": 1,
                        "createdAt": now,
                        "updatedAt": now,
                    },
                )
            elif outcome == "DUPLICATE_REVIEW_REQUESTED":
                submission["state"] = "DUPLICATE_REVIEW_PENDING"
                review = result["reviewCase"]
                review_case_id = review["reviewCaseId"]
                submission["duplicate_review_case_id"] = review_case_id
                self.duplicate_reviews[review_case_id] = {
                    "reviewCaseId": review_case_id,
                    "crawlRunId": submission["payload"]["crawlRunId"],
                    "crawlItemId": submission["payload"]["crawlItemId"],
                    "admissionPayload": copy.deepcopy(submission["payload"]),
                    "candidates": copy.deepcopy(
                        review.get("originalCandidateSnapshot")
                        or result.get("duplicateCheck", {}).get("candidates", [])
                    ),
                    "status": "PENDING",
                    "caseVersion": review.get("caseVersion", 1),
                    "createdAt": _now(),
                }
            else:
                submission["state"] = "DUPLICATE"

    def mark_quality_result(self, submission_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            submission = self.submissions[submission_id]
            article = self.articles[submission["article_id"]]
            evaluation = result["qualityEvaluation"]
            submission["quality_result"] = copy.deepcopy(result)
            article["qualityEvaluation"] = copy.deepcopy(evaluation)
            article["qualityScore"] = evaluation.get("score", {}).get("overall")
            decision = evaluation["decision"]
            article["qualityDecision"] = decision
            article["recordVersion"] += 1
            article["updatedAt"] = _now()
            if decision == "PASS":
                submission["state"] = "ENRICHMENT_PENDING"
                article["processingStatus"] = "ENRICHMENT_PENDING"
            elif decision == "REVIEW_REQUIRED":
                case_id = f"quality-review-{uuid4().hex}"
                submission["state"] = "QUALITY_REVIEW_PENDING"
                article["processingStatus"] = "QUALITY_EVALUATED"
                article["reviewStatus"] = "PENDING"
                self.quality_reviews[case_id] = {
                    "caseId": case_id,
                    "submissionId": submission_id,
                    "articleId": article["articleId"],
                    "status": "PENDING",
                    "caseVersion": 1,
                    "evaluation": copy.deepcopy(evaluation),
                    "createdAt": _now(),
                }
            else:
                submission["state"] = "QUALITY_REJECTED"
                article["processingStatus"] = "QUALITY_REJECTED"

    def mark_enrichment_result(
        self,
        submission_id: str,
        result: dict[str, Any],
        publication_policy: PublicationPolicy,
    ) -> None:
        with self._lock:
            submission = self.submissions[submission_id]
            article = self.articles[submission["article_id"]]
            enrichment = result["enrichment"]
            article.update(
                {
                    "localizedTitle": enrichment["localizedTitle"],
                    "tags": enrichment["tags"],
                    "oneLineSummary": enrichment["oneLineSummary"],
                    "summary": enrichment["summary"],
                    "localizedContent": enrichment["localizedContent"],
                    "processingStatus": "ENRICHED",
                }
            )
            if publication_policy == PublicationPolicy.IMMEDIATE:
                article["reviewStatus"] = "NOT_REQUIRED"
                article["publicationStatus"] = "PUBLISHED"
                article["publishedAt"] = _now()
                submission["state"] = "PUBLISHED"
            else:
                article["reviewStatus"] = "PENDING"
                article["publicationStatus"] = "UNPUBLISHED"
                submission["state"] = "PUBLICATION_REVIEW_PENDING"
            article["recordVersion"] += 1
            article["updatedAt"] = _now()
            submission["enrichment_result"] = copy.deepcopy(result)

    def enqueue(
        self,
        submission_id: str,
        stage: Stage,
        *,
        max_attempts: int,
        unique_key: str,
    ) -> str:
        with self._lock:
            if unique_key in self.job_keys:
                return self.job_keys[unique_key]
            job_id = f"job-{uuid4().hex}"
            now = _now()
            self.jobs[job_id] = {
                "job_id": job_id,
                "submission_id": submission_id,
                "stage": stage.value,
                "status": "PENDING",
                "attempt_count": 0,
                "max_attempts": max_attempts,
                "available_at": now,
                "lease_expires_at": None,
                "lease_token": None,
                "result": None,
                "error": None,
                "created_at": now,
            }
            self.job_keys[unique_key] = job_id
            return job_id

    def complete_job(self, job: JobRecord, result: dict[str, Any]) -> None:
        with self._lock:
            stored = self.jobs[job.job_id]
            if stored["lease_token"] != job.lease_token:
                raise VersionConflictError("job lease changed")
            stored.update(
                status="SUCCEEDED",
                result=copy.deepcopy(result),
                lease_token=None,
                lease_expires_at=None,
            )

    def fail_job(
        self,
        job: JobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None:
        with self._lock:
            stored = self.jobs[job.job_id]
            if stored["lease_token"] != job.lease_token:
                raise VersionConflictError("job lease changed")
            can_retry = retryable and stored["attempt_count"] < stored["max_attempts"]
            stored.update(
                status="RETRY" if can_retry else "DEAD",
                error=copy.deepcopy(error),
                available_at=available_at,
                lease_token=None,
                lease_expires_at=None,
            )
            if not can_retry:
                self.submissions[job.submission_id]["state"] = "PROCESSING_FAILED"

    def publication_policy(self) -> tuple[PublicationPolicy, int]:
        with self._lock:
            return self.policy, self.policy_version

    def set_publication_policy(
        self, policy: PublicationPolicy, expected_version: int | None
    ) -> tuple[PublicationPolicy, int]:
        with self._lock:
            if expected_version is not None and expected_version != self.policy_version:
                raise VersionConflictError("publication policy version changed")
            if policy != self.policy:
                self.policy = policy
                self.policy_version += 1
            return self.policy, self.policy_version

    @staticmethod
    def _updated_time(article: dict[str, Any]) -> str:
        value = article.get("updatedAt") or article.get("createdAt")
        return value.isoformat() if isinstance(value, datetime) else str(value or "")

    @staticmethod
    def _article_time(article: dict[str, Any]) -> str:
        value = article.get("originalPublishedAt") or article.get("createdAt")
        return value.isoformat() if isinstance(value, datetime) else str(value or "")

    @staticmethod
    def _matches_article(
        article: dict[str, Any],
        keyword: str | None,
        tags: tuple[str, ...],
        *,
        include_admin_fields: bool = False,
    ) -> bool:
        if keyword:
            values = [
                article.get("localizedTitle"),
                article.get("title"),
                article.get("oneLineSummary"),
            ]
            if include_admin_fields:
                values.extend([article.get("sourceId"), *(article.get("tags") or [])])
            haystack = " ".join(str(value or "") for value in values).casefold()
            if keyword.casefold() not in haystack:
                return False
        return not tags or bool(set(article.get("tags") or []).intersection(tags))

    # mysql.STATUS_MISMATCH_PREDICATE 와 같은 판정입니다.
    @staticmethod
    def _has_status_mismatch(article: dict[str, Any]) -> bool:
        return (
            article.get("reviewStatus") == "APPROVED"
            and article.get("processingStatus") not in APPROVED_COMPATIBLE_PROCESSING
        )

    def _quality_review_approved(self, article_id: str) -> bool:
        return any(
            case.get("articleId") == article_id and case.get("status") == "RESOLVED_APPROVE"
            for case in self.quality_reviews.values()
        )

    # mysql.STAGE_PREDICATES 와 같은 판정입니다. 한쪽만 고치면 테스트 더블이
    # 운영과 갈라지므로 반드시 함께 수정하십시오 (tests/test_stage_filter.py 가
    # 두 구현의 단계 이름 집합이 같은지 확인합니다).
    def _article_stage(self, article: dict[str, Any]) -> str:
        processing = article.get("processingStatus")
        if processing == "INGESTED":
            return "INGESTED"
        if processing == "QUALITY_EVALUATED":
            return "QUALITY_REVIEW"
        if processing == "ENRICHMENT_PENDING":
            return "ENRICHING"
        if processing == "QUALITY_REJECTED":
            return "QUALITY_REJECTED"
        if processing == "ENRICHED":
            awaiting_publication = (
                article.get("reviewStatus") == "PENDING"
                and article.get("publicationStatus") == "UNPUBLISHED"
            )
            return "PUBLICATION_REVIEW" if awaiting_publication else "COMPLETED"
        if processing == "PROCESSING_FAILED":
            approved = self._quality_review_approved(article.get("articleId", ""))
            return "FAILED_AFTER_APPROVAL" if approved else "FAILED"
        return "UNKNOWN"

    def public_source_counts(self) -> dict[str, int]:
        with self._lock:
            counts: dict[str, int] = {}
            for article in self.articles.values():
                if (
                    article["processingStatus"] == "ENRICHED"
                    and article["publicationStatus"] == "PUBLISHED"
                ):
                    key = article.get("sourceId") or "unknown"
                    counts[key] = counts.get(key, 0) + 1
            return counts

    # mysql._is_new 와 같은 판정입니다.
    @staticmethod
    def _is_new(collected_at: Any) -> bool:
        if collected_at is None:
            return False
        if isinstance(collected_at, str):
            try:
                collected_at = datetime.fromisoformat(collected_at)
            except ValueError:
                return False
        if collected_at.tzinfo is None:
            collected_at = collected_at.replace(tzinfo=UTC)
        return _now() - collected_at < timedelta(hours=NEW_ARTICLE_WINDOW_HOURS)

    def _project_article(self, article: dict[str, Any]) -> dict[str, Any]:
        projected = copy.deepcopy(article)
        crawl_item = self.crawl_items.get(str(article.get("crawlItemId")))
        collected_at = crawl_item.get("produced_at") if crawl_item else None
        projected.update(
            {
                "source": source_projection(
                    article.get("sourceId"),
                    article.get("sourceType"),
                    article.get("canonicalUrl"),
                ),
                "originalLanguage": language_projection(article.get("language")),
                "collectedAt": collected_at,
                "isNew": self._is_new(collected_at),
                "summaryMarkdown": article.get("summary"),
                "evaluation": copy.deepcopy(article.get("qualityEvaluation")),
                "valueScore": article.get("qualityScore"),
                "duplicateStatus": "UNIQUE",
                "stage": self._article_stage(article),
                "viewCounts": copy.deepcopy(
                    self.article_views.get(
                        article.get("articleId"),
                        {"member": 0, "guest": 0, "lastViewedAt": None},
                    )
                ),
            }
        )
        return projected

    def list_public_articles(
        self,
        *,
        limit: int,
        offset: int,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
        sources: tuple[str, ...] = (),
    ) -> list[dict[str, Any]]:
        with self._lock:
            values = [
                article
                for article in self.articles.values()
                if article["processingStatus"] == "ENRICHED"
                and article["publicationStatus"] == "PUBLISHED"
                and (not sources or article.get("sourceId") in sources)
                and self._matches_article(article, keyword, tags)
            ]
            values.sort(
                key=lambda item: (self._article_time(item), item.get("articleId", "")),
                reverse=True,
            )
            return [self._project_article(item) for item in values[offset : offset + limit]]

    def count_public_articles(
        self,
        *,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
        sources: tuple[str, ...] = (),
    ) -> int:
        with self._lock:
            return sum(
                1
                for article in self.articles.values()
                if article["processingStatus"] == "ENRICHED"
                and article["publicationStatus"] == "PUBLISHED"
                and (not sources or article.get("sourceId") in sources)
                and self._matches_article(article, keyword, tags)
            )

    def last_crawled_at(self) -> datetime | None:
        with self._lock:
            values = [item.get("produced_at") for item in self.crawl_items.values()]
            return max((item for item in values if item is not None), default=None)

    def get_public_article(self, article_id: str) -> dict[str, Any] | None:
        with self._lock:
            article = self.articles.get(article_id)
            if (
                not article
                or article["processingStatus"] != "ENRICHED"
                or article["publicationStatus"] != "PUBLISHED"
            ):
                return None
            return self._project_article(article)

    def list_articles(
        self,
        *,
        limit: int,
        offset: int,
        keyword: str | None = None,
        publication_status: str | None = None,
        stage: str | None = None,
        status_mismatch: bool = False,
        sort: str = "NEWEST",
    ) -> list[dict[str, Any]]:
        with self._lock:
            values = [
                article
                for article in self.articles.values()
                if (
                    publication_status is None or article["publicationStatus"] == publication_status
                )
                and (stage is None or self._article_stage(article) == stage)
                and (not status_mismatch or self._has_status_mismatch(article))
                and self._matches_article(article, keyword, (), include_admin_fields=True)
            ]
            if sort == "SCORE_DESC":
                values.sort(
                    key=lambda item: (
                        item["qualityScore"] if item.get("qualityScore") is not None else -1,
                        item.get("articleId", ""),
                    ),
                    reverse=True,
                )
            elif sort == "OLDEST":
                values.sort(
                    key=lambda item: (
                        self._updated_time(item),
                        item.get("articleId", ""),
                    )
                )
            elif sort == "SCORE_ASC":
                values.sort(
                    key=lambda item: (
                        item["qualityScore"] if item.get("qualityScore") is not None else -1,
                        item.get("articleId", ""),
                    )
                )
            else:
                values.sort(
                    key=lambda item: (self._article_time(item), item.get("articleId", "")),
                    reverse=True,
                )
            return [self._project_article(item) for item in values[offset : offset + limit]]

    def count_articles(
        self,
        *,
        keyword: str | None = None,
        publication_status: str | None = None,
        stage: str | None = None,
        status_mismatch: bool = False,
    ) -> int:
        with self._lock:
            return sum(
                1
                for article in self.articles.values()
                if (
                    publication_status is None or article["publicationStatus"] == publication_status
                )
                and (stage is None or self._article_stage(article) == stage)
                and (not status_mismatch or self._has_status_mismatch(article))
                and self._matches_article(article, keyword, (), include_admin_fields=True)
            )

    def get_article(self, article_id: str) -> dict[str, Any] | None:
        with self._lock:
            article = self.articles.get(article_id)
            return None if article is None else self._project_article(article)

    def record_article_view(self, article_id: str, *, member: bool) -> None:
        with self._lock:
            if article_id not in self.articles:
                # mysql 쪽도 articles 를 훑는 SELECT 가 0 행을 내어 같습니다.
                return
            counts = self.article_views.setdefault(
                article_id, {"member": 0, "guest": 0, "lastViewedAt": None}
            )
            counts["member" if member else "guest"] += 1
            counts["lastViewedAt"] = _now()

    def article_stats(
        self, *, keyword: str | None = None, publication_status: str | None = None
    ) -> dict[str, Any]:
        with self._lock:
            selected = [
                article
                for article in self.articles.values()
                if (
                    publication_status is None or article["publicationStatus"] == publication_status
                )
                and self._matches_article(article, keyword, (), include_admin_fields=True)
            ]
            publication: dict[str, int] = {}
            processing: dict[str, int] = {}
            for article in selected:
                publication[article["publicationStatus"]] = (
                    publication.get(article["publicationStatus"], 0) + 1
                )
                processing[article["processingStatus"]] = (
                    processing.get(article["processingStatus"], 0) + 1
                )
            stages = dict.fromkeys(STAGE_NAMES, 0)
            stage_oldest: dict[str, Any] = dict.fromkeys(STAGE_NAMES, None)
            # 비교는 정규화한 문자열로, 응답에는 원본 값을 담습니다.
            oldest_sort_key: dict[str, str] = {}
            for article in selected:
                key = self._article_stage(article)
                stages[key] = stages.get(key, 0) + 1
                seen = self._updated_time(article)
                if seen and (key not in oldest_sort_key or seen < oldest_sort_key[key]):
                    oldest_sort_key[key] = seen
                    stage_oldest[key] = article.get("updatedAt") or article.get("createdAt")
            return {
                "totalCount": len(selected),
                "publication": publication,
                "processing": processing,
                "stages": stages,
                "stageOldest": stage_oldest,
                "statusMismatch": sum(1 for item in selected if self._has_status_mismatch(item)),
                "reviews": {
                    "duplicates": self.count_review_queue("duplicate"),
                    "quality": self.count_review_queue("quality"),
                    "publication": self.count_review_queue("publication"),
                },
            }

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
        with self._lock:
            if kind == "duplicate":
                values = []
                for item in self.duplicate_reviews.values():
                    if item["status"] != "PENDING":
                        continue
                    payload = item.get("admissionPayload") or {}
                    article_payload = payload.get("article") or {}
                    urls = payload.get("urls") or {}
                    source = payload.get("source") or {}
                    projected = {
                        key: copy.deepcopy(value)
                        for key, value in item.items()
                        if key != "admissionPayload"
                    }
                    projected["candidate"] = {
                        "title": article_payload.get("title"),
                        "source": source_projection(
                            source.get("sourceId"),
                            source.get("sourceType"),
                            urls.get("canonicalUrl"),
                        ),
                        "originalLanguage": language_projection(article_payload.get("language")),
                        "articleUrl": urls.get("canonicalUrl"),
                        "originalPublishedAt": article_payload.get("originalPublishedAt"),
                    }
                    projected["candidates"] = [
                        candidate
                        | {
                            "article": self._project_article(self.articles[candidate["articleId"]])
                            if candidate.get("articleId") in self.articles
                            else None
                        }
                        for candidate in item.get("candidates", [])
                    ]
                    values.append(projected)
            elif kind == "quality":
                values = []
                for case in self.quality_reviews.values():
                    if case["status"] != "PENDING":
                        continue
                    article = self._project_article(self.articles[case["articleId"]])
                    values.append(
                        copy.deepcopy(case)
                        | {
                            "title": article.get("localizedTitle") or article.get("title"),
                            "source": article.get("source"),
                            "originalLanguage": article.get("originalLanguage"),
                            "originalPublishedAt": article.get("originalPublishedAt"),
                        }
                    )
            elif kind == "publication":
                values = [
                    self._project_article(article)
                    for article in self.articles.values()
                    if article["processingStatus"] == "ENRICHED"
                    and article["reviewStatus"] == "PENDING"
                ]
            else:
                raise ValueError(f"unknown review kind: {kind}")

            def searchable(item: dict[str, Any]) -> str:
                return json.dumps(item, ensure_ascii=False, default=str).casefold()

            if keyword:
                values = [item for item in values if keyword.casefold() in searchable(item)]
            if filter_value:
                if kind == "duplicate" and filter_value == "JACCARD":
                    values = [item for item in values if "JACCARD" in searchable(item).upper()]
                elif kind in {"quality", "publication"}:
                    values = [
                        item
                        for item in values
                        if (
                            item.get("sourceType") == filter_value
                            or item.get("source", {}).get("type") == filter_value
                        )
                    ]
            if kind == "duplicate" and sort == "SIMILARITY_DESC":
                values.sort(
                    key=lambda item: max(
                        (
                            candidate.get("contentJaccard", -1)
                            for candidate in item.get("candidates", [])
                        ),
                        default=-1,
                    ),
                    reverse=True,
                )
            else:
                values.sort(
                    key=lambda item: str(item.get("createdAt") or item.get("updatedAt") or ""),
                    reverse=True,
                )
            return copy.deepcopy(values[offset : offset + limit])

    def count_review_queue(
        self,
        kind: str,
        *,
        keyword: str | None = None,
        filter_value: str | None = None,
    ) -> int:
        return len(
            self.list_review_queue(
                kind,
                limit=max(
                    len(self.articles) + len(self.quality_reviews) + len(self.duplicate_reviews),
                    1,
                ),
                keyword=keyword,
                filter_value=filter_value,
            )
        )

    def resolve_quality_review(
        self,
        case_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        max_attempts: int,
    ) -> dict[str, Any]:
        del administrator_id
        with self._lock:
            case = self.quality_reviews.get(case_id)
            if not case:
                raise NotFoundError(case_id)
            if case["status"] != "PENDING" or case["caseVersion"] != expected_version:
                raise VersionConflictError(case_id)
            case["status"] = f"RESOLVED_{action}"
            case["caseVersion"] += 1
            article = self.articles[case["articleId"]]
            submission = self.submissions[case["submissionId"]]
            if action == "APPROVE":
                article["reviewStatus"] = "APPROVED"
                article["processingStatus"] = "ENRICHMENT_PENDING"
                submission["state"] = "ENRICHMENT_PENDING"
                self.enqueue(
                    case["submissionId"],
                    Stage.ENRICHMENT,
                    max_attempts=max_attempts,
                    unique_key=f"{case['submissionId']}:ENRICHMENT",
                )
            else:
                article["reviewStatus"] = "REJECTED"
                article["processingStatus"] = "QUALITY_REJECTED"
                submission["state"] = "QUALITY_REJECTED"
            return copy.deepcopy(case)

    def apply_publication_action(
        self,
        article_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        reason: str,
    ) -> dict[str, Any]:
        with self._lock:
            article = self.articles.get(article_id)
            if not article:
                raise NotFoundError(article_id)
            if article["recordVersion"] != expected_version:
                raise VersionConflictError(article_id)
            status = {"PUBLISH": "PUBLISHED", "HIDE": "HIDDEN", "ARCHIVE": "ARCHIVED"}[action]
            article["publicationStatus"] = status
            article["reviewStatus"] = "APPROVED" if action == "PUBLISH" else article["reviewStatus"]
            article["publishedAt"] = _now() if action == "PUBLISH" else article.get("publishedAt")
            article["recordVersion"] += 1
            self.events.append(
                {
                    "articleId": article_id,
                    "action": action,
                    "administratorId": administrator_id,
                    "reason": reason,
                }
            )
            return copy.deepcopy(article)

    def continue_after_duplicate_resolution(
        self, review_case_id: str, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        with self._lock:
            submission = next(
                (
                    item
                    for item in self.submissions.values()
                    if item.get("duplicate_review_case_id") == review_case_id
                ),
                None,
            )
            if submission is None:
                raise NotFoundError(review_case_id)
            if result.get("outcome") != "RESOLUTION_COMPLETED":
                return
            resolution = result["resolution"]
            review = self.duplicate_reviews.get(review_case_id)
            if review is not None:
                review["status"] = (
                    "RESOLVED_UNIQUE"
                    if resolution["finalDecision"] == "UNIQUE"
                    else "RESOLVED_DUPLICATE"
                )
                review["caseVersion"] += 1
            if resolution["finalDecision"] == "UNIQUE":
                self.mark_admission_result(
                    submission["submission_id"],
                    {
                        "outcome": "ARTICLE_INGESTED",
                        "articleIngested": result["articleIngested"],
                    },
                )
                self.enqueue(
                    submission["submission_id"],
                    Stage.QUALITY,
                    max_attempts=max_attempts,
                    unique_key=f"{submission['submission_id']}:QUALITY",
                )
            else:
                submission["state"] = "DUPLICATE"
