from __future__ import annotations

import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from developer_news_summarizer.models import DeveloperNewsInput
from tech_article_admission import create_memory_admission_service
from tech_article_pipeline.contracts import (
    NormalizedArticleCandidate,
    PublicationPolicy,
    Stage,
)
from tech_article_pipeline.orchestration import PipelineOrchestrator
from tech_article_pipeline.persistence.base import (
    IdempotencyConflictError,
    InvalidArticleActionError,
)
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.worker import DurableWorker
from tech_article_quality import QualityEvaluator


class FakeAdmission:
    def admit(self, payload):
        return {
            "outcome": "ARTICLE_INGESTED",
            "articleIngested": {
                "articleId": f"article-{payload['crawlItemId']}",
                "article": payload["article"],
            },
        }

    def resolve_review(self, payload):
        return payload


class FakeQuality:
    def __init__(self, decision="PASS"):
        self.decision = decision
        self.module_version = "9.1.0"

    def evaluate(self, input_data):
        return {
            "articleId": input_data["articleId"],
            "qualityEvaluation": {
                "status": "SUCCESS",
                "decision": self.decision,
                "evaluatorVersion": self.module_version,
                "policyVersion": input_data["qualityPolicy"]["policyVersion"],
                "score": {"overall": 88, "dimensions": {}},
                "error": None,
            },
        }


class FlakyQuality(FakeQuality):
    def __init__(self):
        super().__init__()
        self.calls = 0

    def evaluate(self, input_data):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("quality service unavailable")
        return super().evaluate(input_data)


class FakeSummarizer:
    def __init__(self, *, failures=0, retryable=True, error_code="MODEL_TIMEOUT"):
        self.failures = failures
        self.retryable = retryable
        self.error_code = error_code
        self.calls = 0
        self.module_version = "8.2.0"
        self.model = "fake-model-1"
        self.prompt_version = "fake-prompt-v3"

    def process(self, input_data):
        self.calls += 1
        if self.calls <= self.failures:
            return {
                "articleId": input_data["articleId"],
                "enrichment": None,
                "generation": {
                    "status": "FAILED",
                    "summarizerVersion": self.module_version,
                    "model": self.model,
                    "promptVersion": self.prompt_version,
                    "error": {
                        "code": self.error_code,
                        "message": "timeout",
                        "retryable": self.retryable,
                    },
                },
            }
        return {
            "articleId": input_data["articleId"],
            "enrichment": {
                "language": "ko",
                "localizedTitle": "번역 제목",
                "tags": ["애플리케이션 개발"],
                "oneLineSummary": "개발자를 위한 한 줄 요약입니다.",
                "summary": "개발자를 위한 충분히 자세한 기사 요약입니다.",
                "localizedContent": None,
            },
            "generation": {
                "status": "SUCCESS",
                "summarizerVersion": self.module_version,
                "model": self.model,
                "promptVersion": self.prompt_version,
                "error": None,
            },
        }


class ContractValidatingSummarizer(FakeSummarizer):
    def __init__(self):
        super().__init__()
        self.last_input = None

    def process(self, input_data):
        validated = DeveloperNewsInput.model_validate(input_data)
        self.last_input = validated.model_dump(by_alias=True, mode="json")
        return super().process(input_data)


def digest(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).digest()


def runtime(
    normalized_payload,
    *,
    decision="PASS",
    quality=None,
    summarizer=None,
    attempts=3,
):
    repository = MemoryPipelineRepository()
    orchestrator = PipelineOrchestrator(
        repository,
        FakeAdmission(),
        quality or FakeQuality(decision),
        summarizer or FakeSummarizer(),
        job_max_attempts=attempts,
    )
    worker = DurableWorker(repository, orchestrator, lease_seconds=30)
    submission, _ = repository.submit(
        idempotency_key="key-1",
        body_digest=digest(normalized_payload),
        payload=normalized_payload,
        max_attempts=attempts,
    )
    return repository, worker, submission


def test_unique_pass_enrichment_immediately_publishes(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)

    assert worker.process_once() is True
    assert worker.process_once() is True
    assert worker.process_once() is True

    job = repository.get_job(submission["jobId"])
    assert job["status"] == "SUCCEEDED"
    public = repository.list_public_articles(limit=10, offset=0)
    assert len(public) == 1
    assert public[0]["articleId"]
    assert "processingStatus" not in public[0]
    assert "publicationStatus" not in public[0]


