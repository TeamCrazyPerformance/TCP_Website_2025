from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager, suppress
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, Response

from tech_article_pipeline.catalog import (
    crawl_source_catalog,
    known_source_ids,
    public_source_catalog,
    tag_catalog,
)
from tech_article_pipeline.contracts.models import (
    ArticleProcessingAction,
    CrawlRequested,
    NormalizedArticleCandidate,
    PublicationAction,
    PublicationPolicyPatch,
    QualityResolution,
)
from tech_article_pipeline.persistence.base import (
    STAGE_NAMES,
    IdempotencyConflictError,
    InvalidArticleActionError,
    NotFoundError,
    VersionConflictError,
)
from tech_article_pipeline.runtime import Runtime, build_runtime
from tech_article_pipeline.settings import Settings

from .public_views import public_detail_article_read, public_list_article_read
from .security import require_service_token

_LOGGER = logging.getLogger(__name__)


def _digest(payload: dict[str, Any]) -> bytes:
    canonical = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(canonical).digest()


def _crawl_error_read(
    error: Any,
    *,
    retryable: bool | None = None,
) -> dict[str, Any] | None:
    if not isinstance(error, dict):
        return None
    result = {key: error[key] for key in ("code", "message", "retryable") if key in error}
    if retryable is not None:
        result["retryable"] = retryable
    return result or None


def _crawl_run_read(run: dict[str, Any]) -> dict[str, Any]:
    fields = (
        "crawlRunId",
        "sourceId",
        "sourceType",
        "sectionKey",
        "trigger",
        "status",
        "requestedAt",
        "createdAt",
        "startedAt",
        "completedAt",
        "updatedAt",
        "statistics",
        "itemCount",
    )
    result = {key: run.get(key) for key in fields}
    result["error"] = _crawl_error_read(
        run.get("error"), retryable=False if run.get("status") == "FAILED" else None
    )
    job = run.get("job")
    if isinstance(job, dict):
        result["job"] = {
            key: job.get(key)
            for key in (
                "jobId",
                "crawlRunId",
                "status",
                "attemptCount",
                "maxAttempts",
                "availableAt",
                "leaseExpiresAt",
            )
        }
        result["job"]["error"] = _crawl_error_read(
            job.get("error"), retryable=False if job.get("status") == "DEAD" else None
        )
    if isinstance(run.get("items"), list):
        result["items"] = [
            {
                key: item.get(key)
                for key in (
                    "crawlItemId",
                    "crawlStatus",
                    "submissionId",
                    "normalizationStatus",
                )
            }
            for item in run["items"]
            if isinstance(item, dict)
        ]
    return result


