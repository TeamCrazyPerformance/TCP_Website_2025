from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from tech_article_admission.application import ArticleAdmissionService
from tech_article_admission.config import MySQLSettings
from tech_article_admission.persistence import MySQLAdmissionRepository, MySQLConnectionPool
from tech_article_pipeline.persistence.migrate import apply_migrations
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository

pytestmark = pytest.mark.mysql_integration


def _insert_migration_004_probe(pool):
    suffix = uuid4().hex
    updated_at = datetime(2026, 8, 20, 1, 2, 3, 456789)
    rows = [
        (
            f"migration-auto-{suffix}",
            f"auto-crawl:v1:20260820T0000KST:{suffix}",
            f"migration-auto-source-{suffix}",
        ),
        (
            f"migration-manual-{suffix}",
            f"tech-article-crawl-{suffix}",
            f"migration-manual-source-{suffix}",
        ),
    ]
    connection = pool.get_connection()
    try:
        cursor = connection.cursor()
        for crawl_run_id, idempotency_key, source_id in rows:
            cursor.execute(
                "INSERT INTO crawl_runs "
                "(crawl_run_id, idempotency_key, body_digest, source_id, status, "
                "request_payload, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, 'COMPLETED', '{}', %s, %s)",
                (
                    crawl_run_id,
                    idempotency_key,
                    bytes.fromhex("05" * 32),
                    source_id,
                    updated_at - timedelta(minutes=1),
                    updated_at,
                ),
            )
        connection.commit()
    finally:
        connection.close()
    return {"rows": rows, "updated_at": updated_at}


@pytest.fixture(scope="module")
def mysql_pool():
    if os.getenv("PIPELINE_TEST_MYSQL") != "1":
        pytest.skip("set PIPELINE_TEST_MYSQL=1 for the disposable MySQL 8.4 suite")
    apply_migrations(through_version="003")
    settings = MySQLSettings.from_env()
    pool = MySQLConnectionPool(settings)
    connection = pool.get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT version FROM pipeline_migration_history WHERE version = '004'")
        already_applied = cursor.fetchone() is not None
    finally:
        connection.close()
    probe = None if already_applied else _insert_migration_004_probe(pool)
    apply_migrations()
    pool.migration_004_probe = probe
    return pool


def admission_payload(item_id: str, content: str, canonical_url: str):
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return {
        "schemaVersion": "1.0",
        "crawlRunId": f"integration-{uuid4().hex}",
        "crawlItemId": item_id,
        "source": {"sourceId": "integration", "sourceType": "TEST"},
        "discovery": {},
        "urls": {
            "discoveredUrl": canonical_url,
            "finalUrl": canonical_url,
            "canonicalUrl": canonical_url,
        },
        "article": {
            "title": "MySQL 8.4 integration article",
            "authors": ["TCP"],
            "originalPublishedAt": now,
            "content": content,
            "language": "en",
        },
        "normalization": {
            "status": "SUCCESS",
            "normalizedAt": now,
            "normalizerVersion": "integration-v1",
            "warnings": [],
            "error": None,
        },
        "duplicatePolicy": {
            "policyVersion": "duplicate-policy-v1",
            "checkCanonicalUrl": True,
            "checkContentHash": True,
            "checkTitleSimilarity": True,
            "duplicateTitleThreshold": 0.92,
            "possibleDuplicateThreshold": 0.80,
            "maximumCandidateCount": 100,
        },
    }


def test_migrations_are_idempotent_and_checksummed(mysql_pool):
    apply_migrations()
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT version, CHAR_LENGTH(checksum_sha256) AS checksum_length "
            "FROM pipeline_migration_history ORDER BY version"
        )
        rows = cursor.fetchall()
        assert [(row["version"], row["checksum_length"]) for row in rows] == [
            ("001", 64),
            ("002", 64),
            ("003", 64),
            ("004", 64),
            ("005", 64),
        ]
    finally:
        connection.close()


def test_migration_004_backfills_provenance_without_changing_history_time(mysql_pool):
    probe = mysql_pool.migration_004_probe
    if probe is None:
        pytest.skip("migration 004 was already applied before this test session")
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT crawl_run_id, trigger_type, completed_at, updated_at "
            "FROM crawl_runs WHERE crawl_run_id IN (%s, %s) ORDER BY crawl_run_id",
            tuple(row[0] for row in probe["rows"]),
        )
        actual = {row["crawl_run_id"]: row for row in cursor.fetchall()}
    finally:
        connection.close()

    auto_id, _, _ = probe["rows"][0]
    manual_id, _, _ = probe["rows"][1]
    assert actual[auto_id]["trigger_type"] == "SCHEDULED"
    assert actual[manual_id]["trigger_type"] == "MANUAL"
    for row in actual.values():
        assert row["completed_at"] == probe["updated_at"]
        assert row["updated_at"] == probe["updated_at"]


