import os
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest
from tech_article_quality import QualityEvaluator
from tech_article_quality import keywords_manager as manager


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(manager, "KEYWORD_STORE", None)
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(tmp_path / "keywords.json"))
    monkeypatch.setattr(manager, "KEYWORD_HISTORY_PATH", str(tmp_path / "history.json"))


def test_dummy_writes_never_change_bundled_dictionary():
    seed = manager.SEED_KEYWORD_PATH.read_bytes()
    history_path = manager.SEED_KEYWORD_PATH.with_name("keywords_history.json")
    history = history_path.read_bytes()
    manager.save_keywords_to_json({"alpha", "beta"})
    manager.save_keywords_to_json({"beta", "gamma"})
    assert manager.load_keywords_from_json() == manager.CORE_IMMUTABLE_KEYWORDS | {"beta", "gamma"}
    assert manager.SEED_KEYWORD_PATH.read_bytes() == seed
    assert history_path.read_bytes() == history


def test_source_write_is_rejected(monkeypatch):
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(manager.SEED_KEYWORD_PATH))
    with pytest.raises(OSError, match="bundled source"):
        manager.save_keywords_to_json({"dummy"})


def test_expired_cache_is_read_without_collection_or_writes(monkeypatch):
    manager.save_keywords_to_json({"real-framework"})
    os.utime(manager.KEYWORD_JSON_PATH, (0, 0))
    before = Path(manager.KEYWORD_JSON_PATH).read_bytes()
    collect = AsyncMock(side_effect=AssertionError("Reads must not collect"))
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", collect)
    assert "real-framework" in manager.get_combined_developer_keywords()
    assert "real-framework" in QualityEvaluator().keyword_snapshot()["dynamicKeywords"]
    assert Path(manager.KEYWORD_JSON_PATH).read_bytes() == before
    collect.assert_not_called()


@pytest.mark.parametrize(
    "payload",
    ["{", "[]", '{"all_combined_keywords":"dummy"}', '{"all_combined_keywords":[null]}', "{}"],
)
def test_invalid_cache_falls_back_to_core(payload):
    Path(manager.KEYWORD_JSON_PATH).write_text(payload)
    assert manager.get_combined_developer_keywords() == manager.CORE_IMMUTABLE_KEYWORDS


def test_missing_seed_and_cache_still_provide_core(monkeypatch, tmp_path):
    monkeypatch.setattr(manager, "SEED_KEYWORD_PATH", tmp_path / "absent.json")
    assert manager.get_combined_developer_keywords() == manager.CORE_IMMUTABLE_KEYWORDS


@pytest.mark.asyncio
async def test_stackexchange_page_size_is_clamped_and_tags_are_parsed():
    urls = []

    def respond(request):
        urls.append(str(request.url))
        return httpx.Response(200, json={"items": [{"name": "python"}, {"name": "c++"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        assert await manager.fetch_stackoverflow_popular_tags(limit=150, client=client) == [
            "python",
            "c++",
        ]
    assert "pagesize=100" in urls[0]


@pytest.mark.asyncio
async def test_github_trending_collects_repository_topics():
    urls = []

    def respond(request):
        urls.append(str(request.url))
        if request.url.host == "github.com":
            return httpx.Response(200, text='<h2><a href="/acme/tool">tool</a></h2>')
        return httpx.Response(200, json={"names": ["web-framework", "test"]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        assert await manager.fetch_github_trending_keywords(client=client) == ["web-framework"]
    assert urls == [
        "https://github.com/trending?since=daily",
        "https://api.github.com/repos/acme/tool/topics",
    ]


@pytest.mark.asyncio
async def test_source_response_size_is_bounded(monkeypatch):
    monkeypatch.setattr(manager, "MAX_RESPONSE_BYTES", 8)
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, content=b"x" * 9),
        )
    ) as client:
        with pytest.raises(ValueError, match="size limit"):
            await manager.fetch_stackoverflow_popular_tags(client=client)


def test_dynamic_source_allocations_and_stopwords():
    stackoverflow = [f"stack-{index:03}" for index in range(120)]
    github = ["agent", "hacktoberfest"] + [f"github-{index:03}" for index in range(40)]
    merged = manager._merge_daily_candidates(stackoverflow, github)
    assert len(merged) == 125
    assert sum(item["source"] == "stack-overflow" for item in merged) == 100
    assert sum(item["source"] == "github-trending" for item in merged) == 25
    assert not {"agent", "hacktoberfest"} & {item["keyword"] for item in merged}


def test_process_start_without_network_or_writable_cache(tmp_path):
    import subprocess
    import sys

    blocked = tmp_path / "blocked"
    blocked.write_text("not a directory")
    env = os.environ.copy()
    env["QUALITY_KEYWORD_CACHE_DIR"] = str(blocked)
    env["PYTHONPATH"] = str(manager.SEED_KEYWORD_PATH.parent.parent)
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
import httpx
async def offline(*args, **kwargs):
    raise AssertionError("Reads must not collect")
httpx.AsyncClient.send = offline
from tech_article_quality import QualityEvaluator
snapshot = QualityEvaluator().keyword_snapshot()
assert snapshot["totalCount"] == 113
assert snapshot["dynamicKeywords"] == []
print("startup ok")
""",
        ],
        env=env,
        text=True,
        capture_output=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    assert "startup ok" in result.stdout