def test_real_admission_and_quality_modules_connect_to_core(normalized_payload):
    normalized_payload = NormalizedArticleCandidate.model_validate(normalized_payload).model_dump(
        by_alias=True, mode="json"
    )
    repository = MemoryPipelineRepository()
    summarizer = ContractValidatingSummarizer()
    orchestrator = PipelineOrchestrator(
        repository,
        create_memory_admission_service(),
        QualityEvaluator(),
        summarizer,
        job_max_attempts=3,
    )
    worker = DurableWorker(repository, orchestrator)
    submission, _ = repository.submit(
        idempotency_key="real-modules",
        body_digest=digest(normalized_payload),
        payload=normalized_payload,
        max_attempts=3,
    )
    assert all(worker.process_once() for _ in range(3))
    job = repository.get_job(submission["jobId"])
    assert job["pipelineState"] == "PUBLISHED"
    assert [item["stage"] for item in job["jobs"]] == [
        "ADMISSION",
        "QUALITY",
        "ENRICHMENT",
    ]
    stored = repository.get_submission(submission["submissionId"])
    score = stored["quality_result"]["qualityEvaluation"]["score"]
    assert [axis["key"] for axis in score["axes"]] == [
        "relevance",
        "technicalDepth",
        "timeliness",
        "articleQuality",
    ]
    assert summarizer.last_input is not None
    assert set(summarizer.last_input["qualityEvaluation"]["score"]) == {"overall"}


def test_review_publication_policy_does_not_expose_article(normalized_payload):
    repository, worker, _ = runtime(normalized_payload)
    repository.set_publication_policy(PublicationPolicy.REVIEW, 1)
    for _ in range(3):
        worker.process_once()

    assert repository.list_public_articles(limit=10, offset=0) == []
    queue = repository.list_review_queue("publication", limit=10)
    assert queue[0]["reviewStatus"] == "PENDING"


def test_quality_review_approval_enqueues_enrichment(normalized_payload):
    summarizer = ContractValidatingSummarizer()
    repository, worker, submission = runtime(
        normalized_payload,
        decision="REVIEW_REQUIRED",
        summarizer=summarizer,
    )
    worker.process_once()
    worker.process_once()
    case = repository.list_review_queue("quality", limit=10)[0]

    repository.resolve_quality_review(
        case["caseId"],
        action="APPROVE",
        expected_version=1,
        administrator_id="admin-1",
        max_attempts=3,
    )
    worker.process_once()

    assert len(repository.list_public_articles(limit=10, offset=0)) == 1
    assert summarizer.last_input is not None
    assert summarizer.last_input["qualityEvaluation"]["decision"] == "PASS"
    stored = repository.get_submission(submission["submissionId"])
    assert stored["quality_result"]["qualityEvaluation"]["decision"] == "REVIEW_REQUIRED"
    assert stored["quality_review_approved"] is True


def test_unapproved_quality_review_cannot_run_enrichment(normalized_payload):
    summarizer = ContractValidatingSummarizer()
    repository, worker, submission = runtime(
        normalized_payload,
        decision="REVIEW_REQUIRED",
        summarizer=summarizer,
    )
    worker.process_once()
    worker.process_once()
    enrichment_job_id = repository.enqueue(
        submission["submissionId"],
        Stage.ENRICHMENT,
        max_attempts=3,
        unique_key=f"{submission['submissionId']}:UNAPPROVED_ENRICHMENT",
    )

    worker.process_once()

    enrichment_job = repository.jobs[enrichment_job_id]
    assert enrichment_job["status"] == "DEAD"
    assert enrichment_job["error"]["code"] == "ARTICLE_NOT_ELIGIBLE"
    assert summarizer.calls == 0


def test_admin_can_override_automatic_quality_rejection(normalized_payload):
    summarizer = ContractValidatingSummarizer()
    repository, worker, submission = runtime(
        normalized_payload,
        decision="REJECT",
        summarizer=summarizer,
    )
    worker.process_once()
    worker.process_once()
    rejected = repository.list_review_queue("rejected", limit=10)
    assert len(rejected) == 1

    article = rejected[0]
    result = repository.reprocess_article(
        article["articleId"],
        action="APPROVE_QUALITY",
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        max_attempts=3,
    )

    assert result["processingStatus"] == "ENRICHMENT_PENDING"
    assert repository.list_review_queue("rejected", limit=10) == []
    assert worker.process_once() is True
    assert len(repository.list_public_articles(limit=10, offset=0)) == 1
    stored = repository.get_submission(submission["submissionId"])
    assert stored["quality_result"]["qualityEvaluation"]["decision"] == "REJECT"
    assert stored["quality_review_approved"] is True
    assert summarizer.last_input is not None


