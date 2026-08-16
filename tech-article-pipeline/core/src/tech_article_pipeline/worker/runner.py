from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from typing import Any

from tech_article_pipeline.orchestration import (
    CrawlExecutionError,
    CrawlOrchestrator,
    PipelineOrchestrator,
    StageExecutionError,
)
from tech_article_pipeline.persistence.base import PipelineRepository

logger = logging.getLogger(__name__)


class DurableWorker:
    def __init__(
        self,
        repository: PipelineRepository,
        orchestrator: PipelineOrchestrator,
        *,
        crawl_orchestrator: CrawlOrchestrator | None = None,
        job_max_attempts: int = 3,
        concurrency: int = 1,
        poll_seconds: float = 1.0,
        lease_seconds: int = 60,
    ) -> None:
        self.repository = repository
        self.orchestrator = orchestrator
        self.crawl_orchestrator = crawl_orchestrator
        self.job_max_attempts = job_max_attempts
        self.concurrency = max(1, concurrency)
        self.poll_seconds = max(0.05, poll_seconds)
        self.lease_seconds = max(5, lease_seconds)
        self._stop = asyncio.Event()

    async def run(self) -> None:
        self._stop.clear()
        async with asyncio.TaskGroup() as group:
            for index in range(self.concurrency):
                group.create_task(self._consumer(index))

    def stop(self) -> None:
        self._stop.set()

    async def _consumer(self, worker_index: int) -> None:
        del worker_index
        while not self._stop.is_set():
            try:
                processed = await asyncio.to_thread(self.process_once)
            except Exception:
                logger.exception("Pipeline worker loop failed; polling will resume.")
                processed = False
            if not processed:
                with suppress(TimeoutError):
                    await asyncio.wait_for(self._stop.wait(), timeout=self.poll_seconds)

    def process_once(self) -> bool:
        job = self.repository.claim_job(lease_seconds=self.lease_seconds)
        if job is None:
            return self._process_crawl_once()
        try:
            result = self.orchestrator.execute(job)
            self.repository.complete_job(job, result)
        except StageExecutionError as exc:
            self.repository.fail_job(
                job,
                exc.error,
                retryable=exc.retryable,
                available_at=self._retry_at(job.attempt_count),
            )
        except Exception as exc:
            error: dict[str, Any] = {
                "code": "INTERNAL_ERROR",
                "message": "Pipeline worker failed unexpectedly.",
                "retryable": True,
                "details": {"exceptionType": type(exc).__name__},
            }
            self.repository.fail_job(
                job,
                error,
                retryable=True,
                available_at=self._retry_at(job.attempt_count),
            )
        return True

    def _process_crawl_once(self) -> bool:
        if self.crawl_orchestrator is None:
            return False
        job = self.repository.claim_crawl_job(lease_seconds=self.lease_seconds)
        if job is None:
            return False
        try:
            result = self.crawl_orchestrator.execute(job)
            self.repository.complete_crawl_job(
                job, result, max_attempts=self.job_max_attempts
            )
        except CrawlExecutionError as exc:
            self.repository.fail_crawl_job(
                job,
                exc.error,
                retryable=exc.retryable,
                available_at=self._retry_at(job.attempt_count),
            )
        except Exception as exc:
            self.repository.fail_crawl_job(
                job,
                {
                    "code": "CRAWLER_INTERNAL_ERROR",
                    "message": "Crawler worker failed unexpectedly.",
                    "retryable": True,
                    "details": {"exceptionType": type(exc).__name__},
                },
                retryable=True,
                available_at=self._retry_at(job.attempt_count),
            )
        return True

    @staticmethod
    def _retry_at(attempt_count: int) -> datetime:
        delay = min(300, 2 ** max(0, attempt_count - 1))
        return datetime.now(UTC) + timedelta(seconds=delay)
