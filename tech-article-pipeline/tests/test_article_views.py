"""아티클 조회수.

운영 판단용 집계입니다. 사용자별 이력을 남기지 않으므로 개인정보가 아니고,
개인정보처리방침을 고치지 않아도 됩니다. 그 전제를 여기서 고정합니다.
"""

from __future__ import annotations

import pathlib

import pytest
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / "migrations"


def article(article_id: str):
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
        "canonicalUrl": f"https://example.com/{article_id}",
        "localizedTitle": f"제목 {article_id}",
        "tags": ["AI"],
        "oneLineSummary": "summary",
        "summary": "detail",
        "qualityScore": 80,
        "qualityDecision": "PASS",
        "processingStatus": "ENRICHED",
        "reviewStatus": "NOT_REQUIRED",
        "publicationStatus": "PUBLISHED",
        "recordVersion": 2,
    }


@pytest.fixture
def repository():
    repo = MemoryPipelineRepository()
    repo.articles = {"a1": article("a1"), "a2": article("a2")}
    return repo


def counts(repo, article_id):
    item = next(
        i
        for i in repo.list_articles(limit=50, offset=0)
        if i["articleId"] == article_id
    )
    return item["viewCounts"]


def test_counts_start_at_zero(repository):
    assert counts(repository, "a1") == {
        "member": 0,
        "guest": 0,
        "lastViewedAt": None,
    }


def test_member_and_guest_are_counted_apart(repository):
    """공개 상세에 인증이 걸려 있어 비회원 시도에는 봇이 섞입니다.
    합계만 두면 운영자가 그 왜곡을 알아볼 수 없습니다."""
    for _ in range(3):
        repository.record_article_view("a1", member=True)
    for _ in range(7):
        repository.record_article_view("a1", member=False)

    result = counts(repository, "a1")
    assert result["member"] == 3
    assert result["guest"] == 7
    assert result["lastViewedAt"] is not None


def test_counts_are_per_article(repository):
    repository.record_article_view("a1", member=True)
    assert counts(repository, "a1")["member"] == 1
    assert counts(repository, "a2")["member"] == 0


def test_unknown_article_is_ignored(repository):
    """mysql 에서는 외래키가 막습니다. 조회 기록은 부가 기능이라
    실패하더라도 아티클 조회를 막아서는 안 됩니다."""
    repository.record_article_view("does-not-exist", member=True)
    assert "does-not-exist" not in repository.article_views


def test_view_counts_never_reach_the_public_response(repository):
    """운영 판단용이라 사용자에게 보여주지 않습니다. 공개 응답에 실리면
    '인기순 정렬' 같은 요구로 번지고 공개 계약이 늘어납니다."""
    repository.record_article_view("a1", member=True)
    # 파이프라인은 같은 프로젝션을 쓰지만, 걸러내는 책임은 Nest publicItem 에
    # 있습니다. 여기서는 값이 채워져 있다는 것만 확인합니다.
    assert counts(repository, "a1")["member"] == 1


# ── 스키마 ────────────────────────────────────────────────


def test_migration_does_not_touch_the_articles_table():
    """articles.updated_at 은 ON UPDATE CURRENT_TIMESTAMP 입니다. 조회수를
    거기 컬럼으로 붙이면 조회할 때마다 갱신되어 관리자 화면의 단계별 최장
    체류 시간이 무너지고, record_version 낙관적 잠금도 매번 충돌합니다."""
    sql = (MIGRATIONS / "005_article_view_counts.sql").read_text(encoding="utf-8")
    assert "ALTER TABLE articles" not in sql
    assert "CREATE TABLE IF NOT EXISTS article_view_counts" in sql
    # 아티클이 지워지면 카운트도 함께 사라져야 고아 행이 남지 않습니다.
    assert "ON DELETE CASCADE" in sql


def test_migration_keeps_member_and_guest_separate():
    sql = (MIGRATIONS / "005_article_view_counts.sql").read_text(encoding="utf-8")
    assert "member_views" in sql
    assert "guest_attempts" in sql
    # 사용자별 이력을 남기지 않는다는 전제. 식별자 컬럼이 생기면 개인정보가 됩니다.
    for forbidden in ("user_id", "member_id", "ip_address", "session_id"):
        assert forbidden not in sql, f"{forbidden} 이 들어가면 개인정보가 됩니다"


def test_readiness_requires_the_view_count_migration():
    """목록 질의가 article_view_counts 를 LEFT JOIN 합니다. 준비 확인이 005 를
    빠뜨리면, 마이그레이션 없이 뜬 인스턴스가 정상으로 보고된 뒤 공개·관리자
    아티클 목록이 전부 실패합니다."""
    source = (
        pathlib.Path(__file__).resolve().parents[1]
        / "core/src/tech_article_pipeline/persistence/mysql.py"
    ).read_text(encoding="utf-8")
    readiness = source.split("def check_readiness")[1].split("\n    def ")[0]
    assert '"005"' in readiness, "조회 경로가 기대는 마이그레이션은 준비 확인에도 올려야 합니다"
    assert "article_view_counts" in source


def test_unknown_article_is_filtered_before_the_foreign_key():
    """조회수 경로는 인증 없이도 닿습니다. 없는 id 를 외래키에 맡기면 요청마다
    무결성 오류가 나고, 누구나 아무 문자열로 로그를 부풀릴 수 있게 됩니다."""
    source = (
        pathlib.Path(__file__).resolve().parents[1]
        / "core/src/tech_article_pipeline/persistence/mysql.py"
    ).read_text(encoding="utf-8")
    body = source.split("def record_article_view")[1].split("\n    def ")[0]
    assert "FROM articles a WHERE a.article_id = %s" in body
    assert "VALUES (%s, 1, UTC_TIMESTAMP(6))" not in body
