from __future__ import annotations

from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.api.app import _quality_keywords_read
from tech_article_quality import keywords_manager as manager


def test_durable_store_keeps_the_active_dictionary_and_history(monkeypatch):
    repository = MemoryPipelineRepository()
    monkeypatch.setattr(manager, "KEYWORD_STORE", repository)
    monkeypatch.setattr(
        manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun", "fastapi", "test"}
    )
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: [])

    first = manager.get_combined_developer_keywords()
    active = repository.load_active_keyword_dictionary()

    assert {"bun", "fastapi"} <= first
    assert active is not None
    assert {"bun", "fastapi"} <= set(active["keywords"])
    assert repository.keyword_update_history[0]["status"] == "SUCCESS"

    monkeypatch.setattr(
        manager,
        "fetch_stackoverflow_popular_tags",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("fresh DB version must be reused")),
    )
    assert manager.get_combined_developer_keywords() == first


def test_forced_refresh_archives_the_previous_version_and_records_changes(monkeypatch):
    repository = MemoryPipelineRepository()
    monkeypatch.setattr(manager, "KEYWORD_STORE", repository)
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun"})
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: [])
    manager.get_combined_developer_keywords()

    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"deno"})
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: [])
    refreshed = manager.get_combined_developer_keywords(force_refresh=True)

    assert "deno" in refreshed
    assert "bun" not in refreshed
    assert [item["status"] for item in repository.keyword_dictionary_versions] == ["ACTIVE", "ARCHIVED"]
    assert repository.keyword_update_history[0]["addedCount"] >= 1
    assert repository.keyword_update_history[0]["removedCount"] >= 1


def test_failed_refresh_keeps_active_dictionary_and_records_failure(monkeypatch):
    repository = MemoryPipelineRepository()
    monkeypatch.setattr(manager, "KEYWORD_STORE", repository)
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun"})
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: [])
    expected = manager.get_combined_developer_keywords()

    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: set())
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: [])
    assert manager.get_combined_developer_keywords(force_refresh=True) == expected
    assert repository.load_active_keyword_dictionary() is not None
    assert repository.keyword_update_history[0]["status"] == "FAILED"


def test_admin_overview_exposes_durable_dictionary_status():
    repository = MemoryPipelineRepository()
    repository.save_keyword_dictionary(
        keywords={"python", "bun"}, source="stack-overflow", previous_keywords={"python"}
    )

    class Quality:
        def keyword_snapshot(self):
            return {
                "loadedAt": "2026-09-18T00:00:00Z",
                "fingerprint": "f" * 64,
                "totalCount": 2,
                "coreKeywords": ["python"],
                "dynamicKeywords": ["bun"],
                "refreshPolicy": "REQUEST_TRIGGERED_TTL_CHECK",
            }

    class Orchestrator:
        quality = Quality()

    status = _quality_keywords_read(Orchestrator(), repository)

    assert status["storage"] == "MEMORY"
    assert status["activeVersion"].startswith("keyword-version-")
    assert status["storedKeywordCount"] == 2
    assert status["lastUpdate"]["status"] == "SUCCESS"
