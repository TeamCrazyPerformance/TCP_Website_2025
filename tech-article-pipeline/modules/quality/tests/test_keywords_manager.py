import json
import os
from pathlib import Path

import pytest

from tech_article_quality import keywords_manager as manager
from tech_article_quality import evaluator

REAL_FETCH_STACKOVERFLOW = manager.fetch_stackoverflow_popular_tags
REAL_FETCH_GITHUB_TRENDING = manager.fetch_github_trending_keywords


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(tmp_path / "keywords.json"))
    monkeypatch.setattr(manager, "KEYWORD_HISTORY_PATH", str(tmp_path / "history.json"))
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: set())
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: set())


def test_dummy_writes_never_change_bundled_dictionary():
    seed = manager.SEED_KEYWORD_PATH.read_bytes()
    history_path = manager.SEED_KEYWORD_PATH.with_name("keywords_history.json")
    history = history_path.read_bytes()
    manager.save_keywords_to_json({"alpha", "beta"})
    manager.save_keywords_to_json({"beta", "gamma"})
    assert manager.load_keywords_from_json() == manager.CORE_IMMUTABLE_KEYWORDS | {"beta", "gamma"}
    assert manager.SEED_KEYWORD_PATH.read_bytes() == seed
    assert history_path.read_bytes() == history
    assert not {"alpha", "beta", "gamma"} & manager.load_keywords_from_json(manager.SEED_KEYWORD_PATH)


def test_source_write_is_rejected(monkeypatch):
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(manager.SEED_KEYWORD_PATH))
    with pytest.raises(OSError, match="bundled source"):
        manager.save_keywords_to_json({"dummy"})


def test_expired_cache_survives_fetch_failure():
    manager.save_keywords_to_json({"real-framework"})
    os.utime(manager.KEYWORD_JSON_PATH, (0, 0))
    before = Path(manager.KEYWORD_JSON_PATH).read_bytes()
    assert "real-framework" in manager.get_combined_developer_keywords()
    assert Path(manager.KEYWORD_JSON_PATH).read_bytes() == before


@pytest.mark.parametrize("payload", ['{', '[]', '{"all_combined_keywords":"dummy"}',
                                     '{"all_combined_keywords":[null]}', '{}'])
def test_invalid_cache_falls_back_to_seed(payload):
    Path(manager.KEYWORD_JSON_PATH).write_text(payload)
    assert manager.get_combined_developer_keywords() == manager.load_keywords_from_json(manager.SEED_KEYWORD_PATH)


def test_missing_seed_and_cache_still_provide_core(monkeypatch, tmp_path):
    monkeypatch.setattr(manager, "SEED_KEYWORD_PATH", tmp_path / "absent.json")
    assert manager.get_combined_developer_keywords() == manager.CORE_IMMUTABLE_KEYWORDS


def test_fresh_cache_does_not_fetch(monkeypatch):
    manager.save_keywords_to_json({"real-framework"})
    def unexpected_fetch(**kwargs):
        pytest.fail("Fresh cache must not fetch")
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", unexpected_fetch)
    assert "real-framework" in manager.get_combined_developer_keywords()


def test_stackexchange_page_size_is_clamped_and_tags_are_parsed(monkeypatch):
    requested_urls = []

    class Response:
        def read(self):
            return b'{"items":[{"name":"python"},{"name":"c++"}]}'

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def fake_urlopen(request, timeout):
        requested_urls.append(request.full_url)
        assert timeout == 6
        return Response()

    monkeypatch.setattr(manager.urllib.request, "urlopen", fake_urlopen)

    assert REAL_FETCH_STACKOVERFLOW(limit=150) == ["python", "c++"]
    assert "pagesize=100" in requested_urls[0]


def test_github_trending_collects_repository_topics(monkeypatch):
    requested_urls = []

    class Response:
        def __init__(self, payload):
            self.payload = payload

        def read(self):
            return self.payload

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    def fake_urlopen(request, timeout):
        requested_urls.append(request.full_url)
        if request.full_url.startswith("https://github.com/trending"):
            return Response(b'<h2><a href="/acme/tool">tool</a></h2>')
        return Response(b'{"names":["web-framework", "test"]}')

    monkeypatch.setattr(manager.urllib.request, "urlopen", fake_urlopen)

    assert REAL_FETCH_GITHUB_TRENDING() == ["web-framework"]
    assert requested_urls == [
        "https://github.com/trending?since=daily",
        "https://api.github.com/repos/acme/tool/topics",
    ]


