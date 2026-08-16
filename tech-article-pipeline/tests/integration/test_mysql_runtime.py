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


@pytest.fixture(scope="module")
def mysql_pool():
    if os.getenv("PIPELINE_TEST_MYSQL") != "1":
        pytest.skip("set PIPELINE_TEST_MYSQL=1 for the disposable MySQL 8.4 suite")
    apply_migrations()
    settings = MySQLSettings.from_env()
    return MySQLConnectionPool(settings)


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
        ]
    finally:
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
