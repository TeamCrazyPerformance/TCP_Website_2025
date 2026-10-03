import hashlib
import inspect
from pathlib import Path

import pytest
from tech_article_pipeline.persistence import migrate
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository

ROOT = Path(__file__).parents[1]


def test_core_migration_has_durable_queue_and_projection_tables():
    sql = (ROOT / "migrations" / "002_pipeline_core.sql").read_text(encoding="utf-8")
    for table in (
        "crawl_runs",
        "crawl_items",
        "pipeline_submissions",
        "pipeline_jobs",
        "article_processing_results",
        "quality_review_cases",
        "publication_events",
        "pipeline_settings",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql
    assert "SKIP LOCKED" not in sql
    assert "publication_policy', 'IMMEDIATE'" in sql


def test_runtime_claim_uses_skip_locked_and_lease_recovery():
    source = (
        ROOT / "core" / "src" / "tech_article_pipeline" / "persistence" / "mysql.py"
    ).read_text(encoding="utf-8")
    assert "FOR UPDATE SKIP LOCKED" in source
    assert "LEASE_EXPIRED" in source


def test_crawl_migration_has_durable_queue_and_submission_linkage():
    sql = (ROOT / "migrations" / "003_crawl_ingestion.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS crawl_jobs" in sql
    assert "normalization_payload JSON" in sql
    assert "submission_id VARCHAR(64)" in sql
    assert "idx_crawl_job_claim" in sql


def test_crawl_operations_migration_persists_trigger_and_history_indexes():
    sql = (ROOT / "migrations" / "004_crawl_operations.sql").read_text(encoding="utf-8")
    assert "trigger_type" in sql
    assert "WHERE idempotency_key LIKE 'auto-crawl:%'" in sql
    assert "WHERE trigger_type IS NULL" not in sql
    assert sql.count("updated_at = updated_at") == 2
    assert "idx_crawl_run_created" in sql
    assert "idx_crawl_run_source" in sql
    assert "idx_crawl_run_trigger" in sql
    assert "completed_at = COALESCE" in sql


def test_processing_metadata_is_stored_directly_on_articles_without_backfill():
    sql = (ROOT / "migrations" / "006_article_processing_metadata.sql").read_text(encoding="utf-8")
    assert "ALTER TABLE articles" in sql
    assert "crawler_version" in sql
    assert "quality_evaluator_version" in sql
    assert "quality_policy_version" in sql
    assert "quality_evaluation JSON" in sql
    assert "quality_recalculation_status" in sql
    assert "ATTENTION_REQUIRED" in sql
    assert "summarizer_version" in sql
    assert "summary_model" in sql
    assert "summary_prompt_version" in sql
    assert "completed_at DATETIME(6)" in sql
    assert "idx_processing_result_completion" in sql
    assert "information_schema.COLUMNS" in sql
    assert "PREPARE processing_result_statement" in sql
    assert "PREPARE article_metadata_statement" in sql
    assert "PREPARE article_quality_evaluation_statement" in sql
    assert "PREPARE quality_recalculation_status_statement" in sql
    assert "article_processing_provenance" not in sql
    assert "UPDATE articles" not in sql
    assert "pipeline_submissions" not in sql


def test_selective_reprocessing_migration_tracks_both_job_purposes():
    sql = (ROOT / "migrations" / "007_selective_reprocessing_jobs.sql").read_text(encoding="utf-8")
    assert "ADD COLUMN purpose" in sql
    assert "SUMMARY_REGENERATION" in sql
    assert "QUALITY_RECALCULATION" in sql
    assert "ADD COLUMN requested_by" in sql
    assert "ADD COLUMN target_versions JSON" in sql
    assert "idx_pipeline_job_purpose" in sql
    assert "information_schema.COLUMNS" in sql
    assert "PREPARE reprocessing_job_statement" in sql
    assert "DROP CHECK" not in sql


def test_keyword_observations_migration_preserves_first_and_last_collection_dates():
    sql = (ROOT / "migrations" / "009_quality_keyword_observations.sql").read_text(encoding="utf-8")
    assert "quality_keyword_observations" in sql
    assert "first_collected_at" in sql
    assert "last_collected_at" in sql
    assert "PRIMARY KEY (keyword)" in sql


def test_mysql_runtime_uses_article_version_columns_without_provenance_join():
    source = (ROOT / "core/src/tech_article_pipeline/persistence/mysql.py").read_text(
        encoding="utf-8"
    )
    assert "article_processing_provenance" not in source
    assert "a.quality_evaluator_version" in source
    assert "a.summarizer_version" in source
    assert "a.summary_model" in source
    assert "a.summary_prompt_version" in source


def test_quality_recalculation_preserves_the_original_submission_result():
    source = inspect.getsource(MySQLPipelineRepository.mark_quality_recalculation_result)
    assert "UPDATE pipeline_submissions" not in source
    assert "quality_evaluation = %s" in source
    assert "quality_recalculation_status = %s" in source


class KeywordMigrationProbe:
    def __init__(self, mismatch=None):
        self.mismatch = mismatch
        self.rows = []
        self.ddl = []
        self.history = {
            path.name[:3]: {
                "filename": path.name,
                "checksum_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
            for path in (ROOT / "migrations").glob("[0-9][0-9][0-9]_*.sql")
            if path.name[:3] <= "007"
        }

    def cursor(self, **kwargs):
        return self

    def close(self):
        pass

    def execute(self, sql, params=None):
        self.rows = []
        if sql.startswith("SELECT filename"):
            self.rows = [self.history[params[0]]] if params[0] in self.history else []
        elif sql.startswith("INSERT INTO pipeline_migration_history"):
            self.history[params[0]] = {"filename": params[1], "checksum_sha256": params[2]}
        elif sql.startswith("SELECT ENGINE"):
            self.rows = [{"ENGINE": "MyISAM" if self.mismatch == "engine" else "InnoDB"}]
        elif "FROM information_schema.COLUMNS" in sql:
            columns = next(
                tables[params[0]]
                for tables in migrate._KEYWORD_TABLES.values()
                if params[0] in tables
            )
            self.rows = [
                {
                    "COLUMN_NAME": name,
                    "COLUMN_TYPE": definition[0],
                    "IS_NULLABLE": definition[1],
                    "COLLATION_NAME": definition[2],
                    "COLUMN_DEFAULT": "CURRENT_TIMESTAMP(6)"
                    if definition[:2] == ("datetime(6)", "NO")
                    else None,
                }
                for name, definition in columns.items()
            ]
            if self.mismatch == "columns":
                self.rows[0]["COLUMN_TYPE"] = "varchar(1)"
            if self.mismatch == "defaults":
                for row in self.rows:
                    row["COLUMN_DEFAULT"] = None
        elif "FROM information_schema.STATISTICS" in sql:
            self.rows = [
                {"INDEX_NAME": name, "COLUMN_NAME": column}
                for name, columns in migrate._KEYWORD_INDEXES[params[0]].items()
                for column in columns
            ]
            if self.mismatch == "indexes":
                self.rows = []
        elif "REFERENTIAL_CONSTRAINTS" in sql:
            self.rows = [
                {
                    "TABLE_NAME": table,
                    "COLUMN_NAME": "version_id",
                    "REFERENCED_TABLE_NAME": "quality_keyword_dictionary_versions",
                    "REFERENCED_COLUMN_NAME": "version_id",
                    "DELETE_RULE": rule,
                }
                for table, rule in [
                    ("quality_keyword_dictionary_items", "CASCADE"),
                    ("quality_keyword_update_history", "SET NULL"),
                ]
            ]
            if self.mismatch == "foreign keys":
                self.rows = []
        elif "CHECK_CONSTRAINTS" in sql:
            self.rows = [{"ENFORCED": "YES", "CHECK_CLAUSE": "(`keyword_count` > 0)"}]
            if self.mismatch == "check":
                self.rows = []
        elif sql.startswith("CREATE TABLE") and "pipeline_migration_history" not in sql:
            self.ddl.append(sql)

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows


def configure_migration_probe(monkeypatch, probe):
    monkeypatch.setattr(migrate.mysql.connector, "connect", lambda **kwargs: probe)
    monkeypatch.setattr(migrate, "migration_directory", lambda: ROOT / "migrations")
    for name in ("USER", "PASSWORD", "DATABASE"):
        monkeypatch.setenv(f"TECH_ARTICLE_MYSQL_{name}", "test-only")


def test_007_upgrade_adds_only_four_keyword_tables_and_reapply_skips_ddl(monkeypatch):
    probe = KeywordMigrationProbe()
    configure_migration_probe(monkeypatch, probe)
    migrate.apply_migrations()
    assert len(probe.ddl) == 4
    assert set(probe.history) == {f"{number:03}" for number in range(1, 10)}
    migrate.apply_migrations()
    assert len(probe.ddl) == 4


@pytest.mark.parametrize(
    "mismatch", ["engine", "columns", "defaults", "indexes", "foreign keys", "check"]
)
def test_partial_keyword_schema_mismatch_never_records_success(monkeypatch, mismatch):
    probe = KeywordMigrationProbe(mismatch)
    configure_migration_probe(monkeypatch, probe)
    with pytest.raises(RuntimeError, match="Keyword schema mismatch"):
        migrate.apply_migrations()
    assert "008" not in probe.history


def test_keyword_checksum_mismatch_is_rejected_before_ddl(monkeypatch):
    probe = KeywordMigrationProbe()
    configure_migration_probe(monkeypatch, probe)
    migrate.apply_migrations()
    probe.history["008"]["checksum_sha256"] = "0" * 64
    with pytest.raises(RuntimeError, match="checksum mismatch for 008"):
        migrate.apply_migrations()
    assert len(probe.ddl) == 4
