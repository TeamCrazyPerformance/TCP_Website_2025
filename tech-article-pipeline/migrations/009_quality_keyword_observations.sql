CREATE TABLE IF NOT EXISTS quality_keyword_observations (
    keyword VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    source VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    first_collected_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_collected_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (keyword),
    KEY idx_keyword_observations_recent (last_collected_at DESC, first_collected_at DESC)
) ENGINE=InnoDB;
