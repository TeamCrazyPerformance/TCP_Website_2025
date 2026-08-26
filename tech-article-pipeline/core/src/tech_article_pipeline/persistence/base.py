from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

from tech_article_pipeline.contracts import CrawlJobRecord, JobRecord, PublicationPolicy, Stage

# 수집 후 이 시간 안에 있는 아티클에 공개 화면이 NEW 배지를 붙입니다.
# 정책 값이라 서버가 판정합니다 — 프런트에 박아 두면 바꿀 때마다 재배포해야 합니다.
NEW_ARTICLE_WINDOW_HOURS = 24


# 관리자 화면의 파이프라인 단계. 표시 순서대로 둡니다.
# 판정 규칙은 mysql.STAGE_PREDICATES(SQL) 와 memory._article_stage(파이썬)에
# 각각 있고, 이름 목록만 여기서 공유합니다.
STAGE_NAMES: tuple[str, ...] = (
    "INGESTED",
    "QUALITY_REVIEW",
    "ENRICHING",
    "PUBLICATION_REVIEW",
    "COMPLETED",
    "FAILED_AFTER_APPROVAL",
    "FAILED",
    "QUALITY_REJECTED",
)


# 검토 승인(APPROVED)과 공존할 수 있는 처리 단계. 정상 승인은 처리 단계를
# ENRICHMENT_PENDING 으로 함께 올리므로, 이 셋 밖에서 APPROVED 가 보이면
# 공개 액션이 덮어쓴 값입니다.
APPROVED_COMPATIBLE_PROCESSING: tuple[str, ...] = (
    "ENRICHMENT_PENDING",
    "ENRICHED",
    "PROCESSING_FAILED",
)


class IdempotencyConflictError(RuntimeError):
    pass


class VersionConflictError(RuntimeError):
    pass


class NotFoundError(RuntimeError):
    pass


def crawl_error_summary(
    error: dict[str, Any] | None,
    *,
    retryable: bool | None = None,
) -> dict[str, Any] | None:
    """Return the small, raw-content-free error contract exposed by crawl reads."""
    if not isinstance(error, dict):
        return None
    summary: dict[str, Any] = {}
    if isinstance(error.get("code"), str):
        summary["code"] = error["code"]
    if isinstance(error.get("message"), str):
        summary["message"] = error["message"]
    if retryable is not None:
        summary["retryable"] = retryable
    elif isinstance(error.get("retryable"), bool):
        summary["retryable"] = error["retryable"]
    return summary or None


class PipelineRepository(Protocol):
    def check_readiness(self) -> None: ...

    def submit(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
    ) -> tuple[dict[str, Any], bool]: ...

    def submit_crawl(
        self,
        *,
        idempotency_key: str,
        body_digest: bytes,
        payload: dict[str, Any],
        max_attempts: int,
        trigger: str = "MANUAL",
    ) -> tuple[dict[str, Any], bool]: ...

    def get_crawl_run(self, crawl_run_id: str) -> dict[str, Any] | None: ...

    def list_crawl_runs(
        self,
        *,
        limit: int,
        offset: int = 0,
        status: str | None = None,
        source_id: str | None = None,
        trigger: str | None = None,
    ) -> list[dict[str, Any]]: ...

    def count_crawl_runs(
        self,
        *,
        status: str | None = None,
        source_id: str | None = None,
        trigger: str | None = None,
    ) -> int: ...

    def claim_crawl_job(self, *, lease_seconds: int) -> CrawlJobRecord | None: ...

    def complete_crawl_job(
        self, job: CrawlJobRecord, result: dict[str, Any], *, max_attempts: int
    ) -> None: ...

    def fail_crawl_job(
        self,
        job: CrawlJobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None: ...

    def get_job(self, job_id: str) -> dict[str, Any] | None: ...

    def claim_job(self, *, lease_seconds: int) -> JobRecord | None: ...

    def get_submission(self, submission_id: str) -> dict[str, Any]: ...

    def mark_admission_result(self, submission_id: str, result: dict[str, Any]) -> None: ...

    def mark_quality_result(self, submission_id: str, result: dict[str, Any]) -> None: ...

    def mark_enrichment_result(
        self,
        submission_id: str,
        result: dict[str, Any],
        publication_policy: PublicationPolicy,
    ) -> None: ...

    def enqueue(
        self,
        submission_id: str,
        stage: Stage,
        *,
        max_attempts: int,
        unique_key: str,
    ) -> str: ...

    def complete_job(self, job: JobRecord, result: dict[str, Any]) -> None: ...

    def fail_job(
        self,
        job: JobRecord,
        error: dict[str, Any],
        *,
        retryable: bool,
        available_at: datetime,
    ) -> None: ...

    def publication_policy(self) -> tuple[PublicationPolicy, int]: ...

    def set_publication_policy(
        self, policy: PublicationPolicy, expected_version: int | None
    ) -> tuple[PublicationPolicy, int]: ...

    def list_public_articles(
        self,
        *,
        limit: int,
        offset: int,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
        sources: tuple[str, ...] = (),
    ) -> list[dict[str, Any]]: ...

    def count_public_articles(
        self,
        *,
        keyword: str | None = None,
        tags: tuple[str, ...] = (),
        sources: tuple[str, ...] = (),
    ) -> int: ...

    def public_source_counts(self) -> dict[str, int]: ...

    def last_crawled_at(self) -> datetime | None: ...

    def get_public_article(self, article_id: str) -> dict[str, Any] | None: ...

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
    ) -> list[dict[str, Any]]: ...

    def count_articles(
        self,
        *,
        keyword: str | None = None,
        publication_status: str | None = None,
        stage: str | None = None,
        status_mismatch: bool = False,
    ) -> int: ...

    def get_article(self, article_id: str) -> dict[str, Any] | None: ...

    def record_article_view(self, article_id: str, *, member: bool) -> None: ...

    def article_stats(
        self, *, keyword: str | None = None, publication_status: str | None = None
    ) -> dict[str, Any]: ...

    def list_review_queue(
        self,
        kind: str,
        *,
        limit: int,
        offset: int = 0,
        keyword: str | None = None,
        filter_value: str | None = None,
        sort: str = "NEWEST",
    ) -> list[dict[str, Any]]: ...

    def count_review_queue(
        self,
        kind: str,
        *,
        keyword: str | None = None,
        filter_value: str | None = None,
    ) -> int: ...

    def resolve_quality_review(
        self,
        case_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        max_attempts: int,
    ) -> dict[str, Any]: ...

    def apply_publication_action(
        self,
        article_id: str,
        *,
        action: str,
        expected_version: int,
        administrator_id: str,
        reason: str,
    ) -> dict[str, Any]: ...

    def continue_after_duplicate_resolution(
        self, review_case_id: str, result: dict[str, Any], *, max_attempts: int
    ) -> None: ...
