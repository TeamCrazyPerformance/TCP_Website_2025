from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository
from tech_article_quality.keywords_manager import KeywordCommitOutcomeUnknown


class TransactionProbe:
    def __init__(self, failure=None):
        self.failure = failure
        self.committed = False
        self.commits = 0
        self.rollbacks = 0
        self.read_after_commit = 0
        self.connections = 0
        self.version = None
        self.keywords = []
        self.activated_at = datetime(2026, 10, 3, 1, tzinfo=UTC)

    def connect(self):
        self.connections += 1
        if self.failure == "unknown" and self.connections > 1:
            raise RuntimeError("reconciliation unavailable")
        return Connection(self)


class Connection:
    def __init__(self, probe):
        self.probe = probe

    def cursor(self, **kwargs):
        return Cursor(self.probe)

    def commit(self):
        self.probe.commits += 1
        self.probe.committed = True
        if self.probe.failure in {"ack_lost", "unknown"}:
            raise RuntimeError("commit acknowledgement lost")

    def rollback(self):
        self.probe.rollbacks += 1

    def close(self):
        if self.probe.failure == "cleanup":
            raise RuntimeError("cleanup failed")


class Cursor:
    def __init__(self, probe):
        self.probe = probe
        self.row = None

    def execute(self, sql, params=None):
        if self.probe.committed and sql.startswith("SELECT activated_at"):
            self.probe.read_after_commit += 1
            raise RuntimeError("post-commit reads must not determine success")
        if sql.startswith("INSERT INTO quality_keyword_dictionary_versions"):
            self.probe.version = params[0]
        if sql.startswith("SELECT activated_at"):
            if self.probe.failure == "before_commit":
                raise RuntimeError("metadata read failed")
            self.row = {"activated_at": self.probe.activated_at}
        if sql.startswith("SELECT v.version_id"):
            self.row = {
                "version_id": self.probe.version,
                "source": "test",
                "activated_at": self.probe.activated_at,
            }

    def executemany(self, sql, params):
        self.probe.keywords = [row[1] for row in params]

    def fetchone(self):
        return self.row

    def fetchall(self):
        return [{"keyword": keyword} for keyword in self.probe.keywords]

    def close(self):
        if self.probe.failure == "cleanup":
            raise RuntimeError("cleanup failed")


def repository(probe, monkeypatch):
    repo = MySQLPipelineRepository(SimpleNamespace())
    monkeypatch.setattr(repo, "_connection", probe.connect)
    return repo


@pytest.mark.parametrize("failure", [None, "cleanup", "ack_lost"])
def test_confirmed_commit_survives_cleanup_and_lost_acknowledgement(failure, monkeypatch):
    probe = TransactionProbe(failure)
    saved = repository(probe, monkeypatch).save_keyword_dictionary(
        keywords={"python", "bun"}, source="test", previous_keywords={"python"}
    )
    assert saved["versionId"] == probe.version
    assert saved["keywords"] == ["bun", "python"]
    assert probe.commits == 1
    assert probe.read_after_commit == 0
    assert probe.connections == (2 if failure == "ack_lost" else 1)


def test_pre_commit_failure_rolls_back_without_claiming_success(monkeypatch):
    probe = TransactionProbe("before_commit")
    with pytest.raises(RuntimeError, match="metadata read failed"):
        repository(probe, monkeypatch).save_keyword_dictionary(
            keywords={"python"}, source="test", previous_keywords=set()
        )
    assert probe.commits == 0
    assert probe.rollbacks == 1


def test_unconfirmed_commit_is_not_reported_as_a_rolled_back_failure(monkeypatch):
    probe = TransactionProbe("unknown")
    with pytest.raises(KeywordCommitOutcomeUnknown) as error:
        repository(probe, monkeypatch).save_keyword_dictionary(
            keywords={"python"}, source="test", previous_keywords=set()
        )
    assert error.value.version_id == probe.version
    assert probe.committed is True
    assert error.value.code == "KEYWORD_REFRESH_OUTCOME_UNKNOWN"
