from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from tech_article_sources import SourceAdapterError, SourceAdapterRegistry

from tech_article_pipeline.contracts import CrawlJobRecord, NormalizedArticleCandidate
from tech_article_pipeline.persistence.base import PipelineRepository


class CrawlExecutionError(RuntimeError):
    def __init__(self, error: dict[str, Any]) -> None:
        super().__init__(str(error.get("message", "crawl execution failed")))
        self.error = error
        self.retryable = bool(error.get("retryable", False))


class CrawlOrchestrator:
    def __init__(self, repository: PipelineRepository, registry: SourceAdapterRegistry) -> None:
        self.repository = repository
        self.registry = registry

    def execute(self, job: CrawlJobRecord) -> dict[str, Any]:
        run = self.repository.get_crawl_run(job.crawl_run_id)
        if run is None:
            raise CrawlExecutionError(
                {
                    "code": "CRAWL_RUN_NOT_FOUND",
                    "message": f"Crawl run {job.crawl_run_id!r} does not exist.",
                    "retryable": False,
                }
            )
        request = run["requestPayload"]
        try:
            batch = self.registry.run(job.crawl_run_id, request)
        except SourceAdapterError as exc:
            raise CrawlExecutionError(exc.to_dict()) from exc

        normalized: list[dict[str, Any]] = []
        failures: list[dict[str, Any]] = []
        for native in batch.normalized_articles:
            item_id = native.get("crawlItemId", "unknown")
            try:
                candidate = self._candidate(native, request)
                normalized.append(candidate.model_dump(by_alias=True, mode="json"))
            except (KeyError, TypeError, ValidationError, ValueError) as exc:
                failures.append(
                    {
                        "crawlItemId": item_id,
                        "code": "NORMALIZED_ARTICLE_CONTRACT_INVALID",
                        "message": str(exc),
                        "retryable": False,
                    }
                )

        completion = dict(batch.completion)
        status = completion.get("status")
        if status == "FAILED":
            retryable = self._has_retryable_failure(batch.crawl_items, completion)
            raise CrawlExecutionError(
                {
                    "code": "SOURCE_CRAWL_FAILED",
                    "message": "The source crawler did not complete successfully.",
                    "retryable": retryable,
                    "details": {
                        "completion": completion,
                        "crawlItems": batch.crawl_items,
                    },
                }
            )
        return {
            "completion": completion,
            "crawlItems": batch.crawl_items,
            "normalizedArticles": normalized,
            "normalizationFailures": failures,
        }

    @staticmethod
    def _candidate(
        native: dict[str, Any], request: dict[str, Any]
    ) -> NormalizedArticleCandidate:
        normalization = native["normalization"]
        if normalization.get("status") != "SUCCESS" or not native.get("article"):
            raise ValueError("source normalizer did not produce a successful article")
        urls = native["urls"]
        if not urls.get("canonicalUrl"):
            raise ValueError("source normalizer did not produce a canonical URL")
        payload = {
            "schemaVersion": "1.0",
            "crawlRunId": native["crawlRunId"],
            "crawlItemId": native["crawlItemId"],
            "source": {
                "sourceId": native["source"]["sourceId"],
                "sourceType": native["source"]["sourceType"],
            },
            "discovery": native.get("discovery", {}),
            "urls": {
                "discoveredUrl": urls.get("discoveredUrl"),
                "finalUrl": urls.get("finalUrl"),
                "canonicalUrl": urls["canonicalUrl"],
            },
            "article": native["article"],
            "normalization": normalization,
            "duplicatePolicy": request["duplicatePolicy"],
            "qualityPolicy": request["qualityPolicy"],
            "generationOptions": request["generationOptions"],
        }
        return NormalizedArticleCandidate.model_validate(payload)

    @staticmethod
    def _has_retryable_failure(
        items: list[dict[str, Any]], completion: dict[str, Any]
    ) -> bool:
        run_error = completion.get("error")
        if isinstance(run_error, dict):
            return bool(run_error.get("retryable"))
        errors = [item.get("crawl", {}).get("error") for item in items]
        errors = [error for error in errors if isinstance(error, dict)]
        return any(bool(error.get("retryable")) for error in errors) or not errors