def create_app(
    *,
    settings: Settings | None = None,
    runtime: Runtime | None = None,
    start_worker: bool | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    runtime = runtime or build_runtime(settings)
    if start_worker is None:
        start_worker = os.getenv("PIPELINE_RUN_WORKER", "true").lower() == "true"

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        app.state.runtime = runtime
        worker_task = asyncio.create_task(runtime.worker.run()) if start_worker else None
        try:
            yield
        finally:
            runtime.worker.stop()
            if worker_task is not None:
                with suppress(asyncio.CancelledError):
                    await worker_task

    app = FastAPI(
        title="TCP Technical Article Pipeline",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.runtime = runtime

    @app.exception_handler(NotFoundError)
    async def not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
        del request
        return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": str(exc)})

    @app.exception_handler(VersionConflictError)
    async def version_handler(request: Request, exc: VersionConflictError) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=409, content={"code": "VERSION_CONFLICT", "message": str(exc)}
        )

    @app.exception_handler(InvalidArticleActionError)
    async def invalid_article_action_handler(
        request: Request, exc: InvalidArticleActionError
    ) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=422,
            content={"code": "INVALID_ARTICLE_ACTION", "message": str(exc)},
        )

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "UP"}

    @app.get("/health/ready")
    async def ready(request: Request) -> dict[str, str]:
        try:
            await asyncio.to_thread(request.app.state.runtime.repository.check_readiness)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "NOT_READY", "message": str(exc)},
            ) from exc
        return {"status": "READY"}

    internal = APIRouter(prefix="/internal/v1", dependencies=[Depends(require_service_token)])

    @internal.post("/normalized-articles", status_code=status.HTTP_202_ACCEPTED)
    async def submit_article(
        request: Request,
        candidate: NormalizedArticleCandidate,
        idempotency_key: str = Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=255,
            pattern=r"^[\x21-\x7E]+$",
        ),
    ) -> JSONResponse:
        payload = candidate.model_dump(by_alias=True, mode="json")
        try:
            response, created = await asyncio.to_thread(
                request.app.state.runtime.repository.submit,
                idempotency_key=idempotency_key,
                body_digest=_digest(payload),
                payload=payload,
                max_attempts=request.app.state.settings.job_max_attempts,
            )
        except IdempotencyConflictError as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "IDEMPOTENCY_KEY_REUSE",
                    "message": "Idempotency-Key was reused with a different request body.",
                },
            ) from exc
        response["operation"] = "CREATED" if created else "REPLAYED"
        return JSONResponse(status_code=202, content=response)

    @internal.post("/crawl-runs", status_code=status.HTTP_202_ACCEPTED)
    async def submit_crawl(
        request: Request,
        command: CrawlRequested,
        idempotency_key: str = Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=255,
            pattern=r"^[\x21-\x7E]+$",
        ),
        crawl_trigger: Literal["MANUAL", "SCHEDULED"] = Header(
            default="MANUAL", alias="X-Crawl-Trigger"
        ),
    ) -> JSONResponse:
        payload = command.model_dump(by_alias=True, mode="json")
        try:
            response, created = await asyncio.to_thread(
                request.app.state.runtime.repository.submit_crawl,
                idempotency_key=idempotency_key,
                body_digest=_digest(payload),
                payload=payload,
                max_attempts=request.app.state.settings.job_max_attempts,
                trigger=crawl_trigger,
            )
        except IdempotencyConflictError as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "IDEMPOTENCY_KEY_REUSE",
                    "message": "Idempotency-Key was reused with a different request body.",
                },
            ) from exc
        response["operation"] = "CREATED" if created else "REPLAYED"
        return JSONResponse(status_code=202, content=response)

    @internal.get("/crawl-runs")
    async def list_crawl_runs(
        request: Request,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        crawl_status: Literal[
            "QUEUED",
            "RUNNING",
            "RETRY",
            "COMPLETED",
            "PARTIALLY_COMPLETED",
            "FAILED",
        ]
        | None = Query(default=None, alias="status"),
        source_id: Literal["cloudflare-blog", "infoq", "sdtimes", "github-trending"] | None = Query(
            default=None, alias="sourceId"
        ),
        trigger: Literal["MANUAL", "SCHEDULED"] | None = Query(default=None),
    ) -> dict[str, Any]:
        filters = {
            "status": crawl_status,
            "source_id": source_id,
            "trigger": trigger,
        }
        items = await asyncio.to_thread(
            request.app.state.runtime.repository.list_crawl_runs,
            limit=limit,
            offset=offset,
            **filters,
        )
        total_count = await asyncio.to_thread(
            request.app.state.runtime.repository.count_crawl_runs,
            **filters,
        )
        return {"items": [_crawl_run_read(item) for item in items], "totalCount": total_count}

    @internal.get("/crawl-runs/{crawl_run_id}")
    async def get_crawl_run(request: Request, crawl_run_id: str) -> dict[str, Any]:
        run = await asyncio.to_thread(
            request.app.state.runtime.repository.get_crawl_run, crawl_run_id
        )
        if run is None:
            raise HTTPException(status_code=404, detail={"code": "CRAWL_RUN_NOT_FOUND"})
        return _crawl_run_read(run)

    @internal.get("/jobs/{job_id}")
    async def get_job(request: Request, job_id: str) -> dict[str, Any]:
        job = await asyncio.to_thread(request.app.state.runtime.repository.get_job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail={"code": "JOB_NOT_FOUND"})
        return job

    @internal.get("/public/articles")
    async def public_articles(
        request: Request,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        keyword: str | None = Query(default=None, min_length=1, max_length=100),
        tags: Annotated[list[str] | None, Query()] = None,
        sources: Annotated[list[str] | None, Query()] = None,
    ) -> dict[str, Any]:
        tag_values = tuple(dict.fromkeys(tags or []))
        if set(tag_values) - set(tag_catalog()):
            raise HTTPException(status_code=422, detail={"code": "INVALID_ARTICLE_TAG"})
        source_values = tuple(dict.fromkeys(sources or []))
        if set(source_values) - known_source_ids():
            raise HTTPException(status_code=422, detail={"code": "INVALID_ARTICLE_SOURCE"})
        items, total_count, last_crawled_at = await asyncio.gather(
            asyncio.to_thread(
                request.app.state.runtime.repository.list_public_articles,
                limit=limit,
                offset=offset,
                keyword=keyword,
                tags=tag_values,
                sources=source_values,
            ),
            asyncio.to_thread(
                request.app.state.runtime.repository.count_public_articles,
                keyword=keyword,
                tags=tag_values,
                sources=source_values,
            ),
            asyncio.to_thread(request.app.state.runtime.repository.last_crawled_at),
        )
        return {
            "items": [public_list_article_read(item) for item in items],
            "limit": limit,
            "offset": offset,
            "totalCount": total_count,
            "lastCrawledAt": last_crawled_at,
        }

    @internal.get("/public/tags")
    async def public_tags() -> dict[str, Any]:
        return {"items": tag_catalog()}

    @internal.post("/public/articles/{article_id}/view", status_code=status.HTTP_204_NO_CONTENT)
    async def record_article_view(
        request: Request,
        article_id: str,
        member: bool = Query(default=False),
    ) -> Response:
        """조회수를 올립니다. 운영 판단용 집계이며 사용자별 이력은 남기지 않습니다.

        호출자(Nest 미들웨어)는 응답을 기다리지 않습니다. 여기서 실패해도
        아티클 조회 자체는 정상적으로 끝나야 하므로 오류를 삼킵니다.
        """
        try:
            await asyncio.to_thread(
                request.app.state.runtime.repository.record_article_view,
                article_id,
                member=member,
            )
        except Exception:  # noqa: BLE001 - 부가 기능이 본 기능을 막지 않습니다.
            _LOGGER.warning("failed to record article view", exc_info=True)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @internal.get("/public/sources")
    async def public_sources(request: Request) -> dict[str, Any]:
        """소스 선택기용. 태그와 달리 소스는 계속 늘어나므로 목록 응답에
        얹지 않고 별도로 둡니다 (/public/tags 와 같은 방식)."""
        counts = await asyncio.to_thread(request.app.state.runtime.repository.public_source_counts)
        return {
            "items": [
                {**source, "count": counts.get(source["id"], 0)}
                for source in public_source_catalog()
            ]
        }

    @internal.get("/public/articles/{article_id}")
    async def public_article(request: Request, article_id: str) -> dict[str, Any]:
        article = await asyncio.to_thread(
            request.app.state.runtime.repository.get_public_article, article_id
        )
        if article is None:
            raise HTTPException(status_code=404, detail={"code": "ARTICLE_NOT_FOUND"})
        return public_detail_article_read(article)

    @internal.get("/admin/articles")
    async def admin_articles(
        request: Request,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        keyword: str | None = Query(default=None, min_length=1, max_length=100),
        publication_status: str | None = Query(
            default=None,
            alias="publicationStatus",
            pattern=r"^(UNPUBLISHED|SCHEDULED|PUBLISHED|HIDDEN|ARCHIVED)$",
        ),
        stage: str | None = Query(default=None, pattern=r"^(" + "|".join(STAGE_NAMES) + r")$"),
        status_mismatch: bool = Query(default=False, alias="statusMismatch"),
        sort: str = Query(default="NEWEST", pattern=r"^(NEWEST|OLDEST|SCORE_DESC|SCORE_ASC)$"),
    ) -> dict[str, Any]:
        items, total_count = await asyncio.gather(
            asyncio.to_thread(
                request.app.state.runtime.repository.list_articles,
                limit=limit,
                offset=offset,
                keyword=keyword,
                publication_status=publication_status,
                stage=stage,
                status_mismatch=status_mismatch,
                sort=sort,
            ),
            asyncio.to_thread(
                request.app.state.runtime.repository.count_articles,
                keyword=keyword,
                publication_status=publication_status,
                stage=stage,
                status_mismatch=status_mismatch,
            ),
        )
        return {"items": items, "limit": limit, "offset": offset, "totalCount": total_count}

    @internal.get("/admin/articles/stats")
    async def admin_article_stats(
        request: Request,
        keyword: str | None = Query(default=None, min_length=1, max_length=100),
        publication_status: str | None = Query(
            default=None,
            alias="publicationStatus",
            pattern=r"^(UNPUBLISHED|SCHEDULED|PUBLISHED|HIDDEN|ARCHIVED)$",
        ),
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            request.app.state.runtime.repository.article_stats,
            keyword=keyword,
            publication_status=publication_status,
        )

    @internal.get("/admin/articles/{article_id}")
    async def admin_article(request: Request, article_id: str) -> dict[str, Any]:
        article = await asyncio.to_thread(
            request.app.state.runtime.repository.get_article, article_id
        )
        if article is None:
            raise HTTPException(status_code=404, detail={"code": "ARTICLE_NOT_FOUND"})
        return article

    @internal.get("/admin/reviews/{kind}")
    async def review_queue(
        request: Request,
        kind: str,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
        keyword: str | None = Query(default=None, min_length=1, max_length=100),
        filter_value: str | None = Query(default=None, alias="filter"),
        sort: str = Query(default="NEWEST"),
    ) -> dict[str, Any]:
        if kind not in {"duplicate", "quality", "rejected", "publication"}:
            raise HTTPException(status_code=404, detail={"code": "REVIEW_QUEUE_NOT_FOUND"})
        allowed_sorts = {"duplicate": {"NEWEST", "SIMILARITY_DESC"}}.get(kind, {"NEWEST"})
        if sort not in allowed_sorts:
            raise HTTPException(status_code=422, detail={"code": "INVALID_REVIEW_SORT"})
        allowed_filters = {
            "duplicate": {None, "JACCARD"},
            "quality": {None, "RSS", "WEB_CRAWL", "API"},
            "rejected": {None, "RSS", "WEB_CRAWL", "API"},
            "publication": {None, "RSS", "WEB_CRAWL", "API"},
        }[kind]
        if filter_value not in allowed_filters:
            raise HTTPException(status_code=422, detail={"code": "INVALID_REVIEW_FILTER"})
        items, total_count = await asyncio.gather(
            asyncio.to_thread(
                request.app.state.runtime.repository.list_review_queue,
                kind,
                limit=limit,
                offset=offset,
                keyword=keyword,
                filter_value=filter_value,
                sort=sort,
            ),
            asyncio.to_thread(
                request.app.state.runtime.repository.count_review_queue,
                kind,
                keyword=keyword,
                filter_value=filter_value,
            ),
        )
        return {"items": items, "limit": limit, "offset": offset, "totalCount": total_count}

    @internal.get("/admin/crawl-sources")
    async def admin_crawl_sources() -> dict[str, Any]:
        return {"items": crawl_source_catalog()}

    @internal.post("/admin/reviews/duplicate/{review_case_id}/resolution")
    async def resolve_duplicate(
        request: Request, review_case_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        if payload.get("reviewCaseId") != review_case_id:
            raise HTTPException(
                status_code=422,
                detail={"code": "REVIEW_CASE_MISMATCH", "message": "Path and body IDs differ."},
            )
        result = await asyncio.to_thread(
            request.app.state.runtime.admission.resolve_review, payload
        )
        if result.get("outcome") == "RESOLUTION_FAILED":
            error = result.get("error", {})
            raise HTTPException(status_code=409, detail=error)
        await asyncio.to_thread(
            request.app.state.runtime.repository.continue_after_duplicate_resolution,
            review_case_id,
            result,
            max_attempts=request.app.state.settings.job_max_attempts,
        )
        return result

    @internal.post("/admin/reviews/quality/{case_id}/resolution")
    async def resolve_quality(
        request: Request, case_id: str, resolution: QualityResolution
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            request.app.state.runtime.repository.resolve_quality_review,
            case_id,
            action=resolution.action,
            expected_version=resolution.expected_case_version,
            administrator_id=resolution.administrator_id,
            max_attempts=request.app.state.settings.job_max_attempts,
        )

    @internal.post("/admin/articles/{article_id}/publication")
    async def change_publication(
        request: Request, article_id: str, command: PublicationAction
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            request.app.state.runtime.repository.apply_publication_action,
            article_id,
            action=command.action,
            expected_version=command.expected_record_version,
            administrator_id=command.administrator_id,
            reason=command.reason,
        )

    @internal.post("/admin/articles/{article_id}/reprocessing")
    async def reprocess_article(
        request: Request, article_id: str, command: ArticleProcessingAction
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            request.app.state.runtime.repository.reprocess_article,
            article_id,
            action=command.action,
            expected_version=command.expected_record_version,
            administrator_id=command.administrator_id,
            max_attempts=request.app.state.settings.job_max_attempts,
        )

    @internal.get("/admin/settings/publication-policy")
    async def get_publication_policy(request: Request) -> dict[str, Any]:
        policy, version = await asyncio.to_thread(
            request.app.state.runtime.repository.publication_policy
        )
        return {"policy": policy, "recordVersion": version}

    @internal.patch("/admin/settings/publication-policy")
    async def patch_publication_policy(
        request: Request, patch: PublicationPolicyPatch
    ) -> dict[str, Any]:
        policy, version = await asyncio.to_thread(
            request.app.state.runtime.repository.set_publication_policy,
            patch.policy,
            patch.expected_version,
        )
        return {"policy": policy, "recordVersion": version}

    app.include_router(internal)
    return app
