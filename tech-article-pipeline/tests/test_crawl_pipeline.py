from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from tech_article_pipeline.api import create_app
from tech_article_pipeline.catalog import crawl_source_catalog
from tech_article_pipeline.contracts import CrawlRequested
from tech_article_pipeline.orchestration import CrawlOrchestrator, PipelineOrchestrator
from tech_article_pipeline.persistence.base import IdempotencyConflictError
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_pipeline.worker import DurableWorker
from tech_article_sources import CrawlBatch, SourceAdapterError, SourceAdapterRegistry
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
                    "rawArticle": {
                        "title": "must not leak",
                        "contentHtml": "<article>must-not-leak</article>",
                        "contentText": "must-not-leak",
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


def test_running_crawl_exposes_state_without_fabricated_progress(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    command = _crawl_command()
    response, _ = runtime.repository.submit_crawl(
        idempotency_key="running-crawl",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
    )

    claimed = runtime.repository.claim_crawl_job(lease_seconds=30)
    assert claimed is not None
    run = runtime.repository.get_crawl_run(response["crawlRunId"])

    assert run is not None
    assert run["status"] == "RUNNING"
    assert run["startedAt"] is not None
    assert run["statistics"] is None
    assert run["itemCount"] == 0
    assert "phase" not in run
    assert "progress" not in run


def test_mysql_running_crawl_projection_matches_the_state_only_contract():
    command = _crawl_command()
    run = MySQLPipelineRepository._external_crawl_run(
        {
            "crawl_run_id": "crawl-mysql-running",
            "source_id": "sdtimes",
            "trigger_type": "MANUAL",
            "status": "RUNNING",
            "request_payload": json.dumps(command),
            "statistics": None,
            "error": None,
            "created_at": None,
            "started_at": None,
            "completed_at": None,
            "updated_at": None,
            "job_id": "job-mysql-running",
            "job_status": "RUNNING",
            "attempt_count": 1,
            "max_attempts": 3,
            "available_at": None,
            "lease_expires_at": None,
            "job_error": None,
        },
        item_count=0,
    )

    assert run["status"] == "RUNNING"
    assert run["statistics"] is None
    assert run["itemCount"] == 0
    assert "requestPayload" not in run
    assert "result" not in run["job"]
    assert "phase" not in run
    assert "progress" not in run


def test_mysql_crawl_history_count_uses_the_job_backed_population():
    class FakeCursor:
        def __init__(self) -> None:
            self.executed = None

        def execute(self, query, params=None):
            self.executed = (query, params)

        def fetchone(self):
            return {"count": 7}

        def close(self):
            return None

    class FakeConnection:
        def __init__(self) -> None:
            self.cursor_instance = FakeCursor()

        def cursor(self, dictionary=False):
            del dictionary
            return self.cursor_instance

        def close(self):
            return None

    class FakePool:
        def __init__(self) -> None:
            self.connection = FakeConnection()

        def get_connection(self):
            return self.connection

    pool = FakePool()
    repository = MySQLPipelineRepository(pool)

    assert (
        repository.count_crawl_runs(
            status="COMPLETED",
            source_id="sdtimes",
            trigger="MANUAL",
        )
        == 7
    )
    query, params = pool.connection.cursor_instance.executed
    assert "FROM crawl_runs r JOIN crawl_jobs j ON j.job_id = r.job_id" in query
    assert "r.status = %s" in query
    assert "r.source_id = %s" in query
    assert "r.trigger_type = %s" in query
    assert params == ["COMPLETED", "sdtimes", "MANUAL"]


def test_mysql_expired_terminal_crawl_uses_non_retryable_error_and_completion_time():
    class FakeCursor:
        def __init__(self) -> None:
            self.executed: list[tuple[str, tuple | None]] = []
            self.rows: list[dict] = []
            self.one = None

        def execute(self, query, params=None):
            self.executed.append((query, params))
            if query.startswith("SELECT job_id"):
                self.rows = [
                    {
                        "job_id": "job-expired",
                        "crawl_run_id": "crawl-expired",
                        "attempt_count": 1,
                        "max_attempts": 1,
                    }
                ]
            elif query.startswith("SELECT * FROM crawl_jobs"):
                self.one = None

        def fetchall(self):
            return self.rows

        def fetchone(self):
            return self.one

        def close(self):
            return None

    class FakeConnection:
        def __init__(self) -> None:
            self.autocommit = True
            self.cursor_instance = FakeCursor()
            self.committed = False

        def cursor(self, dictionary=False):
            del dictionary
            return self.cursor_instance

        def commit(self):
            self.committed = True

        def rollback(self):
            return None

        def close(self):
            return None

    connection = FakeConnection()
    repository = MySQLPipelineRepository(SimpleNamespace(get_connection=lambda: connection))

    assert repository.claim_crawl_job(lease_seconds=30) is None

    job_update = next(
        entry
        for entry in connection.cursor_instance.executed
        if entry[0].startswith("UPDATE crawl_jobs SET status")
    )
    run_update = next(
        entry
        for entry in connection.cursor_instance.executed
        if entry[0].startswith("UPDATE crawl_runs SET status")
    )
    assert job_update[1][0] == "DEAD"
    assert json.loads(job_update[1][1])["retryable"] is False
    assert run_update[1][0] == "FAILED"
    assert "completed_at" in run_update[0]
    assert connection.committed is True


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
    assert run["error"] == {
        "code": "SOURCE_CRAWL_FAILED",
        "message": "The source crawler did not complete successfully.",
        "retryable": False,
    }
    assert run["statistics"] == {}
    assert run["items"][0]["crawlStatus"] == "FAILED"
    assert "must-not-leak" not in json.dumps(run, default=str)


def test_expired_terminal_crawl_lease_records_completion(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    command = _crawl_command()
    response, _ = runtime.repository.submit_crawl(
        idempotency_key="expired-terminal-crawl",
        body_digest=_digest(command),
        payload=command,
        max_attempts=1,
    )
    claimed = runtime.repository.claim_crawl_job(lease_seconds=30)
    assert claimed is not None
    runtime.repository.crawl_jobs[claimed.job_id]["lease_expires_at"] = datetime.now(
        UTC
    ) - timedelta(seconds=1)

    assert runtime.repository.claim_crawl_job(lease_seconds=30) is None
    run = runtime.repository.get_crawl_run(response["crawlRunId"])

    assert run is not None
    assert run["status"] == "FAILED"
    assert run["completedAt"] is not None
    assert run["error"]["retryable"] is False
    assert run["job"]["status"] == "DEAD"
    assert run["job"]["error"]["retryable"] is False


def test_crawl_api_auth_validation_and_replay(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    settings = Settings("x", 3306, "x", "x", "x", "token", backend="memory")
    app = create_app(settings=settings, runtime=runtime, start_worker=False)
    headers = {"Authorization": "Bearer token", "Idempotency-Key": "crawl-api"}
    with TestClient(app) as client:
        assert client.post("/internal/v1/crawl-runs", json=_crawl_command()).status_code == 401
        created = client.post("/internal/v1/crawl-runs", json=_crawl_command(), headers=headers)
        assert created.status_code == 202
        assert created.json()["operation"] == "CREATED"
        replay = client.post("/internal/v1/crawl-runs", json=_crawl_command(), headers=headers)
        assert replay.json()["operation"] == "REPLAYED"
        run = client.get(
            f"/internal/v1/crawl-runs/{created.json()['crawlRunId']}",
            headers={"Authorization": "Bearer token"},
        )
        assert run.status_code == 200
        assert run.json()["status"] == "QUEUED"
        assert run.json()["trigger"] == "MANUAL"
        assert "requestPayload" not in run.json()
        history = client.get(
            "/internal/v1/crawl-runs?status=QUEUED&trigger=MANUAL",
            headers={"Authorization": "Bearer token"},
        )
        assert history.status_code == 200
        assert history.json()["totalCount"] == 1
        history_item = history.json()["items"][0]
        assert history_item["crawlRunId"] == created.json()["crawlRunId"]
        assert history_item["statistics"] is None
        assert history_item["itemCount"] == 0
        assert "phase" not in history_item
        assert "progress" not in history_item

        scheduled = client.post(
            "/internal/v1/crawl-runs",
            json=_crawl_command(),
            headers={
                "Authorization": "Bearer token",
                "Idempotency-Key": "crawl-api-scheduled",
                "X-Crawl-Trigger": "SCHEDULED",
            },
        )
        assert scheduled.status_code == 202
        scheduled_history = client.get(
            "/internal/v1/crawl-runs?trigger=SCHEDULED",
            headers={"Authorization": "Bearer token"},
        )
        assert scheduled_history.json()["totalCount"] == 1
        assert scheduled_history.json()["items"][0]["trigger"] == "SCHEDULED"


def test_crawl_history_lists_manual_and_scheduled_runs(normalized_payload):
    runtime, _ = _runtime(normalized_payload)
    command = _crawl_command()
    runtime.repository.submit_crawl(
        idempotency_key="auto-crawl:manual-history",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
        trigger="MANUAL",
    )
    runtime.repository.submit_crawl(
        idempotency_key="scheduled-history-without-prefix",
        body_digest=_digest(command),
        payload=command,
        max_attempts=3,
        trigger="SCHEDULED",
    )

    assert runtime.repository.count_crawl_runs() == 2
    scheduled = runtime.repository.list_crawl_runs(
        limit=20, trigger="SCHEDULED", source_id="sdtimes"
    )
    assert len(scheduled) == 1
    assert scheduled[0]["trigger"] == "SCHEDULED"
    assert scheduled[0]["sourceType"] == "RSS"
    assert scheduled[0]["createdAt"] is not None


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


def test_crawl_contract_accepts_github_trending_top_three():
    command = CrawlRequested.model_validate(
        {
            "source": {
                "sourceId": "github-trending",
                "sourceType": "WEB_CRAWL",
                "sectionKey": "REPOSITORIES",
            },
            "crawlOptions": {
                "maximumArticleCount": 3,
                "followPagination": False,
                "maximumPageCount": 1,
            },
        }
    )

    assert command.source.source_id == "github-trending"
    assert command.crawl_options.maximum_article_count == 3


def test_crawl_contract_defaults_github_trending_to_top_three():
    command = CrawlRequested.model_validate(
        {
            "source": {
                "sourceId": "github-trending",
                "sourceType": "WEB_CRAWL",
                "sectionKey": "REPOSITORIES",
            }
        }
    )

    assert command.crawl_options.maximum_article_count == 3


@pytest.mark.parametrize(
    "crawl_options",
    [
        {"maximumArticleCount": 4},
        {"maximumArticleCount": 3, "followPagination": True},
        {"maximumArticleCount": 3, "maximumPageCount": 2},
    ],
)
def test_crawl_contract_rejects_unsupported_github_options(crawl_options):
    with pytest.raises(ValueError):
        CrawlRequested.model_validate(
            {
                "source": {
                    "sourceId": "github-trending",
                    "sourceType": "WEB_CRAWL",
                    "sectionKey": "REPOSITORIES",
                },
                "crawlOptions": crawl_options,
            }
        )


@pytest.mark.parametrize(
    "source",
    [
        {
            "sourceId": "github-trending",
            "sourceType": "RSS",
            "sectionKey": "REPOSITORIES",
        },
        {
            "sourceId": "github-trending",
            "sourceType": "WEB_CRAWL",
            "sectionKey": "NEWS",
        },
    ],
)
def test_crawl_contract_rejects_invalid_github_combinations(source):
    with pytest.raises(ValueError):
        CrawlRequested.model_validate(
            {"source": source, "crawlOptions": {"maximumArticleCount": 3}}
        )


def test_github_adapter_requires_crawler_identity_before_network():
    registry = SourceAdapterRegistry.default(public_url=None, contact=None)
    command = CrawlRequested.model_validate(
        {
            "source": {
                "sourceId": "github-trending",
                "sourceType": "WEB_CRAWL",
                "sectionKey": "REPOSITORIES",
            },
            "crawlOptions": {"maximumArticleCount": 1},
        }
    ).model_dump(by_alias=True, mode="json")
    command["requestedAt"] = "2026-08-22T00:00:00Z"

    with pytest.raises(SourceAdapterError) as exc_info:
        registry.run("crawl-github", command)

    assert exc_info.value.code == "CRAWLER_IDENTITY_NOT_CONFIGURED"


def test_github_catalog_exposes_only_applicable_top_three_options():
    source = next(item for item in crawl_source_catalog() if item["sourceId"] == "github-trending")

    assert source["capabilities"] == [{"sourceType": "WEB_CRAWL", "sectionKey": "REPOSITORIES"}]
    assert set(source["crawlOptions"]) == {
        "maximumArticleCount",
        "requestTimeoutMs",
    }
    assert source["crawlOptions"]["maximumArticleCount"] == {
        "default": 3,
        "minimum": 1,
        "maximum": 3,
    }
