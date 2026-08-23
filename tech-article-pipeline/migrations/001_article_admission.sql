-- TCP technical article admission schema for MySQL 8.4 LTS.
-- Apply with one migration authority before starting the runtime application.

CREATE TABLE IF NOT EXISTS tech_article_schema_migrations (
    version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    description VARCHAR(255) NOT NULL,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (version)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS pipeline_locks (
    lock_name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (lock_name)
) ENGINE = InnoDB;

INSERT IGNORE INTO pipeline_locks (lock_name) VALUES ('DEDUP_ADMISSION_GLOBAL');

CREATE TABLE IF NOT EXISTS article_id_sequences (
    sequence_date DATE NOT NULL,
    sequence_value BIGINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (sequence_date),
    CONSTRAINT chk_article_id_sequence_positive CHECK (sequence_value >= 1)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS duplicate_checks (
    check_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    check_kind VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    parent_check_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_item_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    input_digest BINARY(32) NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    decision VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
    policy_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fingerprint_version VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    content_sha256 BINARY(32) NULL,
    matched_article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    new_article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    matched_by JSON NULL,
    candidates JSON NULL,
    candidate_search_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
    error JSON NULL,
    checked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (check_id),
    UNIQUE KEY uq_duplicate_check_request_key (request_key),
    KEY idx_duplicate_check_crawl_item (crawl_item_id, created_at),
    KEY idx_duplicate_check_status (status, created_at),
    KEY idx_duplicate_check_parent (parent_check_id),
    KEY idx_duplicate_check_matched (matched_article_id),
    CONSTRAINT fk_duplicate_check_parent FOREIGN KEY (parent_check_id)
        REFERENCES duplicate_checks (check_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_duplicate_check_kind CHECK (
        check_kind IN ('INITIAL', 'RESOLUTION_RECHECK')
    ),
    CONSTRAINT chk_duplicate_check_status CHECK (
        status IN ('PROCESSING', 'SUCCESS', 'FAILED')
    ),
    CONSTRAINT chk_duplicate_check_decision CHECK (
        decision IS NULL OR decision IN ('UNIQUE', 'DUPLICATE', 'POSSIBLE_DUPLICATE')
    ),
    CONSTRAINT chk_candidate_search_status CHECK (
        candidate_search_status IS NULL OR candidate_search_status IN ('COMPLETED', 'TRUNCATED')
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS duplicate_review_cases (
    review_case_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_check_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_item_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    admission_input_digest BINARY(32) NOT NULL,
    admission_payload JSON NULL,
    original_candidate_snapshot JSON NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    case_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    payload_purged_at DATETIME(6) NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (review_case_id),
    UNIQUE KEY uq_review_case_original_check (original_check_id),
    KEY idx_review_case_queue (status, created_at, review_case_id),
    KEY idx_review_case_crawl_item (crawl_item_id),
    CONSTRAINT fk_review_case_original_check FOREIGN KEY (original_check_id)
        REFERENCES duplicate_checks (check_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_review_case_status CHECK (
        status IN ('PENDING', 'RESOLVED_UNIQUE', 'RESOLVED_DUPLICATE')
    ),
    CONSTRAINT chk_review_case_version CHECK (case_version >= 1)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS duplicate_review_resolutions (
    resolution_request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    review_case_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    request_digest BINARY(32) NOT NULL,
    expected_case_version BIGINT UNSIGNED NOT NULL,
    action VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    administrator_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    final_decision VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
    final_check_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    matched_article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    new_article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    error JSON NULL,
    requested_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (resolution_request_id),
    KEY idx_resolution_case (review_case_id, created_at),
    KEY idx_resolution_final_check (final_check_id),
    CONSTRAINT fk_resolution_review_case FOREIGN KEY (review_case_id)
        REFERENCES duplicate_review_cases (review_case_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_resolution_final_check FOREIGN KEY (final_check_id)
        REFERENCES duplicate_checks (check_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_resolution_expected_version CHECK (expected_case_version >= 1),
    CONSTRAINT chk_resolution_action CHECK (
        action IN ('APPROVE_UNIQUE', 'CONFIRM_DUPLICATE')
    ),
    CONSTRAINT chk_resolution_status CHECK (
        status IN ('PROCESSING', 'SUCCESS', 'FAILED')
    ),
    CONSTRAINT chk_resolution_final_decision CHECK (
        final_decision IS NULL OR final_decision IN ('UNIQUE', 'DUPLICATE')
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS article_deletion_audits (
    deletion_request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    article_id_snapshot VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    expected_record_version BIGINT UNSIGNED NOT NULL,
    administrator_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    deleted_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (deletion_request_id),
    KEY idx_deletion_audit_article (article_id_snapshot, deleted_at),
    CONSTRAINT chk_deletion_expected_version CHECK (expected_record_version >= 1)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS articles (
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    origin_check_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    origin_resolution_request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    crawl_run_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    crawl_item_id VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ingest_input_digest BINARY(32) NOT NULL,
    source_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    discovery JSON NULL,
    discovered_url TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
    discovered_url_sha256 BINARY(32) NULL,
    final_url TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
    final_url_sha256 BINARY(32) NULL,
    canonical_url TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    canonical_url_sha256 BINARY(32) NOT NULL,
    title VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    authors JSON NOT NULL,
    content LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    language VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_published_at DATETIME(6) NULL,
    normalizer_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    normalization_warnings JSON NULL,
    processing_status VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    review_status VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    publication_status VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    record_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    content_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (article_id),
    UNIQUE KEY uq_articles_crawl_item (crawl_item_id),
    UNIQUE KEY uq_articles_origin_check (origin_check_id),
    UNIQUE KEY uq_articles_origin_resolution (origin_resolution_request_id),
    KEY idx_articles_canonical_hash (canonical_url_sha256),
    KEY idx_articles_final_hash (final_url_sha256),
    KEY idx_articles_source_published (source_id, original_published_at),
    CONSTRAINT fk_articles_origin_check FOREIGN KEY (origin_check_id)
        REFERENCES duplicate_checks (check_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_articles_origin_resolution FOREIGN KEY (origin_resolution_request_id)
        REFERENCES duplicate_review_resolutions (resolution_request_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_articles_processing_status CHECK (
        processing_status IN (
            'INGESTED', 'QUALITY_EVALUATED', 'QUALITY_REJECTED',
            'ENRICHMENT_PENDING', 'ENRICHED', 'PROCESSING_FAILED'
        )
    ),
    CONSTRAINT chk_articles_review_status CHECK (
        review_status IN (
            'NOT_REQUIRED', 'PENDING', 'IN_REVIEW', 'APPROVED',
            'REJECTED', 'CHANGES_REQUESTED'
        )
    ),
    CONSTRAINT chk_articles_publication_status CHECK (
        publication_status IN ('UNPUBLISHED', 'SCHEDULED', 'PUBLISHED', 'HIDDEN', 'ARCHIVED')
    ),
    CONSTRAINT chk_articles_record_version CHECK (record_version >= 1),
    CONSTRAINT chk_articles_content_version CHECK (content_version >= 1)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS article_fingerprints (
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fingerprint_version VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    content_normalization_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    content_version BIGINT UNSIGNED NOT NULL,
    content_sha256 BINARY(32) NOT NULL,
    minhash_signature VARBINARY(1024) NOT NULL,
    shingle_count INT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (article_id, fingerprint_version),
    KEY idx_fingerprint_hash (fingerprint_version, content_sha256, article_id),
    CONSTRAINT fk_fingerprint_article FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT chk_fingerprint_content_version CHECK (content_version >= 1),
    CONSTRAINT chk_fingerprint_signature_length CHECK (OCTET_LENGTH(minhash_signature) = 1024),
    CONSTRAINT chk_fingerprint_shingle_count CHECK (shingle_count BETWEEN 1 AND 250000)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS article_lsh_buckets (
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    fingerprint_version VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    band_index TINYINT UNSIGNED NOT NULL,
    bucket_hash BINARY(8) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (article_id, fingerprint_version, band_index),
    KEY idx_lsh_lookup (fingerprint_version, band_index, bucket_hash, article_id),
    CONSTRAINT fk_lsh_fingerprint FOREIGN KEY (article_id, fingerprint_version)
        REFERENCES article_fingerprints (article_id, fingerprint_version)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT chk_lsh_band_index CHECK (band_index BETWEEN 0 AND 15)
) ENGINE = InnoDB;

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('001', 'atomic article admission, duplicate review, fingerprint index');
