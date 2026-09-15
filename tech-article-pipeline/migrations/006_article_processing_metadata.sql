SET @processing_result_migration = (
    SELECT IF(
        COUNT(*) = 0,
        CONCAT(
            'ALTER TABLE article_processing_results ',
            'ADD COLUMN completed_at DATETIME(6) NULL AFTER error, ',
            'ADD KEY idx_processing_result_completion ',
            '(stage, status, completed_at, article_id)'
        ),
        'DO 0'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'article_processing_results'
      AND COLUMN_NAME = 'completed_at'
);
PREPARE processing_result_statement FROM @processing_result_migration;
EXECUTE processing_result_statement;
DEALLOCATE PREPARE processing_result_statement;

SET @article_metadata_migration = (
    SELECT IF(
        COUNT(*) = 0,
        CONCAT(
            'ALTER TABLE articles ',
            'ADD COLUMN crawler_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ',
            'ADD COLUMN crawled_at DATETIME(6) NULL, ',
            'ADD COLUMN quality_evaluator_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ',
            'ADD COLUMN quality_policy_version VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL, ',
            'ADD COLUMN quality_evaluated_at DATETIME(6) NULL, ',
            'ADD COLUMN summarizer_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ',
            'ADD COLUMN summary_model VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL, ',
            'ADD COLUMN summary_prompt_version VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL, ',
            'ADD COLUMN summarized_at DATETIME(6) NULL'
        ),
        'DO 0'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'crawler_version'
);
PREPARE article_metadata_statement FROM @article_metadata_migration;
EXECUTE article_metadata_statement;
DEALLOCATE PREPARE article_metadata_statement;

SET @article_quality_evaluation_migration = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE articles ADD COLUMN quality_evaluation JSON NULL AFTER quality_decision',
        'DO 0'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'quality_evaluation'
);
PREPARE article_quality_evaluation_statement FROM @article_quality_evaluation_migration;
EXECUTE article_quality_evaluation_statement;
DEALLOCATE PREPARE article_quality_evaluation_statement;

SET @quality_recalculation_status_migration = (
    SELECT IF(
        COUNT(*) = 0,
        CONCAT(
            'ALTER TABLE articles ',
            'ADD COLUMN quality_recalculation_status VARCHAR(32) ',
            'CHARACTER SET ascii COLLATE ascii_bin NULL AFTER quality_evaluated_at, ',
            'ADD KEY idx_article_quality_recalculation_status ',
            '(quality_recalculation_status, updated_at), ',
            'ADD CONSTRAINT chk_article_quality_recalculation_status CHECK ',
            '(quality_recalculation_status IN (''PASS'', ''ATTENTION_REQUIRED''))'
        ),
        'DO 0'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'articles'
      AND COLUMN_NAME = 'quality_recalculation_status'
);
PREPARE quality_recalculation_status_statement FROM @quality_recalculation_status_migration;
EXECUTE quality_recalculation_status_statement;
DEALLOCATE PREPARE quality_recalculation_status_statement;

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('006', 'article processing completion and applied version metadata');
