from __future__ import annotations

import asyncio
import threading
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx
import pytest
from tech_article_pipeline.api.app import _quality_keywords_read, create_app
from tech_article_pipeline.persistence import memory
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_quality import QualityEvaluator
from tech_article_quality import keywords_manager as manager

NOW = datetime(2026, 10, 3, 1, tzinfo=UTC)


@pytest.fixture
def repository(monkeypatch):
    store = MemoryPipelineRepository()
    monkeypatch.setattr(manager, "KEYWORD_STORE", store)
    monkeypatch.setattr(
        manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=["bun"])
    )
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", AsyncMock(return_value=[]))
    return store


def expire(store):
    store.keyword_dictionary_versions[0]["updatedAt"] = (
        datetime.now(UTC) - timedelta(days=1)
    ).isoformat()


@pytest.mark.asyncio
async def test_first_and_repeated_reads_never_collect_or_write(repository, monkeypatch):
    writes = Mock(side_effect=AssertionError("Read must not write"))
    monkeypatch.setattr(repository, "save_keyword_dictionary", writes)
    quality = QualityEvaluator()
    for _ in range(2):
        snapshot = quality.keyword_snapshot()
        assert snapshot["totalCount"] == 113
        assert snapshot["loadedVersion"] is None
        _quality_keywords_read(SimpleNamespace(quality=quality), repository)
        quality.evaluate({})
    assert not repository.keyword_update_history
    manager.fetch_stackoverflow_popular_tags.assert_not_called()
    manager.fetch_github_trending_keywords.assert_not_called()
    writes.assert_not_called()


@pytest.mark.asyncio
async def test_refresh_persists_and_restart_reads_the_same_snapshot(repository):
    quality = QualityEvaluator()
    result = await quality.refresh_keyword_dictionary()
    active = repository.load_active_keyword_dictionary()
    assert result["status"] == "SUCCESS"
    assert result["changed"] is True
    assert result["activeVersion"] == active["versionId"] == result["snapshot"]["loadedVersion"]
    assert result["activatedAt"] == active["updatedAt"] == result["snapshot"]["loadedActivatedAt"]
    assert set(active["keywords"]) == set(
        result["snapshot"]["coreKeywords"] + result["snapshot"]["dynamicKeywords"]
    )
    assert "bun" in QualityEvaluator().keyword_snapshot()["dynamicKeywords"]
    assert result["source"] == "stack-overflow"
    assert result["warnings"] == ["GITHUB_KEYWORD_SOURCE_UNAVAILABLE"]
    reused = await quality.refresh_keyword_dictionary()
    assert reused["changed"] is False
    assert reused["activeVersion"] == active["versionId"]
    assert len(repository.keyword_dictionary_versions) == 1


@pytest.mark.asyncio
async def test_refresh_retains_recent_observations_and_records_changes(repository, monkeypatch):
    quality = QualityEvaluator()
    await quality.refresh_keyword_dictionary()
    expire(repository)
    monkeypatch.setattr(
        manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=["deno"])
    )
    refreshed = await quality.refresh_keyword_dictionary()
    assert {"bun", "deno"} <= set(refreshed["snapshot"]["dynamicKeywords"])
    assert [item["status"] for item in repository.keyword_dictionary_versions] == [
        "ACTIVE",
        "ARCHIVED",
    ]
    assert repository.keyword_update_history[0]["addedCount"] == 1
    assert repository.keyword_update_history[0]["removedCount"] == 0