def test_crawl_history_count_uses_the_same_job_backed_population_as_the_list(mysql_pool):
    repository = MySQLPipelineRepository(mysql_pool)
    suffix = uuid4().hex
    crawl_run_id = f"orphan-crawl-{suffix}"
    source_id = f"orphan-source-{suffix}"
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO crawl_runs "
            "(crawl_run_id, idempotency_key, body_digest, source_id, trigger_type, status, "
            "request_payload) VALUES (%s, %s, %s, %s, 'MANUAL', 'COMPLETED', '{}')",
            (
                crawl_run_id,
                f"orphan-key-{suffix}",
                bytes.fromhex("06" * 32),
                source_id,
            ),
        )
        connection.commit()
        assert repository.list_crawl_runs(limit=20, source_id=source_id) == []
        assert repository.count_crawl_runs(source_id=source_id) == 0
    finally:
        cleanup_cursor = connection.cursor()
        cleanup_cursor.execute("DELETE FROM crawl_runs WHERE crawl_run_id = %s", (crawl_run_id,))
        connection.commit()
        cleanup_cursor.close()
        connection.close()


def test_concurrent_identical_content_has_one_atomic_unique(mysql_pool):
    service = ArticleAdmissionService(MySQLAdmissionRepository(mysql_pool))
    suffix = uuid4().hex
    content = f"Atomic concurrent content {suffix} " + ("technical detail " * 20)
    payloads = [
        admission_payload(
            f"integration-item-{suffix}-{index}",
            content,
            f"https://integration.example/{suffix}/{index}",
        )
        for index in range(2)
    ]
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(service.admit, payloads))
    assert sorted(result["outcome"] for result in results) == [
        "ARTICLE_INGESTED",
        "DUPLICATE_CHECK_COMPLETED",
    ]


def test_queue_expired_lease_is_reclaimed(mysql_pool):
    repository = MySQLPipelineRepository(mysql_pool)
    suffix = uuid4().hex
    payload = admission_payload(
        f"queue-item-{suffix}",
        f"queue lease content {suffix}",
        f"https://integration.example/queue/{suffix}",
    )
    response, _ = repository.submit(
        idempotency_key=f"integration-key-{suffix}",
        body_digest=bytes.fromhex("01" * 32),
        payload=payload,
        max_attempts=3,
    )
    first = repository.claim_job(lease_seconds=5)
    assert first is not None
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE pipeline_jobs SET lease_expires_at = %s WHERE job_id = %s",
            ((datetime.now(UTC) - timedelta(seconds=1)).replace(tzinfo=None), first.job_id),
        )
        connection.commit()
    finally:
        connection.close()
    recovered = repository.claim_job(lease_seconds=5)
    assert recovered is not None
    assert recovered.job_id == response["jobId"]
    assert recovered.attempt_count == 2


