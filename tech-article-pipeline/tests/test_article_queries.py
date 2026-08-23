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

    items = repository.list_public_articles(
        limit=20, offset=0, tags=("AI", "보안")
    )

    assert [item["articleId"] for item in items] == ["b", "a"]
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
    }

    projected = MySQLPipelineRepository._article_projection(row)

    assert projected["source"]["id"] == "infoq"
    assert projected["source"]["type"] == "RSS"
    assert projected["originalLanguage"] == {"code": "en", "label": "영어"}
    assert projected["summaryMarkdown"] == "상세 요약"
    assert projected["evaluation"]["score"]["dimensions"]["relevance"] == 90


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
