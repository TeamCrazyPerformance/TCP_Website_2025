from datetime import UTC, datetime, timedelta

from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_pipeline.persistence.mysql import MySQLPipelineRepository


def article(article_id: str, *, tag: str, published_at: datetime, status: str = "PUBLISHED"):
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
        "originalPublishedAt": published_at.isoformat(),
        "canonicalUrl": f"https://www.infoq.com/{article_id}",
        "localizedTitle": f"제목 {article_id}",
        "tags": [tag],
        "oneLineSummary": f"summary {article_id}",
        "summary": f"detail {article_id}",
        "qualityScore": 80,
        "qualityDecision": "PASS",
        "qualityEvaluation": {"decision": "PASS", "score": {"overall": 80}},
        "processingStatus": "ENRICHED",
        "reviewStatus": "NOT_REQUIRED",
        "publicationStatus": status,
        "recordVersion": 2,
        "createdAt": published_at,
        "updatedAt": published_at,
    }


def test_memory_public_filters_use_tag_or_and_stable_newest_order():
    repository = MemoryPipelineRepository()
    now = datetime.now(UTC)
    repository.articles = {
        "a": article("a", tag="AI", published_at=now - timedelta(days=1)),
        "b": article("b", tag="보안", published_at=now),
        "c": article("c", tag="AI", published_at=now, status="HIDDEN"),
    }

    items = repository.list_public_articles(limit=20, offset=0, tags=("AI", "보안"))

    assert [item["articleId"] for item in items] == ["b", "a"]
    assert set(items[0]) == {
        "articleId",
        "title",
        "localizedTitle",
        "oneLineSummary",
        "tags",
        "sourceId",
        "canonicalUrl",
        "originalPublishedAt",
        "isNew",
    }
    assert "content" not in items[0]
    assert "qualityEvaluation" not in items[0]
    assert repository.count_public_articles(tags=("AI", "보안")) == 2
    assert repository.count_public_articles(keyword="summary a") == 1


def test_mysql_projection_matches_rich_memory_projection_shape():
    now = datetime.now(UTC)
    row = {
        "article_id": "article-1",
        "crawl_run_id": "run-1",
        "crawl_item_id": "item-1",
        "source_id": "infoq",
        "title": "Original",
        "authors": '["TCP"]',
        "content": "internal source content",
        "language": "en",
        "original_published_at": now,
        "canonical_url": "https://www.infoq.com/article-1",
        "quality_score": 88,
        "quality_decision": "PASS",
        "localized_title": "번역 제목",
        "tags": '["AI"]',
        "one_line_summary": "한 줄",
        "summary": "상세 요약",
        "localized_content": None,
        "processing_status": "ENRICHED",
        "review_status": "NOT_REQUIRED",
        "publication_status": "PUBLISHED",
        "published_at": now,
        "record_version": 3,
        "created_at": now,
        "updated_at": now,
        "submission_payload": '{"source":{"sourceType":"RSS"},"normalization":{"normalizedAt":"2026-08-16T00:00:00Z"}}',
        "quality_result": '{"qualityEvaluation":{"decision":"PASS","score":{"overall":88,"dimensions":{"relevance":90,"timeliness":85,"sourceReliability":87}}}}',
        "crawl_item_payload": "{}",
        "collected_at": now,
        "quality_review_case_id": "quality-case-1",
        "quality_review_case_version": 4,
    }

    projected = MySQLPipelineRepository._article_projection(row)

    assert projected["source"]["id"] == "infoq"
    assert projected["source"]["type"] == "RSS"
    assert projected["originalLanguage"] == {"code": "en", "label": "영어"}
    assert projected["summaryMarkdown"] == "상세 요약"
    assert projected["evaluation"]["score"]["dimensions"]["relevance"] == 90
    assert projected["qualityReview"] == {
        "caseId": "quality-case-1",
        "caseVersion": 4,
    }


def test_memory_admin_projection_exposes_only_the_pending_quality_review():
    repository = MemoryPipelineRepository()
    now = datetime.now(UTC)
    repository.articles["article-1"] = article(
        "article-1",
        tag="AI",
        published_at=now,
        status="UNPUBLISHED",
    )
    repository.articles["article-1"]["processingStatus"] = "QUALITY_EVALUATED"
    repository.articles["article-1"]["reviewStatus"] = "PENDING"
    repository.quality_reviews = {
        "resolved-case": {
            "caseId": "resolved-case",
            "articleId": "article-1",
            "status": "RESOLVED_REJECT",
            "caseVersion": 2,
        },
        "pending-case": {
            "caseId": "pending-case",
            "articleId": "article-1",
            "status": "PENDING",
            "caseVersion": 3,
        },
    }

    projected = repository.list_articles(limit=20, offset=0)[0]

    assert projected["qualityReview"] == {
        "caseId": "pending-case",
        "caseVersion": 3,
    }


