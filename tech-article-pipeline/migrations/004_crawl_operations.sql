-- Persist crawl provenance and keep newest-first operational history indexed.

ALTER TABLE crawl_runs
    ADD COLUMN trigger_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL
        DEFAULT 'MANUAL' AFTER source_id;

UPDATE crawl_runs
SET
    trigger_type = 'SCHEDULED',
    updated_at = updated_at
WHERE idempotency_key LIKE 'auto-crawl:%';

UPDATE crawl_runs
SET
    completed_at = COALESCE(completed_at, updated_at, created_at),
    updated_at = updated_at
WHERE status IN ('COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')
    AND completed_at IS NULL;

ALTER TABLE crawl_runs
    MODIFY COLUMN trigger_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
        DEFAULT 'MANUAL',
    ADD KEY idx_crawl_run_created (created_at, crawl_run_id),
    ADD KEY idx_crawl_run_source (source_id, created_at, crawl_run_id),
    ADD KEY idx_crawl_run_trigger (trigger_type, created_at, crawl_run_id),
    ADD CONSTRAINT chk_crawl_run_trigger CHECK (
        trigger_type IN ('MANUAL', 'SCHEDULED')
    );

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('004', 'crawl operation provenance and history indexes');