def test_failed_enrichment_can_be_requeued_and_completed(normalized_payload):
    summarizer = FakeSummarizer(failures=1, retryable=False)
    repository, worker, submission = runtime(
        normalized_payload,
        summarizer=summarizer,
        attempts=1,
    )
    assert worker.process_once() is True
    assert worker.process_once() is True
    assert worker.process_once() is True

    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    assert article["processingStatus"] == "PROCESSING_FAILED"
    failure = repository.get_processing_failure(article["articleId"])
    assert failure is not None
    assert failure["stage"] == "ENRICHMENT"
    assert failure["code"] == "MODEL_TIMEOUT"
    assert failure["message"] == "timeout"
    assert failure["retryable"] is False
    assert failure["attemptCount"] == 1
    assert failure["maxAttempts"] == 1
    assert failure["failedAt"] is not None
    result = repository.reprocess_article(
        article["articleId"],
        action="RETRY",
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        max_attempts=1,
    )

    assert result["stage"] == "ENRICHMENT"
    assert result["processingStatus"] == "ENRICHMENT_PENDING"
    assert worker.process_once() is True
    assert len(repository.list_public_articles(limit=10, offset=0)) == 1


def test_summary_regeneration_updates_only_summary_after_success(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)
    assert all(worker.process_once() for _ in range(3))
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    original = {
        "processingStatus": article["processingStatus"],
        "reviewStatus": article["reviewStatus"],
        "publicationStatus": article["publicationStatus"],
        "publishedAt": article["publishedAt"],
        "summary": article["summary"],
        "recordVersion": article["recordVersion"],
    }
    next_summarizer = FakeSummarizer()
    next_summarizer.module_version = "8.3.0"
    next_summarizer.model = "fake-model-2"
    next_summarizer.prompt_version = "fake-prompt-v4"
    next_orchestrator = PipelineOrchestrator(
        repository,
        FakeAdmission(),
        FakeQuality(),
        next_summarizer,
        job_max_attempts=1,
    )
    target = next_orchestrator.module_versions()["aiSummarizer"]

    outdated = repository.list_articles(
        limit=10,
        offset=0,
        summary_version_status="OUTDATED",
        current_summary_version=target,
    )
    assert [item["articleId"] for item in outdated] == [article["articleId"]]
    queued = repository.regenerate_summary(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=target,
        max_attempts=1,
    )
    assert queued["status"] == "PENDING"
    assert queued["recordVersion"] == original["recordVersion"]
    queued_job = repository.get_job(queued["jobId"])
    assert queued_job["purpose"] == "SUMMARY_REGENERATION"
    assert queued_job["requestedBy"] == "admin-1"
    assert queued_job["targetVersions"] == target
    assert article["processingStatus"] == original["processingStatus"]
    assert article["publicationStatus"] == original["publicationStatus"]
    assert article["summary"] == original["summary"]

    assert DurableWorker(repository, next_orchestrator).process_once() is True

    assert article["processingStatus"] == original["processingStatus"]
    assert article["reviewStatus"] == original["reviewStatus"]
    assert article["publicationStatus"] == original["publicationStatus"]
    assert article["publishedAt"] == original["publishedAt"]
    assert article["recordVersion"] == original["recordVersion"] + 1
    assert article["processingVersions"]["aiSummarizer"] == {
        **target,
        "completedAt": article["processingVersions"]["aiSummarizer"]["completedAt"],
    }
    assert (
        repository.count_articles(
            summary_version_status="OUTDATED",
            current_summary_version=target,
        )
        == 0
    )


def test_untracked_versions_are_separate_update_candidates(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)
    assert all(worker.process_once() for _ in range(3))
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    article["processingVersions"]["qualityEvaluator"] = None
    article["processingVersions"]["aiSummarizer"] = None
    quality_target = worker.orchestrator.module_versions()["qualityEvaluator"]
    summary_target = worker.orchestrator.module_versions()["aiSummarizer"]

    assert (
        repository.list_articles(
            limit=10,
            offset=0,
            quality_version_status="OUTDATED",
            current_quality_version=quality_target,
        )
        == []
    )
    assert (
        repository.list_articles(
            limit=10,
            offset=0,
            summary_version_status="OUTDATED",
            current_summary_version=summary_target,
        )
        == []
    )
    assert [
        item["articleId"]
        for item in repository.list_articles(
            limit=10,
            offset=0,
            quality_version_status="UNTRACKED",
            current_quality_version=quality_target,
        )
    ] == [article["articleId"]]
    assert [
        item["articleId"]
        for item in repository.list_articles(
            limit=10,
            offset=0,
            summary_version_status="UNTRACKED",
            current_summary_version=summary_target,
        )
    ] == [article["articleId"]]

    summary_job = repository.regenerate_summary(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=summary_target,
        max_attempts=1,
    )
    quality_job = repository.recalculate_quality(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=quality_target,
        max_attempts=1,
    )
    assert summary_job["status"] == "PENDING"
    assert quality_job["status"] == "PENDING"


