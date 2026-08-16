from pathlib import Path

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
