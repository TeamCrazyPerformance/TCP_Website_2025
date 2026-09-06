import inspect
from pathlib import Path

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