def test_memory_rejected_review_queue_lists_only_quality_rejections():
    repository = MemoryPipelineRepository()
    now = datetime.now(UTC)
    rejected = article(
        "rejected",
        tag="AI",
        published_at=now,
        status="UNPUBLISHED",
    )
    rejected["processingStatus"] = "QUALITY_REJECTED"
    rejected["qualityDecision"] = "REJECT"
    enriched = article("enriched", tag="AI", published_at=now)
    repository.articles = {"rejected": rejected, "enriched": enriched}

    items = repository.list_review_queue("rejected", limit=20)

    assert [item["articleId"] for item in items] == ["rejected"]
    assert repository.count_review_queue("rejected") == 1


def test_mysql_public_queries_select_only_public_columns():
    now = datetime.now(UTC)
    list_row = {
        "article_id": "article-1",
        "source_id": "infoq",
        "title": "Original",
        "original_published_at": now,
        "canonical_url": "https://www.infoq.com/article-1",
        "localized_title": "번역 제목",
        "tags": '["AI"]',
        "one_line_summary": "한 줄",
        "collected_at": now,
    }
    detail_row = {
        **list_row,
        "language": "en",
        "quality_score": 88,
        "summary": "상세 요약",
        "score_payload": (
            '{"overall":88,"axes":[{"key":"relevance",'
            '"label":"개발 관련성","value":90,"weight":0.35,'
            '"contribution":31.5}]}'
        ),
    }

    class FakeCursor:
        def __init__(self, row):
            self.row = row
            self.executed = None

        def execute(self, query, params=None):
            self.executed = (query, params)

        def fetchall(self):
            return [self.row]

        def fetchone(self):
            return self.row

        def close(self):
            return None

    class FakeConnection:
        def __init__(self, row):
            self.cursor_instance = FakeCursor(row)

        def cursor(self, dictionary=False):
            del dictionary
            return self.cursor_instance

        def close(self):
            return None

    class FakePool:
        def __init__(self, row):
            self.connection = FakeConnection(row)

        def get_connection(self):
            return self.connection

    list_pool = FakePool(list_row)
    list_repository = MySQLPipelineRepository(list_pool)
    items = list_repository.list_public_articles(limit=20, offset=0)
    list_query, _ = list_pool.connection.cursor_instance.executed
    list_select = list_query.split("FROM articles a", maxsplit=1)[0].lower()
    assert items[0]["articleId"] == "article-1"
    for forbidden in (
        "authors",
        "content",
        "localized_content",
        "submission_payload",
        "quality_result",
        "item_payload",
        "member_views",
        "guest_attempts",
    ):
        assert forbidden not in list_select

    detail_pool = FakePool(detail_row)
    detail_repository = MySQLPipelineRepository(detail_pool)
    detail = detail_repository.get_public_article("article-1")
    detail_query, _ = detail_pool.connection.cursor_instance.executed
    detail_select = detail_query.split("FROM articles a", maxsplit=1)[0].lower()
    assert detail["score"]["overall"] == 88
    assert "json_extract(ps.quality_result" in detail_select
    for forbidden in (
        "authors",
        "a.content",
        "localized_content",
        "submission_payload",
        "item_payload",
        "member_views",
        "guest_attempts",
    ):
        assert forbidden not in detail_select


def test_memory_duplicate_resolution_removes_the_pending_queue_item():
    repository = MemoryPipelineRepository()
    repository.submissions["submission-1"] = {
        "submission_id": "submission-1",
        "duplicate_review_case_id": "case-1",
        "state": "DUPLICATE_REVIEW_PENDING",
    }
    repository.duplicate_reviews["case-1"] = {
        "reviewCaseId": "case-1",
        "status": "PENDING",
        "caseVersion": 1,
        "createdAt": datetime.now(UTC),
    }

    repository.continue_after_duplicate_resolution(
        "case-1",
        {
            "outcome": "RESOLUTION_COMPLETED",
            "resolution": {"finalDecision": "DUPLICATE"},
        },
        max_attempts=3,
    )

    assert repository.count_review_queue("duplicate") == 0
