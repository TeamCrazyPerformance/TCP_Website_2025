from __future__ import annotations

from tech_article_admission.application import ArticleAdmissionService
from tech_article_admission.constants import CONTENT_NORMALIZATION_VERSION
from tech_article_admission.fingerprints import build_fingerprint
from tech_article_admission.persistence import MemoryAdmissionRepository


def test_possible_duplicate_can_be_approved_unique_and_replayed(payload_factory) -> None:
    repository = MemoryAdmissionRepository()
    service = ArticleAdmissionService(repository)
    service.admit(payload_factory(crawl_item_id="review-base", content="ABCDEFGHIJKLM"))
    possible = service.admit(
        payload_factory(crawl_item_id="review-new", content="ABCDEFGHIJKLX")
    )
    review = possible["reviewCase"]
    resolution = {
        "schemaVersion": "1.0",
        "resolutionRequestId": "resolution-001",
        "reviewCaseId": review["reviewCaseId"],
        "expectedCaseVersion": review["caseVersion"],
        "action": "APPROVE_UNIQUE",
        "matchedArticleId": None,
        "administratorId": "admin-001",
        "resolvedAt": "2026-08-03T00:00:00Z",
    }

    completed = service.resolve_review(resolution)
    replayed = service.resolve_review(resolution)

    assert completed["outcome"] == "RESOLUTION_COMPLETED"
    assert completed["resolution"]["finalDecision"] == "UNIQUE"
    assert completed["articleIngested"]["persistence"]["operation"] == "CREATED"
    assert replayed["articleIngested"]["persistence"]["operation"] == "NO_CHANGE"
    assert len(repository.articles) == 2


def test_hard_delete_is_gated_idempotent_and_blocks_old_admission_replay(
    payload_factory,
) -> None:
    repository = MemoryAdmissionRepository()
    disabled = ArticleAdmissionService(repository)
    payload = payload_factory(crawl_item_id="delete-me")
    ingested = disabled.admit(payload)
    article_id = ingested["articleIngested"]["articleId"]
    request = {
        "schemaVersion": "1.0",
        "deletionRequestId": "deletion-001",
        "articleId": article_id,
        "expectedRecordVersion": 1,
        "administratorId": "admin-001",
        "reasonCode": "ADMIN_REQUEST",
    }
    assert disabled.delete_permanently(request)["error"]["code"] == (
        "HARD_DELETE_NOT_ENABLED"
    )

    enabled = ArticleAdmissionService(repository, hard_delete_enabled=True)
    deleted = enabled.delete_permanently(request)
    replayed = enabled.delete_permanently(request)
    old_admission = enabled.admit(payload)

    assert deleted["deletion"]["operation"] == "DELETED"
    assert replayed["deletion"]["operation"] == "NO_CHANGE"
    assert article_id not in repository.articles
    assert article_id not in repository.fingerprints
    assert article_id not in repository.buckets
    assert old_admission["error"]["code"] == "ADMISSION_RESULT_DELETED"


def test_hard_delete_rolls_back_audit_on_delete_failure(payload_factory) -> None:
    repository = MemoryAdmissionRepository()
    service = ArticleAdmissionService(repository, hard_delete_enabled=True)
    ingested = service.admit(payload_factory(crawl_item_id="delete-rollback"))
    article_id = ingested["articleIngested"]["articleId"]
    repository.fail_on.add("delete_article")

    result = service.delete_permanently(
        {
            "schemaVersion": "1.0",
            "deletionRequestId": "deletion-rollback",
            "articleId": article_id,
            "expectedRecordVersion": 1,
            "administratorId": "admin-001",
            "reasonCode": "ADMIN_REQUEST",
        }
    )

    assert result["outcome"] == "ARTICLE_DELETION_FAILED"
    assert article_id in repository.articles
    assert repository.deletion_audits == {}


def test_backfill_rebuilds_missing_current_fingerprint(payload_factory) -> None:
    repository = MemoryAdmissionRepository()
    service = ArticleAdmissionService(repository)
    ingested = service.admit(payload_factory(crawl_item_id="backfill-me"))
    article_id = ingested["articleIngested"]["articleId"]
    del repository.fingerprints[article_id]
    del repository.buckets[article_id]

    report = service.backfill_missing_fingerprints(batch_size=10)

    assert report == {"created": 1, "noChange": 0, "stale": 0}
    assert article_id in repository.fingerprints
    assert len(repository.buckets[article_id]) == 16


def test_new_possible_candidate_makes_review_stale(payload_factory) -> None:
    repository = MemoryAdmissionRepository()
    service = ArticleAdmissionService(repository)
    service.admit(payload_factory(crawl_item_id="stale-base", content="ABCDEFGHIJKLM"))
    unrelated = service.admit(
        payload_factory(crawl_item_id="stale-third", content="nopqrstuvwxyz")
    )
    third_id = unrelated["articleIngested"]["articleId"]
    possible = service.admit(
        payload_factory(crawl_item_id="stale-new", content="ABCDEFGHIJKLX")
    )

    changed = build_fingerprint("ABCDEFGHIJKLY")
    repository.articles[third_id]["content"] = "ABCDEFGHIJKLY"
    repository.articles[third_id]["content_version"] = 2
    repository.fingerprints[third_id].update(
        {
            "content_normalization_version": CONTENT_NORMALIZATION_VERSION,
            "content_version": 2,
            "content_sha256": changed.content_sha256,
            "minhash_signature": changed.signature,
            "shingle_count": changed.shingle_count,
        }
    )
    repository.buckets[third_id] = changed.buckets

    review = possible["reviewCase"]
    result = service.resolve_review(
        {
            "schemaVersion": "1.0",
            "resolutionRequestId": "resolution-stale",
            "reviewCaseId": review["reviewCaseId"],
            "expectedCaseVersion": 1,
            "action": "APPROVE_UNIQUE",
            "matchedArticleId": None,
            "administratorId": "admin-001",
            "resolvedAt": "2026-08-03T00:00:00Z",
        }
    )

    assert result["outcome"] == "RESOLUTION_FAILED"
    assert result["error"]["code"] == "REVIEW_STALE"
    assert result["reviewCase"]["caseVersion"] == 2
