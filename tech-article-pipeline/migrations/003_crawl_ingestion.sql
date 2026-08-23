-- Durable crawl command queue. Source adapters themselves remain in-memory and DB-agnostic.

ALTER TABLE crawl_runs
    ADD COLUMN idempotency_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER crawl_run_id,
    ADD COLUMN body_digest BINARY(32) NULL AFTER idempotency_key,
    ADD COLUMN source_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER body_digest,
    ADD COLUMN job_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER source_id,
    ADD COLUMN statistics JSON NULL AFTER request_payload,
    ADD COLUMN error JSON NULL AFTER statistics,
    ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6) AFTER created_at,
    ADD UNIQUE KEY uq_crawl_run_idempotency (idempotency_key),
    ADD KEY idx_crawl_run_status (status, created_at);

CREATE TABLE IF NOT EXISTS crawl_jobs (
    job_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts INT UNSIGNED NOT NULL,
    available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    lease_expires_at DATETIME(6) NULL,
    lease_token VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    result JSON NULL,
    error JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (job_id),
    UNIQUE KEY uq_crawl_job_run (crawl_run_id),
    KEY idx_crawl_job_claim (status, available_at, created_at),
    CONSTRAINT fk_crawl_job_run FOREIGN KEY (crawl_run_id)
        REFERENCES crawl_runs (crawl_run_id) ON DELETE CASCADE,
    CONSTRAINT chk_crawl_job_status CHECK (
        status IN ('PENDING', 'RUNNING', 'RETRY', 'SUCCEEDED', 'DEAD')
    ),
    CONSTRAINT chk_crawl_job_attempts CHECK (
        attempt_count <= max_attempts AND max_attempts BETWEEN 1 AND 20
    )
) ENGINE = InnoDB;

ALTER TABLE crawl_items
    ADD COLUMN normalization_payload JSON NULL AFTER item_payload,
    ADD COLUMN submission_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL
        AFTER normalization_payload,
    ADD CONSTRAINT fk_crawl_item_run FOREIGN KEY (crawl_run_id)
        REFERENCES crawl_runs (crawl_run_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_crawl_item_submission FOREIGN KEY (submission_id)
        REFERENCES pipeline_submissions (submission_id) ON DELETE SET NULL;

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('003', 'durable crawl commands and normalized submission linkage');
