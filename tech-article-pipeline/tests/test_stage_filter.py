"""단계(stage) 집계와 단계 필터.

관리자 화면의 단계 칩은 이 집계를 그대로 그리고, 칩을 누르면 같은 조건으로
목록을 다시 받아옵니다. 따라서 '집계 건수 == 필터 건수'가 깨지면 화면에서
칩 숫자와 목록 총계가 어긋납니다.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from tech_article_pipeline.persistence.base import (
    APPROVED_COMPATIBLE_PROCESSING,
    STAGE_NAMES,
)
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.persistence.mysql import (
    STAGE_CASE,
    STAGE_PREDICATES,
    STATUS_MISMATCH_PREDICATE,
    MySQLPipelineRepository,
)

NOW = datetime(2026, 8, 21, tzinfo=UTC)


def article(
    article_id: str,
    processing: str,
    review: str,
    publication: str,
    updated_at: datetime | None = None,
):
    return {
        "articleId": article_id,
        "crawlRunId": "run-1",
        "crawlItemId": f"item-{article_id}",
        "sourceId": "infoq",
        "sourceType": "RSS",
        "title": f"Title {article_id}",
        "authors": ["TCP"],
        "content": "internal source content",
        "language": "en",
        "originalPublishedAt": NOW.isoformat(),
        "canonicalUrl": f"https://www.infoq.com/{article_id}",
        "localizedTitle": f"제목 {article_id}",
        "tags": ["AI"],
        "oneLineSummary": f"summary {article_id}",
        "summary": f"detail {article_id}",
        "qualityScore": 80,
        "qualityDecision": "PASS",
        "qualityEvaluation": {"decision": "PASS", "score": {"overall": 80}},
        "processingStatus": processing,
        "reviewStatus": review,
        "publicationStatus": publication,
        "recordVersion": 2,
        "createdAt": NOW,
        "updatedAt": updated_at or NOW,
    }


# 2026-08-21 운영 로그에서 관측된 33건 분포.
OBSERVED = [
    ("ENRICHED", "NOT_REQUIRED", "PUBLISHED", 11),
    ("QUALITY_EVALUATED", "PENDING", "UNPUBLISHED", 9),
    ("QUALITY_REJECTED", "APPROVED", "HIDDEN", 9),
    ("QUALITY_EVALUATED", "APPROVED", "HIDDEN", 2),
    ("QUALITY_REJECTED", "NOT_REQUIRED", "UNPUBLISHED", 1),
    ("ENRICHED", "APPROVED", "PUBLISHED", 1),
]


def observed_repository() -> MemoryPipelineRepository:
    repository = MemoryPipelineRepository()
    index = 0
    for processing, review, publication, count in OBSERVED:
        for _ in range(count):
            index += 1
            key = f"a{index:03d}"
            repository.articles[key] = article(key, processing, review, publication)
    return repository


def test_stage_names_are_shared_by_both_backends():
    # SQL 술어와 파이썬 판정이 같은 단계 집합을 다뤄야 합니다.
    assert set(STAGE_PREDICATES) == set(STAGE_NAMES)
    repository = MemoryPipelineRepository()
    reachable = {
        repository._article_stage(article("x", processing, "NOT_REQUIRED", "UNPUBLISHED"))
        for processing in (
            "INGESTED",
            "QUALITY_EVALUATED",
            "ENRICHMENT_PENDING",
            "QUALITY_REJECTED",
            "ENRICHED",
            "PROCESSING_FAILED",
        )
    }
    assert reachable <= set(STAGE_NAMES)


def test_observed_distribution_counts_every_stage():
    stats = observed_repository().article_stats()

    # 8개 단계가 모두 키로 남습니다. 0 건이어도 화면이 자리를 지킵니다.
    assert set(stats["stages"]) == set(STAGE_NAMES)
    assert stats["stages"]["QUALITY_REVIEW"] == 11  # 9 + 2
    assert stats["stages"]["QUALITY_REJECTED"] == 10  # 9 + 1
    assert stats["stages"]["COMPLETED"] == 12  # 11 + 1
    assert stats["stages"]["INGESTED"] == 0
    assert sum(stats["stages"].values()) == stats["totalCount"] == 33


@pytest.mark.parametrize("stage", STAGE_NAMES)
def test_filter_count_matches_stats_count(stage):
    # 칩 숫자와 목록 총계가 같은 모집단을 세는지가 이 기능의 핵심입니다.
    repository = observed_repository()
    expected = repository.article_stats()["stages"][stage]

    assert repository.count_articles(stage=stage) == expected
    items = repository.list_articles(limit=100, offset=0, stage=stage)
    assert len(items) == expected
    assert {item["stage"] for item in items} <= {stage}


def test_absent_stage_parameter_keeps_previous_behaviour():
    repository = observed_repository()
    assert repository.count_articles() == 33
    assert len(repository.list_articles(limit=100, offset=0)) == 33


def test_failed_after_approval_reads_the_review_case_not_review_status():
    """공개 액션이 남긴 위조 APPROVED 를 '승인 후 요약 실패'로 올리지 않습니다."""
    repository = MemoryPipelineRepository()
    repository.articles = {
        # 검토 승인 없이 review_status 만 APPROVED 로 덮인 건 (공개 토글 흔적)
        "forged": article("forged", "PROCESSING_FAILED", "APPROVED", "HIDDEN"),
        # 실제로 검토 승인을 받은 건
        "real": article("real", "PROCESSING_FAILED", "APPROVED", "HIDDEN"),
    }
    repository.quality_reviews = {
        "case-1": {
            "caseId": "case-1",
            "submissionId": "sub-1",
            "articleId": "real",
            "status": "RESOLVED_APPROVE",
            "caseVersion": 2,
            "evaluation": {},
            "createdAt": NOW,
        }
    }

    stages = repository.article_stats()["stages"]
    assert stages["FAILED_AFTER_APPROVAL"] == 1
    assert stages["FAILED"] == 1
    assert repository._article_stage(repository.articles["forged"]) == "FAILED"
    assert repository._article_stage(repository.articles["real"]) == "FAILED_AFTER_APPROVAL"


def test_unknown_stage_is_rejected_before_touching_sql():
    # 호출자가 보낸 문자열은 딕셔너리 키로만 쓰이므로 SQL 로 흘러가지 않습니다.
    with pytest.raises(ValueError):
        MySQLPipelineRepository._article_conditions(
            stage="QUALITY_REVIEW'); DROP TABLE articles; --",
            include_admin_fields=True,
        )


def test_stage_case_covers_every_predicate():
    for stage, predicate in STAGE_PREDICATES.items():
        assert f"WHEN {predicate} THEN '{stage}'" in STAGE_CASE
    assert STAGE_CASE.endswith("ELSE 'UNKNOWN' END")


def test_mysql_condition_builder_embeds_the_predicate():
    where, params = MySQLPipelineRepository._article_conditions(
        stage="QUALITY_REVIEW", include_admin_fields=True
    )
    assert STAGE_PREDICATES["QUALITY_REVIEW"] in where
    assert params == ()


def test_mysql_stage_and_publication_filters_combine():
    where, params = MySQLPipelineRepository._article_conditions(
        publication_status="HIDDEN", stage="QUALITY_REVIEW", include_admin_fields=True
    )
    assert "a.publication_status = %s" in where
    assert STAGE_PREDICATES["QUALITY_REVIEW"] in where
    assert params == ("HIDDEN",)


# ── 검토 상태 표시 오류 (단계와 별개 축) ────────────────────────────────


def test_status_mismatch_is_counted_apart_from_stages():
    repository = observed_repository()
    stats = repository.article_stats()

    # 로그의 33건 중 11건 — QUALITY_REJECTED 9 + QUALITY_EVALUATED 2
    assert stats["statusMismatch"] == 11
    # 단계 합계에는 섞이지 않습니다.
    assert sum(stats["stages"].values()) == 33


def test_status_mismatch_filter_matches_its_count():
    repository = observed_repository()
    expected = repository.article_stats()["statusMismatch"]

    assert repository.count_articles(status_mismatch=True) == expected
    items = repository.list_articles(limit=100, offset=0, status_mismatch=True)
    assert len(items) == expected
    for item in items:
        assert item["reviewStatus"] == "APPROVED"
        assert item["processingStatus"] not in APPROVED_COMPATIBLE_PROCESSING


def test_status_mismatch_does_not_hide_the_stage():
    """표식이 단계를 덮으면 처리해야 할 일이 가려집니다."""
    repository = observed_repository()
    items = repository.list_articles(limit=100, offset=0, status_mismatch=True)
    stages = {item["stage"] for item in items}
    assert stages == {"QUALITY_REVIEW", "QUALITY_REJECTED"}


def test_status_mismatch_ignores_approved_compatible_stages():
    repository = MemoryPipelineRepository()
    repository.articles = {
        p.lower(): article(p.lower(), p, "APPROVED", "PUBLISHED")
        for p in APPROVED_COMPATIBLE_PROCESSING
    }
    assert repository.article_stats()["statusMismatch"] == 0


def test_mismatch_filter_combines_with_stage():
    repository = observed_repository()
    both = repository.count_articles(stage="QUALITY_REVIEW", status_mismatch=True)
    assert both == 2  # QUALITY_EVALUATED | APPROVED | HIDDEN


def test_mysql_mismatch_predicate_lists_the_compatible_statuses():
    for status in APPROVED_COMPATIBLE_PROCESSING:
        assert f"'{status}'" in STATUS_MISMATCH_PREDICATE
    where, params = MySQLPipelineRepository._article_conditions(
        status_mismatch=True, include_admin_fields=True
    )
    assert STATUS_MISMATCH_PREDICATE in where
    assert params == ()


# ── 체류 시간과 OLDEST 정렬 ──────────────────────────────────────────


def test_stage_oldest_reports_the_longest_waiting_article():
    repository = MemoryPipelineRepository()
    old = NOW - timedelta(days=3, hours=12)
    repository.articles = {
        "fresh": article("fresh", "QUALITY_EVALUATED", "PENDING", "UNPUBLISHED"),
        "stuck": article(
            "stuck", "QUALITY_EVALUATED", "PENDING", "UNPUBLISHED", updated_at=old
        ),
        "other": article("other", "ENRICHED", "NOT_REQUIRED", "PUBLISHED"),
    }

    stats = repository.article_stats()

    # 8개 단계 전부 키를 갖고, 0 건인 단계는 None 입니다.
    assert set(stats["stageOldest"]) == set(STAGE_NAMES)
    assert stats["stageOldest"]["INGESTED"] is None
    assert stats["stageOldest"]["QUALITY_REVIEW"] == old
    assert stats["stageOldest"]["COMPLETED"] == NOW


def test_oldest_sort_puts_the_longest_waiting_first():
    repository = MemoryPipelineRepository()
    repository.articles = {
        "b": article("b", "QUALITY_EVALUATED", "PENDING", "UNPUBLISHED",
                     updated_at=NOW - timedelta(hours=1)),
        "c": article("c", "QUALITY_EVALUATED", "PENDING", "UNPUBLISHED",
                     updated_at=NOW - timedelta(days=2)),
        "a": article("a", "QUALITY_EVALUATED", "PENDING", "UNPUBLISHED", updated_at=NOW),
    }

    items = repository.list_articles(limit=10, offset=0, sort="OLDEST")
    assert [item["articleId"] for item in items] == ["c", "b", "a"]

    # 단계 필터와 함께 써도 순서가 유지됩니다.
    filtered = repository.list_articles(
        limit=10, offset=0, stage="QUALITY_REVIEW", sort="OLDEST"
    )
    assert [item["articleId"] for item in filtered] == ["c", "b", "a"]


def test_mysql_order_by_supports_oldest():
    where, _ = MySQLPipelineRepository._article_conditions(include_admin_fields=True)
    assert where == "1 = 1"
    # 정렬 키가 실제로 등록돼 있어야 합니다 (없으면 KeyError 로 500).
    import inspect

    source = inspect.getsource(MySQLPipelineRepository._list_articles)
    assert '"OLDEST"' in source
    assert "a.updated_at ASC" in source


# ── 칩 숫자가 목록 조건을 따라간다 ───────────────────────────────────


def test_stats_follow_the_same_filter_as_the_list():
    """검색 중에 칩만 전체를 세면 칩 11 인데 목록 2 건인 상황이 됩니다."""
    repository = observed_repository()
    # 제목에만 들어가는 검색어로 한 건만 남깁니다.
    target = repository.articles["a012"]
    keyword = target["localizedTitle"]

    stats = repository.article_stats(keyword=keyword)

    assert stats["totalCount"] == repository.count_articles(keyword=keyword) == 1
    assert sum(stats["stages"].values()) == 1
    # 그 한 건이 속한 단계만 1, 나머지는 0
    stage = repository._article_stage(target)
    assert stats["stages"][stage] == 1
    assert all(v == 0 for k, v in stats["stages"].items() if k != stage)


def test_stats_follow_the_publication_filter():
    repository = observed_repository()
    stats = repository.article_stats(publication_status="HIDDEN")

    hidden = repository.count_articles(publication_status="HIDDEN")
    assert stats["totalCount"] == hidden == 11  # 9 + 2
    assert sum(stats["stages"].values()) == hidden
    assert stats["stages"]["QUALITY_REVIEW"] == 2
    assert stats["stages"]["QUALITY_REJECTED"] == 9


def test_chip_count_equals_list_total_under_every_filter():
    """칩을 누르면 목록 총계가 칩 숫자와 같아야 합니다 — 검색 중에도."""
    repository = observed_repository()
    for keyword in (None, "제목 a012", None):
        stats = repository.article_stats(keyword=keyword)
        for stage, count in stats["stages"].items():
            assert (
                repository.count_articles(keyword=keyword, stage=stage) == count
            ), (keyword, stage)


def test_review_queues_ignore_the_article_filter():
    # 검수 큐는 다른 테이블이라 목록 검색어에 좌우되면 안 됩니다.
    repository = observed_repository()
    full = repository.article_stats()["reviews"]
    narrowed = repository.article_stats(keyword="제목 a012")["reviews"]
    assert full == narrowed
    assert "statusMismatch" not in narrowed
