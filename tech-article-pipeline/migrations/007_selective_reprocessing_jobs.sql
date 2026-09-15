SET @reprocessing_job_migration = (
    SELECT IF(
        COUNT(*) = 0,
        CONCAT(
            'ALTER TABLE pipeline_jobs ',
            'ADD COLUMN purpose VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin ',
            'NOT NULL DEFAULT ''PIPELINE'' AFTER stage, ',
            'ADD COLUMN requested_by VARCHAR(128) CHARACTER SET utf8mb4 ',
            'COLLATE utf8mb4_0900_ai_ci NULL AFTER purpose, ',
            'ADD COLUMN target_versions JSON NULL AFTER requested_by, ',
            'ADD KEY idx_pipeline_job_purpose (purpose, status, created_at), ',
            'ADD CONSTRAINT chk_pipeline_job_purpose CHECK ',
            '(purpose IN (''PIPELINE'', ''SUMMARY_REGENERATION'', ''QUALITY_RECALCULATION''))'
        ),
        'DO 0'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pipeline_jobs'
      AND COLUMN_NAME = 'purpose'
);
PREPARE reprocessing_job_statement FROM @reprocessing_job_migration;
EXECUTE reprocessing_job_statement;
DEALLOCATE PREPARE reprocessing_job_statement;

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('007', 'safe selective quality and summary reprocessing jobs');
