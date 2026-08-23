"""공개 화면의 소스 필터와 NEW 배지.

소스는 앞으로 계속 늘어납니다. 그래서 목록 응답에 소스 목록을 얹지 않고
별도 조회로 두고, 필터는 서버에서 겁니다. 프런트에서 거르면 "받아 놓은
한 페이지 안에서만 걸러지는" 문제가 그대로 생깁니다.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from tech_article_pipeline.catalog import known_source_ids, public_source_catalog
from tech_article_pipeline.persistence.base import NEW_ARTICLE_WINDOW_HOURS
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository

NOW = datetime.now(UTC)


def article(article_id: str, source_id: str, *, published=True):
    return {
        "articleId": article_id,
        "crawlRunId": "run-1",
        "crawlItemId": f"item-{article_id}",
        "sourceId": source_id,
        "sourceType": "RSS",
        "title": f"Title {article_id}",
        "authors": ["TCP"],
        "content": "internal source content",
        "language": "en",
        "originalPublishedAt": NOW.isoformat(),
        "canonicalUrl": f"https://example.com/{article_id}",
        "localizedTitle": f"제목 {article_id}",
        "tags": ["AI"],
        "oneLineSummary": f"summary {article_id}",
        "summary": f"detail {article_id}",
        "qualityScore": 80,
        "qualityDecision": "PASS",
        "processingStatus": "ENRICHED",
        "reviewStatus": "NOT_REQUIRED",
        "publicationStatus": "PUBLISHED" if published else "UNPUBLISHED",
        "recordVersion": 2,
        "createdAt": NOW,
        "updatedAt": NOW,
    }


def repository() -> MemoryPipelineRepository:
    repo = MemoryPipelineRepository()
    repo.articles = {
        "a1": article("a1", "infoq"),
        "a2": article("a2", "infoq"),
        "a3": article("a3", "cloudflare-blog"),
        "a4": article("a4", "github-trending"),
        # 공개되지 않은 건은 어느 집계에도 들어가면 안 됩니다.
        "a5": article("a5", "infoq", published=False),
    }
    return repo


# ── 카탈로그 ──────────────────────────────────────────────


def test_public_catalog_carries_category_for_every_source():
    """소스가 수십 개가 되면 상위 분류로 묶어야 합니다. 나중에 소급해 붙이는
    것보다 처음부터 채워 두는 편이 쌉니다."""
    catalog = public_source_catalog()
    assert catalog, "소스 카탈로그가 비어 있습니다"
    for source in catalog:
        assert set(source) == {"id", "name", "domain", "category"}
        assert source["category"], f"{source['id']} 에 category 가 없습니다"
        # 크롤 옵션 같은 내부 정보는 공개 응답에 담지 않습니다.
        assert "capabilities" not in source
        assert "crawlOptions" not in source


def test_known_source_ids_matches_catalog():
    assert known_source_ids() == {s["id"] for s in public_source_catalog()}


# ── 소스 필터 ─────────────────────────────────────────────


def test_source_counts_only_count_published_articles():
    counts = repository().public_source_counts()
    assert counts == {"infoq": 2, "cloudflare-blog": 1, "github-trending": 1}


@pytest.mark.parametrize(
    "sources,expected",
    [
        ((), 4),
        (("infoq",), 2),
        (("infoq", "cloudflare-blog"), 3),
        (("github-trending",), 1),
    ],
)
def test_filter_count_matches_the_list(sources, expected):
    """선택기의 숫자와 목록 총계가 같은 모집단을 세야 합니다."""
    repo = repository()
    assert repo.count_public_articles(sources=sources) == expected
    items = repo.list_public_articles(limit=50, offset=0, sources=sources)
    assert len(items) == expected
    if sources:
        assert {item["source"]["id"] for item in items} <= set(sources)


def test_source_counts_agree_with_the_filter():
    repo = repository()
    for source_id, count in repo.public_source_counts().items():
        assert repo.count_public_articles(sources=(source_id,)) == count


def test_absent_source_parameter_keeps_previous_behaviour():
    repo = repository()
    assert repo.count_public_articles() == 4
    assert len(repo.list_public_articles(limit=50, offset=0)) == 4


def test_source_and_tag_filters_combine():
    repo = repository()
    assert repo.count_public_articles(sources=("infoq",), tags=("AI",)) == 2
    assert repo.count_public_articles(sources=("infoq",), tags=("보안",)) == 0


def test_mysql_source_filter_is_parameterised():
    """소스 id 가 SQL 에 문자열로 박히면 안 됩니다."""
    where, params = MySQLPipelineRepository._article_conditions(
        public_only=True, sources=("infoq", "sdtimes")
    )
    assert "a.source_id IN (%s, %s)" in where
    assert params == ("infoq", "sdtimes")
    assert "infoq" not in where


# ── NEW 배지 ──────────────────────────────────────────────


def test_new_flag_marks_recently_collected_articles():
    """수집 시각은 crawl_items 에서 옵니다 (mysql 은 ci.produced_at)."""
    repo = MemoryPipelineRepository()
    collected = {
        "fresh": NOW - timedelta(hours=1),
        "edge": NOW - timedelta(hours=NEW_ARTICLE_WINDOW_HOURS - 1),
        "old": NOW - timedelta(hours=NEW_ARTICLE_WINDOW_HOURS + 1),
        "unknown": None,
    }
    repo.articles = {key: article(key, "infoq") for key in collected}
    repo.crawl_items = {
        f"item-{key}": {"crawl_run_id": "run-1", "produced_at": value}
        for key, value in collected.items()
        if value is not None
    }
    flags = {
        item["articleId"]: item["isNew"]
        for item in repo.list_public_articles(limit=50, offset=0)
    }
    assert flags == {"fresh": True, "edge": True, "old": False, "unknown": False}


def test_new_window_is_a_server_side_policy():
    # 프런트에 숫자를 박으면 바꿀 때마다 프런트를 배포해야 합니다.
    assert NEW_ARTICLE_WINDOW_HOURS == 24
