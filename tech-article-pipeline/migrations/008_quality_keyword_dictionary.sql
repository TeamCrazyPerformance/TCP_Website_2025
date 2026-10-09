CREATE TABLE IF NOT EXISTS quality_keyword_dictionary_versions (
    version_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status ENUM('ACTIVE', 'ARCHIVED') NOT NULL,
    source VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    keyword_count INT UNSIGNED NOT NULL,
    checksum_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    activated_at DATETIME(6) NULL,
    PRIMARY KEY (version_id),
    KEY idx_keyword_dictionary_active (status, activated_at),
    CONSTRAINT chk_keyword_dictionary_count CHECK (keyword_count > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quality_keyword_dictionary_items (
    version_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    keyword VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    source VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    PRIMARY KEY (version_id, keyword),
    CONSTRAINT fk_keyword_dictionary_items_version FOREIGN KEY (version_id)
        REFERENCES quality_keyword_dictionary_versions(version_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quality_keyword_update_history (
    update_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status ENUM('SUCCESS', 'FAILED') NOT NULL,
    source VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    version_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    added_count INT UNSIGNED NULL,
    removed_count INT UNSIGNED NULL,
    error_message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL,
    completed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (update_id),
    KEY idx_keyword_update_history_completed (completed_at),
    CONSTRAINT fk_keyword_update_history_version FOREIGN KEY (version_id)
        REFERENCES quality_keyword_dictionary_versions(version_id) ON DELETE SET NULL
) ENGINE=InnoDB;