@pytest.mark.asyncio
async def test_capacity_evicts_oldest_of_251_observations(repository, monkeypatch):
    monkeypatch.setattr(memory, "_now", lambda: NOW - timedelta(days=1))
    repository.upsert_keyword_observations(
        observations=[{"keyword": "oldest", "source": "stack-overflow"}]
    )
    repository.save_keyword_dictionary(
        keywords=set(manager.CORE_IMMUTABLE_KEYWORDS | {"oldest"}),
        source="test",
        previous_keywords=set(manager.CORE_IMMUTABLE_KEYWORDS),
    )
    monkeypatch.setattr(memory, "_now", lambda: NOW - timedelta(hours=1))
    repository.upsert_keyword_observations(
        observations=[
            {"keyword": f"retained-{i:03}", "source": "stack-overflow"} for i in range(249)
        ]
    )
    monkeypatch.setattr(memory, "_now", lambda: NOW)
    result = await manager.refresh_keyword_dictionary(now=NOW)
    assert "oldest" not in result["dictionary"]["keywords"]
    assert len(set(result["dictionary"]["keywords"]) - manager.CORE_IMMUTABLE_KEYWORDS) == 250
    assert repository.keyword_update_history[0]["removedCount"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "failure",
    [
        "collection",
        "upsert_keyword_observations",
        "load_keyword_observations",
        "save_keyword_dictionary",
    ],
)
async def test_failed_refresh_keeps_db_and_process_snapshot(repository, monkeypatch, failure):
    quality = QualityEvaluator()
    await quality.refresh_keyword_dictionary()
    expire(repository)
    old = quality.keyword_snapshot()
    version = repository.load_active_keyword_dictionary()["versionId"]
    if failure == "collection":
        monkeypatch.setattr(
            manager,
            "fetch_stackoverflow_popular_tags",
            AsyncMock(side_effect=RuntimeError("secret must not escape")),
        )
    else:
        monkeypatch.setattr(
            manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=["deno"])
        )
        monkeypatch.setattr(
            repository, failure, Mock(side_effect=RuntimeError("secret must not escape"))
        )
    with pytest.raises(manager.KeywordRefreshError) as error:
        await quality.refresh_keyword_dictionary()
    assert "secret" not in str(error.value)
    assert repository.load_active_keyword_dictionary()["versionId"] == version
    assert quality.keyword_snapshot()["fingerprint"] == old["fingerprint"]
    assert repository.keyword_update_history[0]["status"] == "FAILED"
    assert (
        "KEYWORD_LAST_REFRESH_FAILED"
        in _quality_keywords_read(SimpleNamespace(quality=quality), repository)["warnings"]
    )


def test_read_failure_preserves_last_good_dictionary(repository, monkeypatch):
    repository.save_keyword_dictionary(
        keywords=set(manager.CORE_IMMUTABLE_KEYWORDS | {"bun"}),
        source="test",
        previous_keywords=set(),
    )
    quality = QualityEvaluator()
    first = quality.keyword_snapshot()
    monkeypatch.setattr(
        repository, "load_active_keyword_dictionary", Mock(side_effect=RuntimeError("offline"))
    )
    quality._last_keyword_check = 0
    failed = quality.keyword_snapshot()
    assert failed["fingerprint"] == first["fingerprint"]
    assert failed["loadedVersion"] == first["loadedVersion"]
    assert failed["warnings"] == ["KEYWORD_DICTIONARY_READ_FAILED"]
    assert QualityEvaluator().keyword_snapshot()["totalCount"] == 113


@pytest.mark.asyncio
async def test_unconfirmed_save_metadata_does_not_install_candidates(repository, monkeypatch):
    quality = QualityEvaluator()
    monkeypatch.setattr(
        repository,
        "save_keyword_dictionary",
        Mock(
            return_value={
                "versionId": "version",
                "keywords": sorted(manager.CORE_IMMUTABLE_KEYWORDS | {"bun"}),
                "updatedAt": "invalid",
                "source": "test",
            }
        ),
    )
    with pytest.raises(manager.KeywordCommitOutcomeUnknown):
        await quality.refresh_keyword_dictionary()
    assert quality.keyword_snapshot()["dynamicKeywords"] == []
    assert not repository.keyword_update_history


@pytest.mark.asyncio
async def test_identical_strings_update_version_and_time(repository):
    quality = QualityEvaluator()
    first = await quality.refresh_keyword_dictionary()
    expire(repository)
    second = await quality.refresh_keyword_dictionary()
    assert second["snapshot"]["fingerprint"] == first["snapshot"]["fingerprint"]
    assert second["activeVersion"] != first["activeVersion"]
    assert second["snapshot"]["loadedVersion"] == second["activeVersion"]
    assert second["changed"] is True


