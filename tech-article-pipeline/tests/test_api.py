from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from tech_article_pipeline.api import create_app
from tech_article_pipeline.orchestration import PipelineOrchestrator
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_pipeline.worker import DurableWorker
from test_orchestration import FakeAdmission, FakeQuality, FakeSummarizer, FlakyQuality


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
        assert public.json()["totalCount"] == 1
        assert public.json()["lastCrawledAt"] is None

        article = public.json()["items"][0]
        assert list(article) == [
            "articleId",
            "title",
            "localizedTitle",
            "oneLineSummary",
            "tags",
            "source",
            "originalPublishedAt",
            "isNew",
        ]
        assert article["source"] == {"name": "example", "domain": "example.com"}

        detail = client.get(
            f"/internal/v1/public/articles/{article['articleId']}",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert detail.status_code == 200
        assert detail.json()["originalLanguage"] == {"code": "ko", "label": "한국어"}
        assert detail.json()["valueScore"]["overall"] == 88
        assert set(detail.json()["valueScore"]) == {"overall", "scale", "breakdown"}
        assert "evaluation" not in detail.json()

        tags = client.get(
            "/internal/v1/public/tags",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert tags.status_code == 200
        assert len(tags.json()["items"]) == 15

        filtered = client.get(
            "/internal/v1/public/articles?keyword=missing",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert filtered.json()["totalCount"] == 0
        tagged = client.get(
            "/internal/v1/public/articles",
            params=[("tags", "애플리케이션 개발"), ("tags", "보안")],
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert tagged.json()["totalCount"] == 1
        invalid_tag = client.get(
            "/internal/v1/public/articles?tags=not-a-tag",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert invalid_tag.status_code == 422

        admin = client.get(
            "/internal/v1/admin/articles?publicationStatus=PUBLISHED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert admin.status_code == 200
        assert admin.json()["totalCount"] == 1
        stats = client.get(
            "/internal/v1/admin/articles/stats",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert stats.json()["publication"]["PUBLISHED"] == 1

        today = datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
        keyword_snapshot = {
            "loadedAt": "2026-09-06T00:00:00+00:00",
            "fingerprint": "test-fingerprint",
            "totalCount": 2,
            "coreKeywords": ["python"],
            "dynamicKeywords": ["fastapi"],
            "refreshPolicy": "PROCESS_START",
        }
        orchestrator.quality.keyword_snapshot = lambda: keyword_snapshot
        overview = client.get(
            "/internal/v1/admin/overview",
            params={"from": today, "to": today},
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert overview.status_code == 200
        overview_body = overview.json()
        assert overview_body["qualityKeywords"] == {
            **keyword_snapshot,
            "status": "AVAILABLE",
            "warnings": [],
            "coreCount": 1,
            "dynamicCount": 1,
        }
        assert "pipelineVersion" not in str(overview_body)
        assert overview_body["moduleVersions"]["qualityEvaluator"]["moduleVersion"] == "9.1.0"
        assert overview_body["moduleVersions"]["aiSummarizer"] == {
            "moduleVersion": "8.2.0",
            "model": "fake-model-1",
            "promptVersion": "fake-prompt-v3",
        }
        assert overview_body["statistics"]["timezone"] == "Asia/Seoul"
        assert (
            overview_body["statistics"]["definitions"]["collectedCount"]["label"]
            == "신규 수집·등록"
        )
        assert (
            overview_body["statistics"]["definitions"]["processedCount"]["label"] == "AI 요약 완료"
        )
        assert overview_body["statistics"]["daily"][0]["processedCount"] == 1

        orchestrator.quality.keyword_snapshot = lambda: {
            **keyword_snapshot,
            "totalCount": 1,
            "dynamicKeywords": [],
        }
        keyword_warning = client.get(
            "/internal/v1/admin/overview",
            params={"from": today, "to": today},
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert keyword_warning.status_code == 200
        assert keyword_warning.json()["qualityKeywords"] == {
            **keyword_snapshot,
            "totalCount": 1,
            "dynamicKeywords": [],
            "status": "AVAILABLE",
            "warnings": ["DYNAMIC_KEYWORDS_EMPTY"],
            "coreCount": 1,
            "dynamicCount": 0,
        }

        admin_article = admin.json()["items"][0]
        assert admin_article["processingVersions"]["qualityEvaluator"]["moduleVersion"] == "9.1.0"
        assert (
            admin_article["processingVersions"]["aiSummarizer"]["promptVersion"] == "fake-prompt-v3"
        )

        stored_versions = repository.articles[article["articleId"]]["processingVersions"]
        tracked_quality = stored_versions["qualityEvaluator"]
        tracked_summary = stored_versions["aiSummarizer"]
        stored_versions["qualityEvaluator"] = None
        stored_versions["aiSummarizer"] = None
        untracked_quality = client.get(
            "/internal/v1/admin/articles?qualityVersionStatus=UNTRACKED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        untracked_summary = client.get(
            "/internal/v1/admin/articles?summaryVersionStatus=UNTRACKED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert untracked_quality.status_code == 200
        assert untracked_quality.json()["items"][0]["qualityVersionStatus"] == "UNTRACKED"
        assert untracked_summary.status_code == 200
        assert untracked_summary.json()["items"][0]["summaryVersionStatus"] == "UNTRACKED"
        assert (
            client.get(
                "/internal/v1/admin/articles?summaryVersionStatus=OUTDATED",
                headers={"Authorization": "Bearer test-service-token"},
            ).json()["totalCount"]
            == 0
        )
        stored_versions["qualityEvaluator"] = tracked_quality
        stored_versions["aiSummarizer"] = tracked_summary

        orchestrator.quality.module_version = "unknown"
        unknown_quality_target = client.get(
            "/internal/v1/admin/articles?qualityVersionStatus=OUTDATED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert unknown_quality_target.status_code == 200
        assert unknown_quality_target.json()["totalCount"] == 0
        assert unknown_quality_target.json()["qualityTarget"] == {"moduleVersion": "unknown"}

        orchestrator.quality.module_version = "9.2.0"
        orchestrator.quality.decision = "REJECT"
        outdated_quality = client.get(
            "/internal/v1/admin/articles?qualityVersionStatus=OUTDATED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert outdated_quality.status_code == 200
        assert outdated_quality.json()["totalCount"] == 1
        assert outdated_quality.json()["items"][0]["qualityVersionStatus"] == "OUTDATED"
        assert outdated_quality.json()["qualityTarget"] == {"moduleVersion": "9.2.0"}
        before_recalculation = repository.get_article(article["articleId"])
        recalculated = client.post(
            f"/internal/v1/admin/articles/{article['articleId']}/quality-recalculation",
            headers={"Authorization": "Bearer test-service-token"},
            json={
                "expectedRecordVersion": admin_article["recordVersion"],
                "administratorId": "admin-1",
            },
        )
        assert recalculated.status_code == 404
        assert repository.get_article(article["articleId"]) == before_recalculation

        orchestrator.summarizer.module_version = "8.3.0"
        orchestrator.summarizer.model = "fake-model-2"
        orchestrator.summarizer.prompt_version = "fake-prompt-v4"
        outdated = client.get(
            "/internal/v1/admin/articles?summaryVersionStatus=OUTDATED",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert outdated.status_code == 200
        assert outdated.json()["totalCount"] == 1
        assert outdated.json()["items"][0]["summaryVersionStatus"] == "OUTDATED"
        assert outdated.json()["summaryTarget"] == {
            "moduleVersion": "8.3.0",
            "model": "fake-model-2",
            "promptVersion": "fake-prompt-v4",
        }
        before_regeneration = repository.get_article(article["articleId"])
        regenerated = client.post(
            f"/internal/v1/admin/articles/{article['articleId']}/summary-regeneration",
            headers={"Authorization": "Bearer test-service-token"},
            json={
                "expectedRecordVersion": admin_article["recordVersion"],
                "administratorId": "admin-1",
            },
        )
        assert regenerated.status_code == 200
        assert regenerated.json()["status"] == "PENDING"
        queued_article = repository.get_article(article["articleId"])
        assert queued_article["recordVersion"] == before_regeneration["recordVersion"]
        assert queued_article["publicationStatus"] == "PUBLISHED"
        assert queued_article["summaryMarkdown"] == before_regeneration["summaryMarkdown"]
        assert worker.process_once() is True
        admin_article = repository.get_article(article["articleId"])
        assert admin_article["publicationStatus"] == "PUBLISHED"
        assert (
            client.get(
                "/internal/v1/admin/articles?summaryVersionStatus=OUTDATED",
                headers={"Authorization": "Bearer test-service-token"},
            ).json()["totalCount"]
            == 0
        )

        hidden = client.post(
            f"/internal/v1/admin/articles/{article['articleId']}/publication",
            headers={"Authorization": "Bearer test-service-token"},
            json={
                "action": "HIDE",
                "expectedRecordVersion": admin_article["recordVersion"],
                "administratorId": "admin-1",
                "reason": "test",
            },
        )
        assert hidden.status_code == 200
        hidden_detail = client.get(
            f"/internal/v1/public/articles/{article['articleId']}",
            headers={"Authorization": "Bearer test-service-token"},
        )
        assert hidden_detail.status_code == 404


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
        assert (
            client.post(
                "/internal/v1/normalized-articles", json=normalized_payload, headers=headers
            ).status_code
            == 202
        )
        changed = dict(normalized_payload)
        changed["crawlItemId"] = "other-item"
        response = client.post("/internal/v1/normalized-articles", json=changed, headers=headers)
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "IDEMPOTENCY_KEY_REUSE"


def test_admin_detail_exposes_safe_processing_failure(normalized_payload):
    repository = MemoryPipelineRepository()
    admission = FakeAdmission()
    orchestrator = PipelineOrchestrator(
        repository,
        admission,
        FlakyQuality(),
        FakeSummarizer(),
        job_max_attempts=1,
    )
    worker = DurableWorker(repository, orchestrator)
    runtime = SimpleNamespace(
        repository=repository,
        admission=admission,
        orchestrator=orchestrator,
        worker=worker,
    )
    settings = Settings("x", 3306, "x", "x", "x", "token", backend="memory")
    app = create_app(settings=settings, runtime=runtime, start_worker=False)
    headers = {"Authorization": "Bearer token", "Idempotency-Key": "failure-detail"}

    with TestClient(app) as client:
        submitted = client.post(
            "/internal/v1/normalized-articles", json=normalized_payload, headers=headers
        )
        assert submitted.status_code == 202
        assert worker.process_once() is True
        assert worker.process_once() is True

        inventory = client.get(
            "/internal/v1/admin/articles",
            headers={"Authorization": "Bearer token"},
        )
        article = inventory.json()["items"][0]
        assert article["processingStatus"] == "PROCESSING_FAILED"
        assert "processingFailure" not in article

        detail = client.get(
            f"/internal/v1/admin/articles/{article['articleId']}",
            headers={"Authorization": "Bearer token"},
        )
        assert detail.status_code == 200
        assert detail.json()["processingFailure"] == {
            "stage": "QUALITY",
            "code": "INTERNAL_ERROR",
            "message": "Pipeline worker failed unexpectedly.",
            "retryable": True,
            "attemptCount": 1,
            "maxAttempts": 1,
            "failedAt": detail.json()["processingFailure"]["failedAt"],
        }
        assert detail.json()["processingFailure"]["failedAt"] is not None
        assert "details" not in detail.json()["processingFailure"]


def test_api_lists_and_overrides_quality_rejections(normalized_payload):
    repository = MemoryPipelineRepository()
    admission = FakeAdmission()
    summarizer = FakeSummarizer()
    orchestrator = PipelineOrchestrator(
        repository,
        admission,
        FakeQuality("REJECT"),
        summarizer,
        job_max_attempts=3,
    )
    worker = DurableWorker(repository, orchestrator)
    runtime = SimpleNamespace(
        repository=repository,
        admission=admission,
        orchestrator=orchestrator,
        worker=worker,
    )
    settings = Settings("x", 3306, "x", "x", "x", "token", backend="memory")
    app = create_app(settings=settings, runtime=runtime, start_worker=False)
    headers = {
        "Authorization": "Bearer token",
        "Idempotency-Key": "quality-reject",
    }
    with TestClient(app) as client:
        created = client.post(
            "/internal/v1/normalized-articles",
            json=normalized_payload,
            headers=headers,
        )
        assert created.status_code == 202
        assert worker.process_once() is True
        assert worker.process_once() is True

        auth = {"Authorization": "Bearer token"}
        queue = client.get(
            "/internal/v1/admin/reviews/rejected",
            headers=auth,
        )
        assert queue.status_code == 200
        article = queue.json()["items"][0]

        approved = client.post(
            f"/internal/v1/admin/articles/{article['articleId']}/reprocessing",
            headers=auth,
            json={
                "action": "APPROVE_QUALITY",
                "expectedRecordVersion": article["recordVersion"],
                "administratorId": "admin-1",
            },
        )
        assert approved.status_code == 200
        assert approved.json()["processingStatus"] == "ENRICHMENT_PENDING"
        assert worker.process_once() is True
        assert len(repository.list_public_articles(limit=10, offset=0)) == 1