def test_failed_summary_regeneration_preserves_public_article(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)
    assert all(worker.process_once() for _ in range(3))
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    original = {
        key: copy.deepcopy(article.get(key))
        for key in (
            "localizedTitle",
            "tags",
            "oneLineSummary",
            "summary",
            "localizedContent",
            "processingStatus",
            "reviewStatus",
            "publicationStatus",
            "publishedAt",
            "recordVersion",
            "processingVersions",
        )
    }
    failing = FakeSummarizer(failures=1, retryable=False)
    failing.module_version = "8.3.0"
    failing.model = "fake-model-2"
    failing.prompt_version = "fake-prompt-v4"
    next_orchestrator = PipelineOrchestrator(
        repository,
        FakeAdmission(),
        FakeQuality(),
        failing,
        job_max_attempts=1,
    )
    queued = repository.regenerate_summary(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=next_orchestrator.module_versions()["aiSummarizer"],
        max_attempts=1,
    )

    assert DurableWorker(repository, next_orchestrator).process_once() is True

    assert repository.jobs[queued["jobId"]]["status"] == "DEAD"
    assert repository.jobs[queued["jobId"]]["purpose"] == "SUMMARY_REGENERATION"
    assert repository.get_processing_failure(article["articleId"]) is None
    for key, value in original.items():
        assert article.get(key) == value
    assert repository.get_submission(submission["submissionId"])["state"] == "PUBLISHED"




def test_retired_quality_recalculation_preserves_public_article(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)
    assert all(worker.process_once() for _ in range(3))
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    original = copy.deepcopy(article)
    original_quality_result = copy.deepcopy(stored["quality_result"])
    failing = FlakyQuality()
    failing.module_version = "9.2.0"
    next_orchestrator = PipelineOrchestrator(
        repository,
        FakeAdmission(),
        failing,
        FakeSummarizer(),
        job_max_attempts=1,
    )
    queued = repository.recalculate_quality(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=next_orchestrator.module_versions()["qualityEvaluator"],
        max_attempts=1,
    )

    assert DurableWorker(repository, next_orchestrator).process_once() is True

    assert repository.jobs[queued["jobId"]]["status"] == "DEAD"
    assert failing.calls == 0
    assert repository.jobs[queued["jobId"]]["purpose"] == "QUALITY_RECALCULATION"
    assert repository.get_processing_failure(article["articleId"]) is None
    assert article == original
    failed_submission = repository.get_submission(submission["submissionId"])
    assert failed_submission["state"] == "PUBLISHED"
    assert failed_submission["quality_result"] == original_quality_result




def test_summary_regeneration_rejects_a_worker_with_different_target_versions(
    normalized_payload,
):
    repository, worker, submission = runtime(normalized_payload)
    assert all(worker.process_once() for _ in range(3))
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    original_summary = article["summary"]
    original_version = article["recordVersion"]
    next_summarizer = FakeSummarizer()
    next_summarizer.module_version = "8.3.0"
    next_orchestrator = PipelineOrchestrator(
        repository,
        FakeAdmission(),
        FakeQuality(),
        next_summarizer,
        job_max_attempts=1,
    )
    target = {
        **next_orchestrator.module_versions()["aiSummarizer"],
        "promptVersion": "prompt-loaded-after-request",
    }
    queued = repository.regenerate_summary(
        article["articleId"],
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        target_versions=target,
        max_attempts=1,
    )

    assert DurableWorker(repository, next_orchestrator).process_once() is True

    job = repository.jobs[queued["jobId"]]
    assert job["status"] == "DEAD"
    assert job["error"]["code"] == "SUMMARY_VERSION_MISMATCH"
    assert article["summary"] == original_summary
    assert article["recordVersion"] == original_version
    assert article["publicationStatus"] == "PUBLISHED"


