from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from tech_article_pipeline.api import create_app
from tech_article_pipeline.contracts import CrawlRequested
from tech_article_pipeline.orchestration import CrawlOrchestrator, PipelineOrchestrator
from tech_article_pipeline.persistence.base import IdempotencyConflictError
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_pipeline.worker import DurableWorker
from tech_article_sources import CrawlBatch
from test_orchestration import FakeAdmission, FakeQuality, FakeSummarizer


def _digest(payload: dict) -> bytes:
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    return hashlib.sha256(encoded).digest()


def _crawl_command() -> dict:
    return CrawlRequested.model_validate(
        {
            "source": {
                "sourceId": "sdtimes",
                "sourceType": "RSS",
                "sectionKey": "NEWS",
            },
            "crawlOptions": {"maximumArticleCount": 2},
        }
    ).model_dump(by_alias=True, mode="json")


class FakeRegistry:
    def __init__(self, native: dict) -> None:
        self.native = native
        self.calls = 0

    def run(self, crawl_run_id: str, request: dict) -> CrawlBatch:
        self.calls += 1
        native = deepcopy(self.native)
        native["crawlRunId"] = crawl_run_id
        native["crawlItemId"] = f"{crawl_run_id}-001"
        item = {
            "schemaVersion": "1.0",
            "crawlRunId": crawl_run_id,
            "crawlItemId": native["crawlItemId"],
            "source": native["source"],
            "discovery": native["discovery"],
            "urls": native["urls"],
            "crawl": {
                "status": "SUCCESS",
                "crawledAt": native["normalization"]["normalizedAt"],
                "crawlerVersion": "fake-1.0.0",
                "httpStatusCode": 200,
                "attempt": 1,
                "error": None,
            },
            "rawArticle": {"title": native["article"]["title"]},
        }
        return CrawlBatch(
            completion={
                "crawlRunId": crawl_run_id,
                "status": "COMPLETED",
                "statistics": {
                    "pagesVisited": 1,
                    "articlesDiscovered": 1,
                    "articlesAttempted": 1,
                    "articlesSucceeded": 1,
                    "articlesFailed": 0,
                },
            },
            crawl_items=[item],
            normalized_articles=[native],
        )


class FailedRegistry:
    def run(self, crawl_run_id: str, request: dict) -> CrawlBatch:
        del request
        return CrawlBatch(
            completion={"crawlRunId": crawl_run_id, "status": "FAILED", "statistics": {}},
            crawl_items=[
                {
                    "crawlRunId": crawl_run_id,
                    "crawlItemId": f"{crawl_run_id}-failed",
                    "crawl": {
                        "status": "FAILED",
                        "error": {
                            "code": "ROBOTS_DISALLOWED",
                            "message": "disallowed",
                            "retryable": False,
                        },
                    },
                }
            ],
        )


def _runtime(normalized_payload):
    repository = MemoryPipelineRepository()
    admission = FakeAdmission()
    pipeline = PipelineOrchestrator(
        repository, admission, FakeQuality(), FakeSummarizer(), job_max_attempts=3
    )
    registry = FakeRegistry(normalized_payload)
    crawl = CrawlOrchestrator(repository, registry)
    worker = DurableWorker(
        repository,
        pipeline,
        crawl_orchestrator=crawl,
        job_max_attempts=3,
    )
    return SimpleNamespace(
        repository=repository,
        admission=admission,
        orchestrator=pipeline,
        crawl_orchestrator=crawl,
        worker=worker,
    ), registry


def test_crawl_job_submits_normalized_articles_idempotently(normalized_payload):
    runtime, registry = _runtime(normalized_payload)
    command = _crawl_command()
    response, created = runtime.repository.submit_crawl(
        idempotency_key="crawl-key",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
    )
    replay, replay_created = runtime.repository.submit_crawl(
        idempotency_key="crawl-key",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
    )
    assert created is True
    assert replay_created is False
    assert replay["crawlRunId"] == response["crawlRunId"]

    assert runtime.worker.process_once() is True
    run = runtime.repository.get_crawl_run(response["crawlRunId"])
    assert run is not None
    assert run["status"] == "COMPLETED"
    assert run["items"][0]["normalizationStatus"] == "SUCCESS"
    assert run["items"][0]["submissionId"].startswith("submission-")
    assert registry.calls == 1

    for _ in range(3):
        assert runtime.worker.process_once() is True
    assert len(runtime.repository.list_public_articles(limit=10, offset=0)) == 1


def test_crawl_idempotency_conflict(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    command = _crawl_command()
    runtime.repository.submit_crawl(
        idempotency_key="same",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
    )
    changed = deepcopy(command)
    changed["crawlOptions"]["maximumArticleCount"] = 3
    with pytest.raises(IdempotencyConflictError):
        runtime.repository.submit_crawl(
            idempotency_key="same",
            body_digest=_digest(changed),
            payload=changed,
            max_attempts=3,
        )


def test_failed_crawl_keeps_failed_items_and_becomes_dead(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    runtime.crawl_orchestrator.registry = FailedRegistry()
    runtime.worker.job_max_attempts = 1
    command = _crawl_command()
    response, _ = runtime.repository.submit_crawl(
        idempotency_key="failed-crawl",
        body_digest=_digest(command),
        payload=command,
        max_attempts=1,
    )
    assert runtime.worker.process_once() is True
    run = runtime.repository.get_crawl_run(response["crawlRunId"])
    assert run is not None
    assert run["status"] == "FAILED"
    assert run["job"]["status"] == "DEAD"
    assert run["items"][0]["crawlStatus"] == "FAILED"


def test_crawl_api_auth_validation_and_replay(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    settings = Settings("x", 3306, "x", "x", "x", "token", backend="memory")
    app = create_app(settings=settings, runtime=runtime, start_worker=False)
    headers = {"Authorization": "Bearer token", "Idempotency-Key": "crawl-api"}
    with TestClient(app) as client:
        assert client.post("/internal/v1/crawl-runs", json=_crawl_command()).status_code == 401
        created = client.post(
            "/internal/v1/crawl-runs", json=_crawl_command(), headers=headers
        )
        assert created.status_code == 202
        assert created.json()["operation"] == "CREATED"
        replay = client.post(
            "/internal/v1/crawl-runs", json=_crawl_command(), headers=headers
        )
        assert replay.json()["operation"] == "REPLAYED"
        run = client.get(
            f"/internal/v1/crawl-runs/{created.json()['crawlRunId']}",
            headers={"Authorization": "Bearer token"},
        )
        assert run.status_code == 200
        assert run.json()["status"] == "QUEUED"


@pytest.mark.parametrize(
    "source",
    [
        {"sourceId": "cloudflare-blog", "sourceType": "WEB_CRAWL", "sectionKey": "BLOG"},
        {"sourceId": "infoq", "sourceType": "API", "sectionKey": "NEWS"},
        {"sourceId": "sdtimes", "sourceType": "RSS", "sectionKey": "ENGINEERING"},
    ],
)
def test_crawl_contract_rejects_unsupported_source_combinations(source):
    with pytest.raises(ValueError):
        CrawlRequested.model_validate({"source": source})