@pytest.mark.asyncio
async def test_cancelled_caller_does_not_release_refresh_lock(repository, monkeypatch):
    entered, release = asyncio.Event(), asyncio.Event()

    async def slow_source(**kwargs):
        entered.set()
        await release.wait()
        return ["bun"]

    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", slow_source)
    quality = QualityEvaluator()
    task = asyncio.create_task(quality.refresh_keyword_dictionary())
    await asyncio.wait_for(entered.wait(), 2)
    assert quality.keyword_snapshot()["dynamicKeywords"] == []
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    with pytest.raises(manager.KeywordRefreshError, match="already running") as error:
        await quality.refresh_keyword_dictionary()
    assert error.value.status_code == 409
    release.set()
    await quality._refresh_task
    assert (await quality.refresh_keyword_dictionary())["changed"] is False
    assert len(repository.keyword_dictionary_versions) == 1


@pytest.mark.asyncio
async def test_collection_budget_cancels_sources_before_any_write(repository, monkeypatch):
    stopped = asyncio.Event()

    async def endless(**kwargs):
        try:
            await asyncio.Event().wait()
        finally:
            stopped.set()

    monkeypatch.setattr(manager, "COLLECTION_BUDGET_SECONDS", 0.01)
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", endless)
    with pytest.raises(manager.KeywordRefreshError) as error:
        await QualityEvaluator().refresh_keyword_dictionary()
    assert error.value.code == "KEYWORD_COLLECTION_TIMEOUT"
    assert stopped.is_set()
    assert not repository.keyword_dictionary_versions
    assert not repository.keyword_observations


@pytest.mark.asyncio
async def test_unknown_commit_and_failed_failure_history_are_not_success(repository, monkeypatch):
    monkeypatch.setattr(
        repository,
        "save_keyword_dictionary",
        Mock(side_effect=manager.KeywordCommitOutcomeUnknown("attempt")),
    )
    quality = QualityEvaluator()
    with pytest.raises(manager.KeywordCommitOutcomeUnknown):
        await quality.refresh_keyword_dictionary()
    assert not repository.keyword_update_history
    assert "KEYWORD_REFRESH_OUTCOME_UNKNOWN" in quality.keyword_snapshot()["warnings"]
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=[]))
    monkeypatch.setattr(
        repository, "record_keyword_update_failure", Mock(side_effect=RuntimeError("offline"))
    )
    with pytest.raises(manager.KeywordRefreshError) as error:
        await quality.refresh_keyword_dictionary()
    assert error.value.code == "KEYWORD_COLLECTION_FAILED"
    assert not repository.keyword_update_history


@pytest.mark.asyncio
async def test_read_reconciles_only_the_unknown_attempt_version(repository, monkeypatch):
    quality = QualityEvaluator()
    save = repository.save_keyword_dictionary

    def lost_confirmation(**kwargs):
        saved = save(**kwargs)
        raise manager.KeywordCommitOutcomeUnknown(saved["versionId"])

    monkeypatch.setattr(repository, "save_keyword_dictionary", lost_confirmation)
    with pytest.raises(manager.KeywordCommitOutcomeUnknown):
        await quality.refresh_keyword_dictionary()
    load = repository.load_active_keyword_dictionary
    saved = load()
    monkeypatch.setattr(
        repository,
        "load_active_keyword_dictionary",
        lambda: {**saved, "versionId": "other-version"},
    )
    assert "KEYWORD_REFRESH_OUTCOME_UNKNOWN" in quality.keyword_snapshot()["warnings"]
    monkeypatch.setattr(repository, "load_active_keyword_dictionary", load)
    quality._last_keyword_check = 0
    snapshot = quality.keyword_snapshot()
    assert snapshot["loadedVersion"] == repository.load_active_keyword_dictionary()["versionId"]
    assert "KEYWORD_REFRESH_OUTCOME_UNKNOWN" not in snapshot["warnings"]


@pytest.mark.asyncio
async def test_inflight_old_db_read_cannot_replace_a_newly_committed_snapshot(
    repository, monkeypatch
):
    repository.save_keyword_dictionary(
        keywords=set(manager.CORE_IMMUTABLE_KEYWORDS | {"old-framework"}),
        source="test",
        previous_keywords=set(),
    )
    expire(repository)
    load = repository.load_active_keyword_dictionary
    entered, release = threading.Event(), threading.Event()
    calls = 0
    call_lock = threading.Lock()

    def read():
        nonlocal calls
        with call_lock:
            calls += 1
            first = calls == 1
        dictionary = load()
        if first:
            entered.set()
            assert release.wait(3)
        return dictionary

    quality = QualityEvaluator()
    monkeypatch.setattr(repository, "load_active_keyword_dictionary", read)
    old_read = asyncio.create_task(asyncio.to_thread(quality.keyword_snapshot))
    try:
        assert await asyncio.to_thread(entered.wait, 2)
        refreshed = await quality.refresh_keyword_dictionary()
    finally:
        release.set()
        await old_read
    current = quality.keyword_snapshot()
    assert current["loadedVersion"] == refreshed["activeVersion"]
    assert current["dynamicKeywords"] == ["bun"]


