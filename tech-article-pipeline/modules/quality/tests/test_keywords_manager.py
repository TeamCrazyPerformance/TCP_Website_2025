import json
import os
from pathlib import Path

import pytest

from tech_article_quality import keywords_manager as manager


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(manager, "KEYWORD_JSON_PATH", str(tmp_path / "keywords.json"))
    monkeypatch.setattr(manager, "KEYWORD_HISTORY_PATH", str(tmp_path / "history.json"))
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: set())


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


def test_successful_refresh_and_history(monkeypatch):
    monkeypatch.setattr(manager, "fetch_stackoverflow_popular_tags", lambda **kwargs: {"fastapi", "bun", "test"})
    expected = manager.CORE_IMMUTABLE_KEYWORDS | {"bun"}
    assert manager.get_combined_developer_keywords() == expected
    assert manager.load_keywords_from_json() == expected
    assert json.loads(Path(manager.KEYWORD_HISTORY_PATH).read_text())["history"][0]["added_keywords"] == ["bun"]


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
