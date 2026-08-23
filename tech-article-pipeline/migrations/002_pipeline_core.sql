-- Durable orchestration, evaluation, and publication schema for MySQL 8.4.

CREATE TABLE IF NOT EXISTS crawl_runs (
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_payload JSON NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (crawl_run_id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS crawl_items (
    crawl_item_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    item_payload JSON NOT NULL,
    produced_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (crawl_item_id),
    KEY idx_crawl_items_run (crawl_run_id, created_at)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS pipeline_submissions (
    submission_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    idempotency_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    body_digest BINARY(32) NOT NULL,
    payload JSON NOT NULL,
    state VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    duplicate_review_case_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    admission_result JSON NULL,
    quality_result JSON NULL,
    enrichment_result JSON NULL,
    initial_job_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (submission_id),
    UNIQUE KEY uq_pipeline_submission_idempotency (idempotency_key),
    KEY idx_pipeline_submission_article (article_id),
    KEY idx_pipeline_submission_duplicate_review (duplicate_review_case_id),
    KEY idx_pipeline_submission_state (state, created_at)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS pipeline_jobs (
    job_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submission_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    unique_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    stage VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
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
    UNIQUE KEY uq_pipeline_job_key (unique_key),
    KEY idx_pipeline_job_claim (status, available_at, created_at),
    KEY idx_pipeline_job_submission (submission_id, created_at),
    CONSTRAINT fk_pipeline_job_submission FOREIGN KEY (submission_id)
        REFERENCES pipeline_submissions (submission_id) ON DELETE CASCADE,
    CONSTRAINT chk_pipeline_job_stage CHECK (stage IN ('ADMISSION', 'QUALITY', 'ENRICHMENT')),
    CONSTRAINT chk_pipeline_job_status CHECK (
        status IN ('PENDING', 'RUNNING', 'RETRY', 'SUCCEEDED', 'DEAD')
    ),
    CONSTRAINT chk_pipeline_job_attempts CHECK (
        attempt_count <= max_attempts AND max_attempts BETWEEN 1 AND 20
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS article_processing_results (
    result_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submission_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    stage VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    result_payload JSON NULL,
    error JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (result_id),
    UNIQUE KEY uq_processing_result_submission_stage (submission_id, stage),
    KEY idx_processing_result_article (article_id, created_at),
    CONSTRAINT fk_processing_result_article FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE CASCADE,
    CONSTRAINT fk_processing_result_submission FOREIGN KEY (submission_id)
        REFERENCES pipeline_submissions (submission_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS quality_review_cases (
    case_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submission_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    evaluation_payload JSON NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    case_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    administrator_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (case_id),
    UNIQUE KEY uq_quality_review_submission (submission_id),
    KEY idx_quality_review_queue (status, created_at),
    CONSTRAINT fk_quality_review_submission FOREIGN KEY (submission_id)
        REFERENCES pipeline_submissions (submission_id) ON DELETE CASCADE,
    CONSTRAINT fk_quality_review_article FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE CASCADE,
    CONSTRAINT chk_quality_review_status CHECK (
        status IN ('PENDING', 'RESOLVED_APPROVE', 'RESOLVED_REJECT')
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS publication_events (
    event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    previous_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    new_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    administrator_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (event_id),
    KEY idx_publication_event_article (article_id, created_at),
    CONSTRAINT fk_publication_event_article FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON DELETE CASCADE,
    CONSTRAINT chk_publication_action CHECK (action IN ('PUBLISH', 'HIDE', 'ARCHIVE'))
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS pipeline_settings (
    setting_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    setting_value VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    record_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (setting_key),
    CONSTRAINT chk_pipeline_setting_version CHECK (record_version >= 1)
) ENGINE = InnoDB;

INSERT IGNORE INTO pipeline_settings (setting_key, setting_value, record_version)
VALUES ('publication_policy', 'IMMEDIATE', 1);

ALTER TABLE articles
    ADD COLUMN quality_score TINYINT UNSIGNED NULL AFTER publication_status,
    ADD COLUMN quality_decision VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER quality_score,
    ADD COLUMN localized_title VARCHAR(1000) NULL AFTER quality_decision,
    ADD COLUMN tags JSON NULL AFTER localized_title,
    ADD COLUMN one_line_summary VARCHAR(500) NULL AFTER tags,
    ADD COLUMN summary TEXT NULL AFTER one_line_summary,
    ADD COLUMN localized_content LONGTEXT NULL AFTER summary,
    ADD COLUMN published_at DATETIME(6) NULL AFTER localized_content,
    ADD CONSTRAINT chk_articles_quality_score CHECK (quality_score IS NULL OR quality_score <= 100),
    ADD CONSTRAINT chk_articles_quality_decision CHECK (
        quality_decision IS NULL OR quality_decision IN ('PASS', 'REJECT', 'REVIEW_REQUIRED')
    );

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('002', 'durable pipeline jobs, quality review, enrichment and publication');
