CREATE TABLE IF NOT EXISTS crawl_runs (
    crawl_run_id varchar(128) PRIMARY KEY,
    source_id varchar(64) NOT NULL,
    requested_at timestamptz NOT NULL,
    started_at timestamptz NOT NULL,
    completed_at timestamptz NULL,
    status varchar(32) NOT NULL,
    crawler_version varchar(64) NOT NULL,
    request_payload jsonb NOT NULL,
    official_completed_payload jsonb NULL,
    official_statistics jsonb NULL,
    internal_statistics jsonb NOT NULL DEFAULT '{}'::jsonb,
    error jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_crawl_runs_status CHECK (
        status IN ('RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED')
    ),
    CONSTRAINT ck_crawl_runs_terminal_time CHECK (
        (status = 'RUNNING' AND completed_at IS NULL AND official_completed_payload IS NULL)
        OR
        (status <> 'RUNNING' AND completed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crawl_runs_source_running
    ON crawl_runs (source_id)
    WHERE status = 'RUNNING';

CREATE TABLE IF NOT EXISTS crawl_items (
    crawl_item_id varchar(160) PRIMARY KEY,
    crawl_run_id varchar(128) NOT NULL,
    source_id varchar(64) NOT NULL,
    source_guid text NULL,
    rss_item_index integer NOT NULL,
    source_payload_hash char(64) NULL,
    collection_state varchar(32) NOT NULL,
    processing_status varchar(48) NOT NULL,
    discovered_url text NULL,
    final_url text NULL,
    canonical_url text NULL,
    http_status_code integer NULL,
    rss_payload jsonb NOT NULL,
    official_crawl_output_payload jsonb NULL,
    crawl_error jsonb NULL,
    crawled_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_crawl_items_run FOREIGN KEY (crawl_run_id)
        REFERENCES crawl_runs(crawl_run_id) ON DELETE RESTRICT,
    CONSTRAINT uq_crawl_items_run_index UNIQUE (crawl_run_id, rss_item_index),
    CONSTRAINT ck_crawl_items_index CHECK (rss_item_index >= 0),
    CONSTRAINT ck_crawl_items_http_status CHECK (
        http_status_code IS NULL OR http_status_code BETWEEN 100 AND 599
    ),
    CONSTRAINT ck_crawl_items_hash CHECK (
        source_payload_hash IS NULL OR source_payload_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_crawl_items_collection_state CHECK (
        collection_state IN (
            'NEW', 'UNCHANGED', 'CHANGED', 'INVALID',
            'EXCLUDED_BY_AGE', 'EXCLUDED_BY_LIMIT'
        )
    ),
    CONSTRAINT ck_crawl_items_processing_status CHECK (
        processing_status IN (
            'DISCOVERED', 'SKIPPED', 'CRAWL_SUCCESS', 'CRAWL_FAILED',
            'CRAWL_OUTPUT_INVALID', 'NORMALIZATION_SUCCESS', 'NORMALIZATION_FAILED'
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crawl_items_run_guid
    ON crawl_items (crawl_run_id, source_id, source_guid)
    WHERE source_guid IS NOT NULL;

CREATE TABLE IF NOT EXISTS crawl_item_normalization_results (
    normalization_result_id varchar(160) PRIMARY KEY,
    crawl_item_id varchar(160) NOT NULL,
    attempt integer NOT NULL DEFAULT 1,
    status varchar(16) NOT NULL,
    failure_stage varchar(64) NULL,
    normalizer_version varchar(64) NOT NULL,
    normalized_payload jsonb NULL,
    normalized_payload_hash char(64) NULL,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    error jsonb NULL,
    normalized_at timestamptz NULL,
    duplicate_delivery_status varchar(24) NOT NULL DEFAULT 'NOT_ATTEMPTED',
    duplicate_delivery_attempted_at timestamptz NULL,
    duplicate_delivery_error jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_normalization_results_item FOREIGN KEY (crawl_item_id)
        REFERENCES crawl_items(crawl_item_id) ON DELETE RESTRICT,
    CONSTRAINT uq_normalization_results_item_attempt UNIQUE (crawl_item_id, attempt),
    CONSTRAINT ck_normalization_results_attempt CHECK (attempt = 1),
    CONSTRAINT ck_normalization_results_status CHECK (status IN ('SUCCESS', 'FAILED')),
    CONSTRAINT ck_normalization_results_delivery CHECK (
        duplicate_delivery_status IN ('NOT_ATTEMPTED', 'DELIVERED', 'FAILED')
    ),
    CONSTRAINT ck_normalization_results_hash CHECK (
        normalized_payload_hash IS NULL OR normalized_payload_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_normalization_results_payload CHECK (
        (
            status = 'SUCCESS'
            AND failure_stage IS NULL
            AND normalized_payload IS NOT NULL
            AND normalized_payload_hash IS NOT NULL
            AND error IS NULL
            AND normalized_at IS NOT NULL
        )
        OR
        (
            status = 'FAILED'
            AND failure_stage IS NOT NULL
            AND normalized_payload IS NULL
            AND normalized_payload_hash IS NULL
            AND error IS NOT NULL
            AND duplicate_delivery_status = 'NOT_ATTEMPTED'
        )
    )
);

CREATE TABLE IF NOT EXISTS cloudflare_source_states (
    source_id varchar(64) NOT NULL,
    source_guid text NOT NULL,
    last_observed_payload_hash char(64) NULL,
    last_observed_at timestamptz NULL,
    last_successfully_normalized_payload_hash char(64) NULL,
    last_successful_crawl_item_id varchar(160) NULL,
    last_successful_normalization_result_id varchar(160) NULL,
    last_successfully_normalized_at timestamptz NULL,
    state_version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, source_guid),
    CONSTRAINT fk_source_states_item FOREIGN KEY (last_successful_crawl_item_id)
        REFERENCES crawl_items(crawl_item_id) ON DELETE RESTRICT,
    CONSTRAINT fk_source_states_normalization FOREIGN KEY (
        last_successful_normalization_result_id
    ) REFERENCES crawl_item_normalization_results(normalization_result_id) ON DELETE RESTRICT,
    CONSTRAINT ck_source_states_observed_hash CHECK (
        last_observed_payload_hash IS NULL OR last_observed_payload_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_source_states_success_hash CHECK (
        last_successfully_normalized_payload_hash IS NULL
        OR last_successfully_normalized_payload_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_source_states_success_tuple CHECK (
        (
            last_successfully_normalized_payload_hash IS NULL
            AND last_successful_crawl_item_id IS NULL
            AND last_successful_normalization_result_id IS NULL
            AND last_successfully_normalized_at IS NULL
        )
        OR
        (
            last_successfully_normalized_payload_hash IS NOT NULL
            AND last_successful_crawl_item_id IS NOT NULL
            AND last_successful_normalization_result_id IS NOT NULL
            AND last_successfully_normalized_at IS NOT NULL
        )
    )
);

