from __future__ import annotations

from types import SimpleNamespace

from fastapi.testclient import TestClient
from tech_article_pipeline.api import create_app
from tech_article_pipeline.orchestration import PipelineOrchestrator
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_pipeline.worker import DurableWorker
from test_orchestration import FakeAdmission, FakeQuality, FakeSummarizer


def test_api_auth_submission_replay_and_public_filter(normalized_payload):
    repository = MemoryPipelineRepository()
    admission = FakeAdmission()
    orchestrator = PipelineOrchestrator(
        repository, admission, FakeQuality(), FakeSummarizer(), job_max_attempts=3
    )
    worker = DurableWorker(repository, orchestrator)
    runtime = SimpleNamespace(
        repository=repository,
        admission=admission,
        orchestrator=orchestrator,
        worker=worker,
    )
    settings = Settings(
        mysql_host="memory",
        mysql_port=3306,
        mysql_user="memory",
        mysql_password="memory",
        mysql_database="memory",
        service_token="test-service-token",
        backend="memory",
    )
    app = create_app(settings=settings, runtime=runtime, start_worker=False)

    with TestClient(app) as client:
        assert client.get("/health/live").status_code == 200
        assert client.get("/internal/v1/public/articles").status_code == 401
        headers = {
            "Authorization": "Bearer test-service-token",
            "Idempotency-Key": "api-key-1",
        }
        created = client.post(
            "/internal/v1/normalized-articles", json=normalized_payload, headers=headers
        )
        assert created.status_code == 202
        assert created.json()["operation"] == "CREATED"
        replay = client.post(
            "/internal/v1/normalized-articles", json=normalized_payload, headers=headers
        )
        assert replay.status_code == 202
        assert replay.json()["operation"] == "REPLAYED"

        for _ in range(3):
            assert worker.process_once() is True
        public = client.get(
            "/internal/v1/public/articles",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert public.status_code == 200
        assert len(public.json()["items"]) == 1


def test_api_rejects_idempotency_key_with_different_body(normalized_payload):
    repository = MemoryPipelineRepository()
    admission = FakeAdmission()
    orchestrator = PipelineOrchestrator(
        repository, admission, FakeQuality(), FakeSummarizer(), job_max_attempts=3
    )
    runtime = SimpleNamespace(
        repository=repository,
        admission=admission,
        orchestrator=orchestrator,
        worker=DurableWorker(repository, orchestrator),
    )
    settings = Settings("x", 3306, "x", "x", "x", "token", backend="memory")
    app = create_app(settings=settings, runtime=runtime, start_worker=False)
    headers = {"Authorization": "Bearer token", "Idempotency-Key": "same"}
    with TestClient(app) as client:
        assert client.post(
            "/internal/v1/normalized-articles", json=normalized_payload, headers=headers
        ).status_code == 202
        changed = dict(normalized_payload)
        changed["crawlItemId"] = "other-item"
        response = client.post(
            "/internal/v1/normalized-articles", json=changed, headers=headers
        )
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSE"
