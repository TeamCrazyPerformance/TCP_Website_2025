from __future__ import annotations

from typing import Any

from tech_article_pipeline.contracts import JobPurpose, JobRecord, Stage
from tech_article_pipeline.persistence.base import PipelineRepository
from tech_article_pipeline.ports import AdmissionPort, QualityPort, SummarizerPort


class StageExecutionError(RuntimeError):
    def __init__(self, error: dict[str, Any]) -> None:
        super().__init__(str(error.get("message", "pipeline stage failed")))
        self.error = error
        self.retryable = bool(error.get("retryable", False))


class PipelineOrchestrator:
    def __init__(
        self,
        repository: PipelineRepository,
        admission: AdmissionPort,
        quality: QualityPort,
        summarizer: SummarizerPort,
        *,
        job_max_attempts: int = 3,
        quality_module_version: str | None = None,
    ) -> None:
        self.repository = repository
        self.admission = admission
        self.quality = quality
        self.summarizer = summarizer
        self.job_max_attempts = job_max_attempts
        self.quality_module_version = quality_module_version

    def module_versions(self) -> dict[str, dict[str, str]]:
        return {
            "qualityEvaluator": {
                "moduleVersion": str(
                    self.quality_module_version
                    or getattr(self.quality, "module_version", "unknown")
                ),
            },
            "aiSummarizer": {
                "moduleVersion": str(getattr(self.summarizer, "module_version", "unknown")),
                "model": str(getattr(self.summarizer, "model", "unknown")),
                "promptVersion": str(getattr(self.summarizer, "prompt_version", "unknown")),
            },
        }

    def execute(self, job: JobRecord) -> dict[str, Any]:
        submission = self.repository.get_submission(job.submission_id)
        if job.stage == Stage.ADMISSION:
            return self._admit(job, submission)
        if job.stage == Stage.QUALITY:
            return self._quality(job, submission)
        if job.stage == Stage.ENRICHMENT:
            return self._enrich(job, submission)
        raise StageExecutionError(
            {"code": "UNKNOWN_STAGE", "message": str(job.stage), "retryable": False}
        )

    def _admit(self, job: JobRecord, submission: dict[str, Any]) -> dict[str, Any]:
        result = self.admission.admit(submission["payload"])
        if result.get("outcome") == "ADMISSION_FAILED":
            raise StageExecutionError(result["error"])
        self.repository.mark_admission_result(job.submission_id, result)
        if result["outcome"] == "ARTICLE_INGESTED":
            self.repository.enqueue(
                job.submission_id,
                Stage.QUALITY,
                max_attempts=self.job_max_attempts,
                unique_key=f"{job.submission_id}:QUALITY",
            )
        return result

    def _quality(self, job: JobRecord, submission: dict[str, Any]) -> dict[str, Any]:
        if job.purpose == JobPurpose.QUALITY_RECALCULATION:
            raise StageExecutionError({
                "code": "QUALITY_RECALCULATION_RETIRED",
                "message": "Quality recalculation is no longer supported.",
                "retryable": False,
            })
        payload = submission["payload"]
        article_id = submission.get("article_id") or submission.get("articleId")
        if not article_id:
            raise StageExecutionError(
                {
                    "code": "PIPELINE_STATE_INVALID",
                    "message": "Quality stage has no admitted article ID.",
                    "retryable": False,
                }
            )
        request = {
            "articleId": article_id,
            "source": {"sourceId": payload["source"]["sourceId"]},
            "article": payload["article"],
            "qualityPolicy": payload["qualityPolicy"],
        }
        result = self.quality.evaluate(request)
        evaluation = result["qualityEvaluation"]
        if evaluation["status"] == "FAILED":
            raise StageExecutionError(evaluation["error"])
        self.repository.mark_quality_result(job.submission_id, result)
        if evaluation["decision"] == "PASS":
            self.repository.enqueue(
                job.submission_id,
                Stage.ENRICHMENT,
                max_attempts=self.job_max_attempts,
                unique_key=f"{job.submission_id}:ENRICHMENT",
            )
        return result

    def _enrich(self, job: JobRecord, submission: dict[str, Any]) -> dict[str, Any]:
        payload = submission["payload"]
        quality_result = submission.get("quality_result") or submission.get("qualityResult")
        article_id = submission.get("article_id") or submission.get("articleId")
        if not article_id or not quality_result:
            raise StageExecutionError(
                {
                    "code": "PIPELINE_STATE_INVALID",
                    "message": "Enrichment stage is missing article or quality state.",
                    "retryable": False,
                }
            )
        quality_evaluation = quality_result["qualityEvaluation"]
        quality_score = quality_evaluation.get("score")
        quality_decision = quality_evaluation["decision"]
        quality_review_approved = bool(
            submission.get("quality_review_approved") or submission.get("qualityReviewApproved")
        )
        if quality_decision != "PASS" and not (
            quality_decision in {"REVIEW_REQUIRED", "REJECT"} and quality_review_approved
        ):
            raise StageExecutionError(
                {
                    "code": "ARTICLE_NOT_ELIGIBLE",
                    "message": (
                        "AI enrichment requires a passing quality decision "
                        "or an approved quality review."
                    ),
                    "retryable": False,
                    "details": {
                        "decision": quality_decision,
                        "qualityReviewApproved": quality_review_approved,
                    },
                }
            )
        request = {
            "articleId": article_id,
            "article": {
                "title": payload["article"]["title"],
                "content": payload["article"]["content"],
                "language": payload["article"]["language"],
            },
            "qualityEvaluation": {
                # Preserve the original REVIEW_REQUIRED decision in persistence. The
                # summarizer receives PASS only after the review approval is verified.
                "decision": "PASS",
                "score": (
                    {"overall": quality_score["overall"]} if quality_score is not None else None
                ),
            },
            "generationOptions": payload["generationOptions"],
        }
        result = self.summarizer.process(request)
        generation = result["generation"]
        if generation["status"] == "FAILED":
            raise StageExecutionError(generation["error"])
        if job.purpose == JobPurpose.SUMMARY_REGENERATION:
            actual_versions = {
                "moduleVersion": generation.get("summarizerVersion"),
                "model": generation.get("model"),
                "promptVersion": generation.get("promptVersion"),
            }
            if job.target_versions and actual_versions != job.target_versions:
                raise StageExecutionError(
                    {
                        "code": "SUMMARY_VERSION_MISMATCH",
                        "message": "The worker does not match the requested summary versions.",
                        "retryable": True,
                    }
                )
            self.repository.mark_summary_regeneration_result(job.submission_id, result)
            return result
        policy, _ = self.repository.publication_policy()
        self.repository.mark_enrichment_result(job.submission_id, result, policy)
        return result
