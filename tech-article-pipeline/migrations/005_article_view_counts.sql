-- 아티클 조회수. 운영 판단용 집계이며 사용자별 이력은 남기지 않습니다.
--
-- articles 테이블에 컬럼으로 붙이지 않는 이유:
--   articles.updated_at 은 ON UPDATE CURRENT_TIMESTAMP 라 행을 건드릴 때마다
--   갱신됩니다. 조회 때마다 UPDATE 하면 관리자 화면의 단계별 최장 체류
--   시간(stageOldest)이 전부 "방금"이 되고, record_version 을 올리면
--   apply_publication_action 의 낙관적 잠금이 매번 충돌합니다.
--
-- 회원과 비회원을 나누는 이유:
--   공개 상세는 인증이 걸려 있어 비회원은 401 로 막힙니다. 그 시도까지 세면
--   인증을 통과하지 못한 봇 요청도 함께 잡히므로, 합계만 두면 운영자가
--   봇 유입을 구분할 수 없습니다.

CREATE TABLE IF NOT EXISTS article_view_counts (
    article_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    member_views BIGINT UNSIGNED NOT NULL DEFAULT 0,
    guest_attempts BIGINT UNSIGNED NOT NULL DEFAULT 0,
    last_viewed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (article_id),
    KEY idx_article_view_member (member_views),
    CONSTRAINT fk_article_view_article FOREIGN KEY (article_id)
        REFERENCES articles (article_id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE = InnoDB;

INSERT IGNORE INTO tech_article_schema_migrations (version, description)
VALUES ('005', 'per-article view counts for operations');
