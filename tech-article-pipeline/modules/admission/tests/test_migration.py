from __future__ import annotations

from pathlib import Path


def test_mysql_84_migration_contains_required_atomic_tables() -> None:
    sql = (
        Path(__file__).parents[3] / "migrations" / "001_article_admission.sql"
    ).read_text(encoding="utf-8")

    for table in (
        "pipeline_locks",
        "duplicate_checks",
        "duplicate_review_cases",
        "duplicate_review_resolutions",
        "articles",
        "article_fingerprints",
        "article_lsh_buckets",
        "article_deletion_audits",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql
    assert "candidate_search_status" in sql
    assert "sequence_value" in sql
    assert "last_value" not in sql.lower()
    assert "ON DELETE CASCADE" in sql
    assert "PostgreSQL" not in sql