def test_crawl_queue_lease_and_atomic_submission_link(mysql_pool):
    repository = MySQLPipelineRepository(mysql_pool)
    suffix = uuid4().hex
    command = {
        "schemaVersion": "1.0",
        "source": {"sourceId": "sdtimes", "sourceType": "RSS", "sectionKey": "NEWS"},
        "crawlOptions": {
            "maximumArticleCount": 1,
            "maximumAgeHours": 720,
            "followPagination": False,
            "maximumPageCount": 1,
            "requestTimeoutMs": 15000,
        },
        "duplicatePolicy": admission_payload("placeholder", "content", "https://x.example")[
            "duplicatePolicy"
        ],
        "qualityPolicy": {
            "policyVersion": "quality-policy-v1",
            "minimumEvaluationScore": 70,
            "reviewLowerBound": 45,
            "minimumContentLength": 200,
            "maximumContentLength": 2000000,
            "allowedLanguages": ["ko", "en"],
            "rejectSpam": True,
            "rejectAdvertisements": True,
            "requireAdminReview": False,
        },
        "generationOptions": {
            "outputLanguage": "ko",
            "maximumSummaryLength": 500,
            "maximumOneLineSummaryLength": 100,
            "maximumTagCount": 3,
            "translateTitle": True,
            "translateContent": False,
        },
    }
    response, created = repository.submit_crawl(
        idempotency_key=f"crawl-integration-{suffix}",
        body_digest=bytes.fromhex("02" * 32),
        payload=command,
        max_attempts=3,
    )
    assert created is True
    job = repository.claim_crawl_job(lease_seconds=5)
    assert job is not None
    assert job.crawl_run_id == response["crawlRunId"]
    candidate = admission_payload(
        f"crawl-linked-{suffix}",
        f"crawl linked content {suffix} " + ("technical detail " * 20),
        f"https://integration.example/crawl/{suffix}",
    )
    candidate["crawlRunId"] = job.crawl_run_id
    item_id = candidate["crawlItemId"]
    repository.complete_crawl_job(
        job,
        {
            "completion": {
                "crawlRunId": job.crawl_run_id,
                "status": "COMPLETED",
                "statistics": {"articlesSucceeded": 1, "articlesFailed": 0},
            },
            "crawlItems": [
                {
                    "crawlRunId": job.crawl_run_id,
                    "crawlItemId": item_id,
                    "crawl": {"status": "SUCCESS"},
                }
            ],
            "normalizedArticles": [candidate],
            "normalizationFailures": [],
        },
        max_attempts=3,
    )
    run = repository.get_crawl_run(job.crawl_run_id)
    assert run is not None
    assert run["status"] == "COMPLETED"
    assert run["items"][0]["submissionId"].startswith("submission-")


def test_crawl_history_uses_stored_trigger_and_redacts_raw_failure(mysql_pool):
    repository = MySQLPipelineRepository(mysql_pool)
    suffix = uuid4().hex
    source_id = f"integration-{suffix}"
    command = {
        "source": {
            "sourceId": source_id,
            "sourceType": "WEB_CRAWL",
            "sectionKey": "NEWS",
        }
    }
    response, created = repository.submit_crawl(
        idempotency_key=f"scheduled-without-prefix-{suffix}",
        body_digest=bytes.fromhex("03" * 32),
        payload=command,
        max_attempts=1,
        trigger="SCHEDULED",
    )
    assert created is True
    job = repository.claim_crawl_job(lease_seconds=5)
    assert job is not None
    assert job.crawl_run_id == response["crawlRunId"]
    repository.fail_crawl_job(
        job,
        {
            "code": "SOURCE_CRAWL_FAILED",
            "message": "source failed",
            "retryable": False,
            "details": {
                "completion": {"statistics": {"articlesSucceeded": 0, "articlesFailed": 1}},
                "crawlItems": [
                    {
                        "crawlRunId": job.crawl_run_id,
                        "crawlItemId": f"failed-{suffix}",
                        "crawl": {"status": "FAILED"},
                        "rawArticle": {
                            "contentHtml": "<article>must-not-leak</article>",
                            "contentText": "must-not-leak",
                        },
                    }
                ],
            },
        },
        retryable=False,
        available_at=datetime.now(UTC),
    )

    history = repository.list_crawl_runs(
        limit=20,
        source_id=source_id,
        trigger="SCHEDULED",
    )
    detail = repository.get_crawl_run(job.crawl_run_id)

    assert len(history) == 1
    assert history[0]["trigger"] == "SCHEDULED"
    assert history[0]["statistics"] == {"articlesSucceeded": 0, "articlesFailed": 1}
    assert "must-not-leak" not in str(history)
    assert detail is not None
    assert detail["items"][0]["crawlStatus"] == "FAILED"
    assert "must-not-leak" not in str(detail)


def test_terminal_crawl_lease_expiry_records_completion(mysql_pool):
    repository = MySQLPipelineRepository(mysql_pool)
    suffix = uuid4().hex
    response, created = repository.submit_crawl(
        idempotency_key=f"expired-crawl-{suffix}",
        body_digest=bytes.fromhex("04" * 32),
        payload={
            "source": {
                "sourceId": f"expired-{suffix}",
                "sourceType": "WEB_CRAWL",
                "sectionKey": "NEWS",
            }
        },
        max_attempts=1,
        trigger="MANUAL",
    )
    assert created is True
    job = repository.claim_crawl_job(lease_seconds=5)
    assert job is not None
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE crawl_jobs SET lease_expires_at = %s WHERE job_id = %s",
            ((datetime.now(UTC) - timedelta(seconds=1)).replace(tzinfo=None), job.job_id),
        )
        connection.commit()
    finally:
        connection.close()

    assert repository.claim_crawl_job(lease_seconds=5) is None
    run = repository.get_crawl_run(response["crawlRunId"])

    assert run is not None
    assert run["status"] == "FAILED"
    assert run["completedAt"] is not None
    assert run["error"]["retryable"] is False
    assert run["job"]["status"] == "DEAD"
    assert run["job"]["error"]["retryable"] is False