def test_failed_quality_evaluation_can_be_requeued_and_completed(normalized_payload):
    repository, worker, submission = runtime(
        normalized_payload,
        quality=FlakyQuality(),
        attempts=1,
    )
    assert worker.process_once() is True
    assert worker.process_once() is True

    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]
    assert article["processingStatus"] == "PROCESSING_FAILED"
    failure = repository.get_processing_failure(article["articleId"])
    assert failure is not None
    assert failure["stage"] == "QUALITY"
    assert failure["code"] == "INTERNAL_ERROR"
    assert failure["message"] == "Pipeline worker failed unexpectedly."
    assert failure["retryable"] is True
    assert failure["attemptCount"] == 1
    assert failure["maxAttempts"] == 1
    assert "details" not in failure
    result = repository.reprocess_article(
        article["articleId"],
        action="RETRY",
        expected_version=article["recordVersion"],
        administrator_id="admin-1",
        max_attempts=1,
    )

    assert result["stage"] == "QUALITY"
    assert result["processingStatus"] == "INGESTED"
    assert worker.process_once() is True
    assert worker.process_once() is True
    assert len(repository.list_public_articles(limit=10, offset=0)) == 1


def test_reprocessing_rejects_an_action_that_does_not_match_state(normalized_payload):
    repository, worker, submission = runtime(normalized_payload)
    worker.process_once()
    stored = repository.get_submission(submission["submissionId"])
    article = repository.articles[stored["article_id"]]

    with pytest.raises(InvalidArticleActionError):
        repository.reprocess_article(
            article["articleId"],
            action="RETRY",
            expected_version=article["recordVersion"],
            administrator_id="admin-1",
            max_attempts=3,
        )


def test_retryable_ai_failure_becomes_dead_after_max_attempts(normalized_payload):
    summarizer = FakeSummarizer(failures=10, retryable=True)
    repository, worker, _ = runtime(normalized_payload, summarizer=summarizer, attempts=2)
    worker.process_once()
    worker.process_once()
    worker.process_once()
    enrichment_job = next(job for job in repository.jobs.values() if job["stage"] == "ENRICHMENT")
    assert enrichment_job["status"] == "RETRY"
    enrichment_job["available_at"] = datetime.now(UTC) - timedelta(seconds=1)
    worker.process_once()
    assert enrichment_job["status"] == "DEAD"


def test_rate_limited_ai_failure_waits_beyond_one_minute(normalized_payload):
    summarizer = FakeSummarizer(failures=1, retryable=True, error_code="RATE_LIMITED")
    repository, worker, _ = runtime(normalized_payload, summarizer=summarizer)
    worker.process_once()
    worker.process_once()
    before_failure = datetime.now(UTC)

    worker.process_once()

    enrichment_job = next(job for job in repository.jobs.values() if job["stage"] == "ENRICHMENT")
    assert enrichment_job["status"] == "RETRY"
    assert enrichment_job["available_at"] >= before_failure + timedelta(seconds=64)


def test_non_rate_limited_failure_keeps_short_backoff():
    before_failure = datetime.now(UTC)

    retry_at = DurableWorker._retry_at(1, {"code": "MODEL_TIMEOUT"})

    assert retry_at < before_failure + timedelta(seconds=2)


def test_expired_lease_is_recovered(normalized_payload):
    repository, _, _ = runtime(normalized_payload)
    first = repository.claim_job(lease_seconds=5)
    assert first is not None
    repository.jobs[first.job_id]["lease_expires_at"] = datetime.now(UTC) - timedelta(seconds=1)
    recovered = repository.claim_job(lease_seconds=5)
    assert recovered is not None
    assert recovered.job_id == first.job_id
    assert recovered.attempt_count == 2


def test_expired_final_lease_becomes_dead(normalized_payload):
    repository, _, submission = runtime(normalized_payload, attempts=1)
    claimed = repository.claim_job(lease_seconds=5)
    assert claimed is not None
    repository.jobs[claimed.job_id]["lease_expires_at"] = datetime.now(UTC) - timedelta(seconds=1)
    assert repository.claim_job(lease_seconds=5) is None
    job = repository.get_job(claimed.job_id)
    assert job["status"] == "DEAD"
    assert job["pipelineState"] == "PROCESSING_FAILED"
    assert submission["jobId"] == claimed.job_id


def test_idempotency_replays_and_rejects_changed_body(normalized_payload):
    repository, _, first = runtime(normalized_payload)
    replay, created = repository.submit(
        idempotency_key="key-1",
        body_digest=digest(normalized_payload),
        payload=normalized_payload,
        max_attempts=3,
    )
    assert created is False
    assert replay["jobId"] == first["jobId"]

    changed = normalized_payload | {"crawlItemId": "item-changed"}
    with pytest.raises(IdempotencyConflictError):
        repository.submit(
            idempotency_key="key-1",
            body_digest=digest(changed),
            payload=changed,
            max_attempts=3,
        )