def api_for(store, quality):
    runtime = SimpleNamespace(repository=store, orchestrator=SimpleNamespace(quality=quality))
    settings = Settings(
        mysql_host="memory",
        mysql_port=3306,
        mysql_user="memory",
        mysql_password="memory",
        mysql_database="memory",
        service_token="test-token",
        backend="memory",
    )
    return create_app(settings=settings, runtime=runtime, start_worker=False)


@pytest.mark.asyncio
async def test_slow_overview_db_read_does_not_block_health(repository, monkeypatch):
    entered, release = threading.Event(), threading.Event()

    def slow_read():
        entered.set()
        assert release.wait(3)
        return None

    monkeypatch.setattr(repository, "load_active_keyword_dictionary", slow_read)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api_for(repository, QualityEvaluator())),
        base_url="http://test",
        headers={"Authorization": "Bearer test-token"},
    ) as client:
        overview = asyncio.create_task(client.get("/internal/v1/admin/overview"))
        try:
            assert await asyncio.to_thread(entered.wait, 2)
            health = await asyncio.wait_for(client.get("/health/live"), 1)
            assert health.status_code == 200
            assert not overview.done()
        finally:
            release.set()
            assert (await overview).status_code == 200


@pytest.mark.asyncio
async def test_api_refresh_contract_failure_auth_and_concurrent_health(repository, monkeypatch):
    quality = QualityEvaluator()
    entered, release = asyncio.Event(), asyncio.Event()

    async def collect(**kwargs):
        entered.set()
        await release.wait()
        return ["bun"]

    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", collect)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=api_for(repository, quality)), base_url="http://test"
    ) as client:
        path = "/internal/v1/admin/quality-keywords/refresh"
        assert (await client.post(path)).status_code == 401
        headers = {"Authorization": "Bearer test-token"}
        refresh = asyncio.create_task(client.post(path, headers=headers))
        await asyncio.wait_for(entered.wait(), 2)
        assert (await client.get("/health/live")).status_code == 200
        assert (await client.post(path, headers=headers)).status_code == 409
        release.set()
        response = await refresh
        assert response.status_code == 200
        assert response.json()["status"] == "SUCCESS"
        expire(repository)
        monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=[]))
        failed = await client.post(path, headers=headers)
        assert failed.status_code == 503
        assert failed.json()["detail"]["code"] == "KEYWORD_COLLECTION_FAILED"
        monkeypatch.setattr(
            manager, "fetch_stackoverflow_popular_tags", AsyncMock(return_value=["deno"])
        )
        monkeypatch.setattr(
            repository,
            "save_keyword_dictionary",
            Mock(side_effect=manager.KeywordCommitOutcomeUnknown("unknown-test")),
        )
        history_count = len(repository.keyword_update_history)
        unknown = await client.post(path, headers=headers)
        assert unknown.status_code == 503
        assert unknown.json()["detail"]["code"] == "KEYWORD_REFRESH_OUTCOME_UNKNOWN"
        assert unknown.json()["detail"]["attemptVersion"] == "unknown-test"
        assert len(repository.keyword_update_history) == history_count


@pytest.mark.parametrize(
    "activated,now,expected",
    [
        ("2026-10-02T14:59:59Z", "2026-10-02T15:05:00Z", False),
        ("2026-10-02T15:00:00Z", "2026-10-02T15:05:00Z", True),
        ("bad", "2026-10-02T15:05:00Z", False),
    ],
)
def test_kst_day_success(activated, now, expected):
    assert (
        manager.is_current_day(
            {"versionId": "version", "updatedAt": activated},
            datetime.fromisoformat(now.replace("Z", "+00:00")),
        )
        is expected
    )