def test_first_evaluator_request_persists_dictionary_after_store_configuration(monkeypatch):
    class Store:
        def __init__(self):
            self.saved_keywords = None

        def load_active_keyword_dictionary(self):
            return None

        def save_keyword_dictionary(self, *, keywords, source, previous_keywords):
            self.saved_keywords = set(keywords)
            return {}

        def record_keyword_update_failure(self, *, source, error_message):
            pytest.fail(error_message)

        def upsert_keyword_observations(self, *, observations):
            self.observations = observations

        def load_keyword_observations(self, *, limit):
            return self.observations[:limit]

    store = Store()
    monkeypatch.setattr(manager, "KEYWORD_STORE", store)
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun"})
    monkeypatch.setattr(manager, "fetch_github_trending_keywords", lambda **kwargs: {"github-actions"})
    monkeypatch.setattr(evaluator, "DEVELOPER_KEYWORDS", manager.CORE_IMMUTABLE_KEYWORDS)
    monkeypatch.setattr(evaluator, "_LAST_KEYWORD_REFRESH_CHECK", 0.0)

    snapshot = evaluator.QualityEvaluator().keyword_snapshot()

    assert "bun" in snapshot["dynamicKeywords"]
    assert store.saved_keywords is not None
    assert "bun" in store.saved_keywords
    assert "github-actions" in store.saved_keywords
    assert not Path(manager.KEYWORD_JSON_PATH).exists()
    assert not Path(manager.KEYWORD_HISTORY_PATH).exists()


def test_successful_refresh_and_history(monkeypatch):
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"fastapi", "bun", "test"})
    expected = manager.CORE_IMMUTABLE_KEYWORDS | {"bun"}
    assert manager.get_combined_developer_keywords() == expected
    assert manager.load_keywords_from_json() == expected
    assert json.loads(Path(manager.KEYWORD_HISTORY_PATH).read_text(encoding="utf-8"))["history"][0]["added_keywords"] == ["bun"]


def test_dynamic_source_stopwords_are_not_persisted(monkeypatch):
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: set())
    monkeypatch.setattr(
        manager, "fetch_github_trending_keywords", lambda **kwargs: {"agent", "hacktoberfest", "web-framework"}
    )

    assert "web-framework" in manager.get_combined_developer_keywords()
    assert "agent" not in manager.get_combined_developer_keywords()
    assert "hacktoberfest" not in manager.get_combined_developer_keywords()


def test_dynamic_source_allocations_cap_the_daily_union():
    stackoverflow = [f"stack-{index:03}" for index in range(120)]
    github = [f"github-{index:03}" for index in range(40)]
    merged = manager._merge_daily_candidates(stackoverflow, github)

    assert len(merged) == 125
    assert sum(item["source"] == "stack-overflow" for item in merged) == 100
    assert sum(item["source"] == "github-trending" for item in merged) == 25


def test_unwritable_cache_does_not_break_initialization(monkeypatch, tmp_path):
    blocked = tmp_path / "file"
    blocked.write_text("not a directory")
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(blocked / "keywords.json"))
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun"})
    assert "bun" in manager.get_combined_developer_keywords()


def test_atomic_replace_failure_keeps_previous_cache(monkeypatch):
    manager.save_keywords_to_json({"old-framework"})
    before = Path(manager.KEYWORD_JSON_PATH).read_bytes()
    def fail_replace(*args):
        raise OSError("simulated replace failure")
    monkeypatch.setattr(manager.os, "replace", fail_replace)
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"bun"})
    os.utime(manager.KEYWORD_JSON_PATH, (0, 0))
    assert "bun" in manager.get_combined_developer_keywords()
    assert Path(manager.KEYWORD_JSON_PATH).read_bytes() == before


def test_process_start_without_network_or_writable_cache(tmp_path):
    import subprocess
    import sys

    blocked = tmp_path / "blocked"
    blocked.write_text("not a directory")
    env = os.environ.copy()
    env["QUALITY_KEYWORD_CACHE_DIR"] = str(blocked)
    env["PYTHONPATH"] = str(manager.SEED_KEYWORD_PATH.parent.parent)
    result = subprocess.run(
        [sys.executable, "-c", """
import urllib.request
from urllib.error import URLError

def offline(*args, **kwargs):
    raise URLError("offline startup test")

urllib.request.urlopen = offline
from tech_article_quality import QualityEvaluator
snapshot = QualityEvaluator().keyword_snapshot()
assert snapshot["totalCount"] == 113
assert snapshot["dynamicKeywords"] == []
print("startup ok")
"""],
        env=env, text=True, capture_output=True, timeout=10,
    )
    assert result.returncode == 0, result.stderr
    assert "startup ok" in result.stdout
