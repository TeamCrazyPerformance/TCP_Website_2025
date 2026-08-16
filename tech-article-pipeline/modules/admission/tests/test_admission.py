from __future__ import annotations

import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from tech_article_admission.application import ArticleAdmissionService
from tech_article_admission.contracts import ContractValidator
from tech_article_admission.digests import sha256_digest
from tech_article_admission.domain import CandidateBatch, PreparedAdmission, evaluate_candidates
from tech_article_admission.errors import ResourceLimitExceeded
from tech_article_admission.fingerprints import build_fingerprint
from tech_article_admission.persistence import MemoryAdmissionRepository


def _service() -> tuple[ArticleAdmissionService, MemoryAdmissionRepository]:
    repository = MemoryAdmissionRepository()
    return ArticleAdmissionService(repository), repository


def test_unique_is_stored_atomically_and_replayed(payload_factory) -> None:
    service, repository = _service()
    payload = payload_factory()

    created = service.admit(payload)
    replayed = service.admit(copy.deepcopy(payload))

    assert created["outcome"] == "ARTICLE_INGESTED"
    assert created["articleIngested"]["persistence"]["operation"] == "CREATED"
    assert replayed["outcome"] == "ARTICLE_INGESTED"
    assert replayed["articleIngested"]["persistence"]["operation"] == "NO_CHANGE"
    article_id = created["articleIngested"]["articleId"]
    assert article_id in repository.articles
    assert article_id in repository.fingerprints
    assert len(repository.buckets[article_id]) == 16
    assert len(repository.checks) == 1


def test_hash_duplicate_and_disabled_hash_flag(payload_factory) -> None:
    service, repository = _service()
    original = payload_factory(crawl_item_id="item-1")
    same = payload_factory(crawl_item_id="item-2")

    assert service.admit(original)["outcome"] == "ARTICLE_INGESTED"
    duplicate = service.admit(same)

    assert duplicate["outcome"] == "DUPLICATE_CHECK_COMPLETED"
    check = duplicate["duplicateCheckCompleted"]["duplicateCheck"]
    assert check["decision"] == "DUPLICATE"
    assert "CONTENT_HASH" in check["matchedBy"]
    assert len(repository.articles) == 1

    service_without_hash, _ = _service()
    first = payload_factory(crawl_item_id="item-3", check_hash=False)
    second = payload_factory(crawl_item_id="item-4", check_hash=False)
    assert service_without_hash.admit(first)["outcome"] == "ARTICLE_INGESTED"
    by_jaccard = service_without_hash.admit(second)
    assert by_jaccard["duplicateCheckCompleted"]["duplicateCheck"]["decision"] == (
        "DUPLICATE"
    )
    assert "CONTENT_HASH" not in by_jaccard["duplicateCheckCompleted"]["duplicateCheck"][
        "matchedBy"
    ]


def test_exact_jaccard_080_and_092_decisions(payload_factory) -> None:
    possible_service, _ = _service()
    assert possible_service.admit(
        payload_factory(crawl_item_id="possible-base", content="ABCDEFGHIJKLM")
    )["outcome"] == "ARTICLE_INGESTED"
    possible = possible_service.admit(
        payload_factory(crawl_item_id="possible-new", content="ABCDEFGHIJKLX")
    )
    check = possible["duplicateCheckCompleted"]["duplicateCheck"]
    assert possible["outcome"] == "DUPLICATE_REVIEW_REQUESTED"
    assert check["decision"] == "POSSIBLE_DUPLICATE"
    assert check["candidates"][0]["intersectionCount"] == 8
    assert check["candidates"][0]["unionCount"] == 10
    assert "CONTENT_JACCARD" not in check["candidates"][0]["matchedBy"]

    duplicate_service, _ = _service()
    assert duplicate_service.admit(
        payload_factory(
            crawl_item_id="duplicate-base",
            content="ABCDEFGHIJKLMNOPQRSTUVWXYZ12",
        )
    )["outcome"] == "ARTICLE_INGESTED"
    duplicate = duplicate_service.admit(
        payload_factory(
            crawl_item_id="duplicate-new",
            content="ABCDEFGHIJKLMNOPQRSTUVWXYZ1X",
        )
    )
    candidate = duplicate["duplicateCheckCompleted"]["duplicateCheck"]["candidates"][0]
    assert duplicate["duplicateCheckCompleted"]["duplicateCheck"]["decision"] == (
        "DUPLICATE"
    )
    assert (candidate["intersectionCount"], candidate["unionCount"]) == (23, 25)


def test_url_and_title_are_diagnostics_not_body_decisions(payload_factory) -> None:
    service, repository = _service()
    assert service.admit(
        payload_factory(
            crawl_item_id="diagnostic-base",
            content="ABCDEFGHIJKLM",
            title="Same title",
        )
    )["outcome"] == "ARTICLE_INGESTED"

    result = service.admit(
        payload_factory(
            crawl_item_id="diagnostic-new",
            content="nopqrstuvwxyz",
            title="Same title",
        )
    )

    assert result["outcome"] == "ARTICLE_INGESTED"
    assert len(repository.articles) == 2


def test_rollback_removes_partial_article_and_fingerprint(payload_factory) -> None:
    service, repository = _service()
    repository.fail_on.add("insert_fingerprint")

    result = service.admit(payload_factory())

    assert result["outcome"] == "ADMISSION_FAILED"
    assert result["error"]["code"] == "PERSISTENCE_ERROR"
    assert repository.articles == {}
    assert repository.fingerprints == {}
    assert repository.buckets == {}
    assert repository.checks == {}


def test_idempotency_key_reuse_with_different_input_fails(payload_factory) -> None:
    service, _ = _service()
    first = payload_factory(crawl_item_id="same-item", content="ABCDEFGHIJKLM")
    changed = payload_factory(crawl_item_id="same-item", content="nopqrstuvwxyz")
    service.admit(first)

    result = service.admit(changed)

    assert result["outcome"] == "ADMISSION_FAILED"
    assert result["error"]["code"] == "IDEMPOTENCY_KEY_REUSE"


def test_concurrent_same_content_creates_only_one_article(payload_factory) -> None:
    service, repository = _service()
    left = payload_factory(crawl_item_id="concurrent-left")
    right = payload_factory(crawl_item_id="concurrent-right")

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(service.admit, (left, right)))

    assert sorted(result["outcome"] for result in outcomes) == [
        "ARTICLE_INGESTED",
        "DUPLICATE_CHECK_COMPLETED",
    ]
    assert len(repository.articles) == 1


def test_truncated_candidate_search_fails_closed(payload_factory) -> None:
    request = ContractValidator().validate_admission(payload_factory())
    prepared = PreparedAdmission(
        request=request,
        input_digest=sha256_digest(request),
        request_key="admit:crawl-item-001:duplicate-policy-v1",
        fingerprint=build_fingerprint(request["article"]["content"]),
        prepared_at=datetime.now(UTC),
    )

    try:
        evaluate_candidates(prepared, CandidateBatch(records=(), truncated=True))
    except ResourceLimitExceeded as error:
        assert error.code == "RESOURCE_LIMIT_EXCEEDED"
    else:
        raise AssertionError("A truncated search must not produce UNIQUE.")