def test_admission_rolls_back_if_bucket_write_fails(mysql_pool):
    class FailingRepository(MySQLAdmissionRepository):
        def insert_buckets(self, *args, **kwargs):
            raise RuntimeError("forced bucket failure")

    suffix = uuid4().hex
    item_id = f"rollback-item-{suffix}"
    service = ArticleAdmissionService(FailingRepository(mysql_pool))
    result = service.admit(
        admission_payload(
            item_id,
            f"rollback content {suffix} " + ("technical detail " * 20),
            f"https://integration.example/rollback/{suffix}",
        )
    )
    assert result["outcome"] == "ADMISSION_FAILED"
    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM articles WHERE crawl_item_id = %s", (item_id,))
        assert cursor.fetchone()[0] == 0
    finally:
        connection.close()


def _view_counts(repository, article_id):
    """조회 투영에서 조회수를 꺼냅니다 — get_article 도 목록과 같은 질의를 쓰므로
    article_view_counts 를 LEFT JOIN 한 결과가 그대로 드러납니다."""
    article = repository.get_article(article_id)
    assert article is not None
    return article["viewCounts"]


def _ingest_article(mysql_pool, label: str):
    service = ArticleAdmissionService(MySQLAdmissionRepository(mysql_pool))
    suffix = uuid4().hex
    result = service.admit(
        admission_payload(
            f"{label}-item-{suffix}",
            f"{label} content {suffix} " + ("technical detail " * 20),
            f"https://integration.example/{label}/{suffix}",
        )
    )
    assert result["outcome"] == "ARTICLE_INGESTED"
    return result["articleIngested"]["articleId"]


def test_article_view_counts_increment_separately_and_project_as_zero(mysql_pool):
    """조회수 경로를 실제 MySQL 에서 확인합니다.

    단위 테스트는 메모리 저장소와 SQL 문자열만 봅니다. INSERT ... SELECT ...
    ON DUPLICATE KEY UPDATE 가 실제로 도는지, 행이 없는 아티클이 목록에서 0 으로
    투영되는지는 여기서만 드러납니다.
    """
    repository = MySQLPipelineRepository(mysql_pool)
    article_id = _ingest_article(mysql_pool, "view")

    # 아무도 보지 않은 아티클에는 행이 없습니다. LEFT JOIN 이라 0 이어야 합니다.
    assert _view_counts(repository, article_id) == {
        "member": 0,
        "guest": 0,
        "lastViewedAt": None,
    }

    repository.record_article_view(article_id, member=True)
    repository.record_article_view(article_id, member=True)
    repository.record_article_view(article_id, member=False)

    counts = _view_counts(repository, article_id)
    assert counts["member"] == 2
    assert counts["guest"] == 1
    assert counts["lastViewedAt"] is not None


def test_unknown_article_view_is_ignored_without_error(mysql_pool):
    """조회수 경로는 인증 없이도 닿습니다. 없는 id 가 예외를 던지면 요청마다
    스택 트레이스가 쌓여 누구나 로그를 부풀릴 수 있게 됩니다."""
    repository = MySQLPipelineRepository(mysql_pool)
    repository.record_article_view(f"no-such-article-{uuid4().hex}", member=True)

    connection = mysql_pool.get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM article_view_counts WHERE article_id LIKE 'no-such-article-%'"
        )
        assert cursor.fetchone()[0] == 0
    finally:
        connection.close()


def test_concurrent_views_do_not_lose_increments(mysql_pool):
    """단일 upsert 라 read-modify-write 손실이 없어야 합니다. 같은 아티클에
    동시에 몰리면 행 잠금으로 직렬화되지만 값은 하나도 빠지지 않습니다."""
    repository = MySQLPipelineRepository(mysql_pool)
    article_id = _ingest_article(mysql_pool, "concurrent-view")

    def bump(index: int) -> None:
        repository.record_article_view(article_id, member=index % 2 == 0)

    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(bump, range(20)))

    counts = _view_counts(repository, article_id)
    assert counts["member"] == 10
    assert counts["guest"] == 10
