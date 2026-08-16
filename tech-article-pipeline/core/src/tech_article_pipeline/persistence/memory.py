from __future__ import annotations

import copy
import hashlib
import json
import threading
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from tech_article_pipeline.contracts import (
    CrawlJobRecord,
    JobRecord,
    PublicationPolicy,
    Stage,
)

from .base import IdempotencyConflictError, NotFoundError, VersionConflictError


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
        self.events: list[dict[str, Any]] = []
        self.policy = PublicationPolicy.IMMEDIATE
        self.policy_version = 1
        self.crawl_runs: dict[str, dict[str, Any]] = {}
        self.crawl_idempotency: dict[str, str] = {}
        self.crawl_jobs: dict[str, dict[str, Any]] = {}
        self.crawl_items: dict[str, dict[str, Any]] = {}

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
    ) -> tuple[dict[str, Any], bool]:
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
                "status": "QUEUED",
                "request_payload": request_payload,
                "job_id": job_id,
                "statistics": None,
                "error": None,
                "created_at": now,
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
                item
                for item in self.crawl_items.values()
                if item["crawl_run_id"] == crawl_run_id
            ]
            return copy.deepcopy(
                {
                    "crawlRunId": crawl_run_id,
                    "sourceId": run["source_id"],
                    "status": run["status"],
                    "requestPayload": run["request_payload"],
                    "statistics": run.get("statistics"),
                    "error": run.get("error"),
                    "job": self._external_crawl_job(job),
                    "items": [
                        {
                            "crawlItemId": item["crawl_item_id"],
                            "crawlStatus": item["item_payload"].get("crawl", {}).get("status"),
                            "submissionId": item.get("submission_id"),
                            "normalizationStatus": (
                                "SUCCESS" if item.get("normalization_payload") else None
                            ),
                        }
                        for item in items
                    ],
                }
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
                    self.crawl_runs[job["crawl_run_id"]]["status"] = (
                        "RETRY" if can_retry else "FAILED"
                    )
            candidates = sorted(
                (
                    job
                    for job in self.crawl_jobs.values()
                    if job["status"] in {"PENDING", "RETRY"}
                    and job["available_at"] <= now
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
            self.crawl_runs[job["crawl_run_id"]]["status"] = "RUNNING"
            return CrawlJobRecord.model_validate(self._external_crawl_job(job))

    def complete_crawl_job(
        self, job: CrawlJobRecord, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        with self._lock:
            stored_job = self.crawl_jobs[job.job_id]
            if stored_job.get("lease_token") != job.lease_token:
                raise VersionConflictError("crawler job lease changed")
            normalized_by_id = {
                item["crawlItemId"]: item for item in result["normalizedArticles"]
            }
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
                }
            completion = result["completion"]
            run = self.crawl_runs[job.crawl_run_id]
            run["status"] = completion["status"]
            run["statistics"] = copy.deepcopy(completion.get("statistics"))
            run["error"] = (
                {"normalizationFailures": copy.deepcopy(result["normalizationFailures"])}
                if result["normalizationFailures"]
                else None
            )
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
            stored.update(
                {
                    "status": "RETRY" if retry else "DEAD",
                    "error": copy.deepcopy(error),
                    "available_at": available_at,
                    "lease_token": None,
                    "lease_expires_at": None,
                }
            )
            run = self.crawl_runs[job.crawl_run_id]
            run["status"] = "RETRY" if retry else "FAILED"
            run["error"] = copy.deepcopy(error)
            for item in error.get("details", {}).get("crawlItems", []):
                self.crawl_items[item["crawlItemId"]] = {
                    "crawl_item_id": item["crawlItemId"],
                    "crawl_run_id": job.crawl_run_id,
                    "item_payload": copy.deepcopy(item),
                    "normalization_payload": None,
                    "submission_id": None,
                }

    def _crawl_response(self, run: dict[str, Any]) -> dict[str, Any]:
        job = self.crawl_jobs.get(run["job_id"])
        return {
            "crawlRunId": run["crawl_run_id"],
            "jobId": run["job_id"],
            "sourceId": run["source_id"],
            "status": run["status"],
            "jobStatus": job["status"] if job else "PENDING",
        }

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
            "leaseToken": job.get("lease_token"),
            "result": job.get("result"),
            "error": job.get("error"),
        }

    @staticmethod
    def _submission_response(
        submission: dict[str, Any], job: dict[str, Any]
    ) -> dict[str, Any]:
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
                        self.submissions[job["submission_id"]]["state"] = (
                            "PROCESSING_FAILED"
                        )
            candidates = sorted(
                (
                    job
                    for job in self.jobs.values()
                    if job["status"] in {"PENDING", "RETRY"}
                    and job["available_at"] <= now
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
            return JobRecord.model_validate(self._external_job(job) | {
                "leaseToken": job["lease_token"]
            })

    def get_submission(self, submission_id: str) -> dict[str, Any]:
        with self._lock:
            try:
                return copy.deepcopy(self.submissions[submission_id])
            except KeyError as exc:
                raise NotFoundError(submission_id) from exc

    def mark_admission_result(self, submission_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            submission = self.submissions[submission_id]
            outcome = result["outcome"]
            submission["admission_result"] = copy.deepcopy(result)
            if outcome == "ARTICLE_INGESTED":
                article = result["articleIngested"]
                article_id = article["articleId"]
                submission["article_id"] = article_id
                submission["state"] = "QUALITY_PENDING"
                self.articles.setdefault(
                    article_id,
                    {
                        "articleId": article_id,
                        "title": article["article"]["title"],
                        "content": article["article"]["content"],
                        "language": article["article"]["language"],
                        "processingStatus": "INGESTED",
                        "reviewStatus": "NOT_REQUIRED",
                        "publicationStatus": "UNPUBLISHED",
                        "recordVersion": 1,
                    },
                )
            elif outcome == "DUPLICATE_REVIEW_REQUESTED":
                submission["state"] = "DUPLICATE_REVIEW_PENDING"
                submission["duplicate_review_case_id"] = result["reviewCase"]["reviewCaseId"]
            else:
                submission["state"] = "DUPLICATE"

    def mark_quality_result(self, submission_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            submission = self.submissions[submission_id]
            article = self.articles[submission["article_id"]]
            evaluation = result["qualityEvaluation"]
            submission["quality_result"] = copy.deepcopy(result)
            article["qualityScore"] = evaluation.get("score", {}).get("overall")
            decision = evaluation["decision"]
            article["qualityDecision"] = decision
            article["recordVersion"] += 1
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
                    "score": evaluation.get("score"),
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
            stored.update(status="SUCCEEDED", result=copy.deepcopy(result), lease_token=None, lease_expires_at=None)

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

    def list_public_articles(self, *, limit: int, offset: int) -> list[dict[str, Any]]:
        with self._lock:
            values = [
                article for article in self.articles.values()
                if article["processingStatus"] == "ENRICHED"
                and article["publicationStatus"] == "PUBLISHED"
            ]
            return copy.deepcopy(values[offset:offset + limit])

    def get_public_article(self, article_id: str) -> dict[str, Any] | None:
        with self._lock:
            article = self.articles.get(article_id)
            if not article or article["processingStatus"] != "ENRICHED" or article["publicationStatus"] != "PUBLISHED":
                return None
            return copy.deepcopy(article)

    def list_articles(self, *, limit: int, offset: int) -> list[dict[str, Any]]:
        with self._lock:
            return copy.deepcopy(list(self.articles.values())[offset:offset + limit])

    def list_review_queue(self, kind: str, *, limit: int) -> list[dict[str, Any]]:
        with self._lock:
            if kind == "quality":
                return copy.deepcopy(
                    [case for case in self.quality_reviews.values() if case["status"] == "PENDING"][:limit]
                )
            if kind == "publication":
                return copy.deepcopy(
                    [article for article in self.articles.values() if article["processingStatus"] == "ENRICHED" and article["reviewStatus"] == "PENDING"][:limit]
                )
            return []

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
                self.enqueue(case["submissionId"], Stage.ENRICHMENT, max_attempts=max_attempts, unique_key=f"{case['submissionId']}:ENRICHMENT")
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
            self.events.append({"articleId": article_id, "action": action, "administratorId": administrator_id, "reason": reason})
            return copy.deepcopy(article)

    def continue_after_duplicate_resolution(
        self, review_case_id: str, result: dict[str, Any], *, max_attempts: int
    ) -> None:
        with self._lock:
            submission = next(
                (item for item in self.submissions.values() if item.get("duplicate_review_case_id") == review_case_id),
                None,
            )
            if submission is None:
                raise NotFoundError(review_case_id)
            if result.get("outcome") != "RESOLUTION_COMPLETED":
                return
            resolution = result["resolution"]
            if resolution["finalDecision"] == "UNIQUE":
                self.mark_admission_result(submission["submission_id"], {
                    "outcome": "ARTICLE_INGESTED",
                    "articleIngested": result["articleIngested"],
                })
                self.enqueue(submission["submission_id"], Stage.QUALITY, max_attempts=max_attempts, unique_key=f"{submission['submission_id']}:QUALITY")
            else:
                submission["state"] = "DUPLICATE"
