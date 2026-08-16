from __future__ import annotations

import asyncio
import hashlib
import json
import os
from contextlib import asynccontextmanager, suppress
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from tech_article_pipeline.contracts.models import (
    CrawlRequested,
    NormalizedArticleCandidate,
    PublicationAction,
    PublicationPolicyPatch,
    QualityResolution,
)
from tech_article_pipeline.persistence.base import (
    IdempotencyConflictError,
    NotFoundError,
    VersionConflictError,
)
from tech_article_pipeline.runtime import Runtime, build_runtime
from tech_article_pipeline.settings import Settings

from .security import require_service_token


def _digest(payload: dict[str, Any]) -> bytes:
    canonical = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(canonical).digest()


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
        return JSONResponse(status_code=409, content={"code": "VERSION_CONFLICT", "message": str(exc)})

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
    ) -> JSONResponse:
        payload = command.model_dump(by_alias=True, mode="json")
        try:
            response, created = await asyncio.to_thread(
                request.app.state.runtime.repository.submit_crawl,
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

    @internal.get("/crawl-runs/{crawl_run_id}")
    async def get_crawl_run(request: Request, crawl_run_id: str) -> dict[str, Any]:
        run = await asyncio.to_thread(
            request.app.state.runtime.repository.get_crawl_run, crawl_run_id
        )
        if run is None:
            raise HTTPException(status_code=404, detail={"code": "CRAWL_RUN_NOT_FOUND"})
        return run

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
    ) -> dict[str, Any]:
        items = await asyncio.to_thread(
            request.app.state.runtime.repository.list_public_articles,
            limit=limit,
            offset=offset,
        )
        return {"items": items, "limit": limit, "offset": offset}

    @internal.get("/public/articles/{article_id}")
    async def public_article(request: Request, article_id: str) -> dict[str, Any]:
        article = await asyncio.to_thread(
            request.app.state.runtime.repository.get_public_article, article_id
        )
        if article is None:
            raise HTTPException(status_code=404, detail={"code": "ARTICLE_NOT_FOUND"})
        return article

    @internal.get("/admin/articles")
    async def admin_articles(
        request: Request,
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        items = await asyncio.to_thread(
            request.app.state.runtime.repository.list_articles,
            limit=limit,
            offset=offset,
        )
        return {"items": items, "limit": limit, "offset": offset}

    @internal.get("/admin/reviews/{kind}")
    async def review_queue(
        request: Request,
        kind: str,
        limit: int = Query(default=50, ge=1, le=100),
    ) -> dict[str, Any]:
        if kind not in {"duplicate", "quality", "publication"}:
            raise HTTPException(status_code=404, detail={"code": "REVIEW_QUEUE_NOT_FOUND"})
        items = await asyncio.to_thread(
            request.app.state.runtime.repository.list_review_queue, kind, limit=limit
        )
        return {"items": items}

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
