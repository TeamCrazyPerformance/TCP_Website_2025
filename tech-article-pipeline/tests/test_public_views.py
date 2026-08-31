from tech_article_pipeline.api.public_views import (
    public_detail_article_read,
    public_list_article_read,
    public_value_score_read,
)


def internal_article():
    return {
        "articleId": "article-1",
        "title": "Original",
        "localizedTitle": "공개 제목",
        "oneLineSummary": "한 줄",
        "summaryMarkdown": "## 상세",
        "tags": ["AI"],
        "sourceId": "infoq",
        "canonicalUrl": "https://www.infoq.com/articles/example",
        "language": "en",
        "originalPublishedAt": "2026-08-15T00:00:00Z",
        "collectedAt": "2026-08-15T01:00:00Z",
        "isNew": True,
        "qualityScore": 88,
        "score": {
            "overall": 88,
            "scale": {"min": 0, "max": 100},
            "axes": [
                {
                    "key": "relevance",
                    "label": "개발 관련성",
                    "value": 91,
                    "weight": 0.35,
                    "contribution": 31.85,
                }
            ],
        },
        "content": "must-not-leak",
        "authors": ["Internal Author"],
        "evaluation": {"reason": "must-not-leak-either"},
        "recordVersion": 7,
        "processingStatus": "ENRICHED",
    }


def test_public_list_view_has_an_exact_allowlist():
    result = public_list_article_read(internal_article())

    assert list(result) == [
        "articleId",
        "title",
        "localizedTitle",
        "oneLineSummary",
        "tags",
        "source",
        "originalPublishedAt",
        "isNew",
    ]
    assert list(result["source"]) == ["name", "domain"]
    serialized = str(result)
    assert "must-not-leak" not in serialized
    assert "sourceId" not in serialized
    assert "RSS" not in serialized


def test_public_detail_view_has_an_exact_allowlist_and_minimal_score():
    result = public_detail_article_read(internal_article())

    assert list(result) == [
        "articleId",
        "title",
        "localizedTitle",
        "oneLineSummary",
        "summaryMarkdown",
        "tags",
        "source",
        "originalLanguage",
        "originalPublishedAt",
        "collectedAt",
        "valueScore",
    ]
    assert list(result["source"]) == ["name", "domain", "path", "articleUrl"]
    assert result["valueScore"] == {
        "overall": 88,
        "scale": {"min": 0, "max": 100},
        "breakdown": [{"label": "개발 관련성", "contribution": 31.85}],
    }
    serialized = str(result)
    for forbidden in (
        "must-not-leak",
        "recordVersion",
        "processingStatus",
        "relevance",
        "weight",
        "'value':",
    ):
        assert forbidden not in serialized


def test_public_score_restores_both_historical_dimension_shapes():
    old = public_value_score_read(
        {
            "score": {
                "overall": 80,
                "dimensions": {
                    "relevance": 90,
                    "timeliness": 70,
                    "sourceReliability": 75,
                },
            }
        }
    )
    current = public_value_score_read(
        {
            "score": {
                "overall": 84,
                "dimensions": {
                    "relevance": 90,
                    "technicalDepth": 80,
                    "timeliness": 85,
                    "articleQuality": 70,
                },
            }
        }
    )

    assert [item["label"] for item in old["breakdown"]] == [
        "개발 관련성",
        "시의성",
        "출처 신뢰도",
    ]
    assert [item["label"] for item in current["breakdown"]] == [
        "개발 관련성",
        "기술적 깊이",
        "최신성",
        "기사 품질",
    ]
