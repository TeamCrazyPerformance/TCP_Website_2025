from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tech_article_quality import QualityEvaluator

NOW = datetime(2026, 8, 16, 12, 0, tzinfo=UTC)


def request(**policy_overrides):
    policy = {
        "policyVersion": "quality-policy-v1",
        "minimumEvaluationScore": 70,
        "reviewLowerBound": 45,
        "minimumContentLength": 200,
        "maximumContentLength": 10_000,
        "allowedLanguages": ["ko", "en"],
        "rejectSpam": True,
        "rejectAdvertisements": True,
        "requireAdminReview": False,
    }
    policy.update(policy_overrides)
    if "minimumEvaluationScore" in policy_overrides and "reviewLowerBound" not in policy_overrides:
        policy["reviewLowerBound"] = min(
            policy["reviewLowerBound"], policy["minimumEvaluationScore"]
        )
    content = (
        "Python FastAPI 서버와 MySQL 데이터베이스를 Docker 컨테이너로 배포한다. "
        "개발자는 API 아키텍처, 보안, 테스트, 성능, 동시성 문제를 검토했다. "
        "Kubernetes 환경에서 Redis와 Kafka를 연결하고 pytest로 회귀 테스트를 수행했다. "
        "이 글은 구현 과정과 설계 선택, 운영 중 발견한 문제와 해결 방법을 상세하게 설명한다. "
        "오픈소스 도구와 클라우드 배포 자동화가 백엔드 개발 흐름에 미친 영향도 분석한다."
    )
    return {
        "articleId": "article-1",
        "source": {"sourceId": "example"},
        "article": {
            "title": "Python API 아키텍처와 Docker 배포",
            "content": content,
            "language": "ko",
            "authors": ["TCP"],
            "originalPublishedAt": (NOW - timedelta(hours=1)).isoformat(),
        },
        "qualityPolicy": policy,
    }


def evaluator():
    return QualityEvaluator(clock=lambda: NOW)


def test_valid_article_passes_at_low_boundary():
    result = evaluator().evaluate(request(minimumEvaluationScore=0))
    evaluation = result["qualityEvaluation"]
    assert evaluation["status"] == "SUCCESS"
    assert evaluation["decision"] == "PASS"
    assert evaluation["schemaVersion"] == "2.0"
    assert evaluation["score"]["dimensions"].keys() == {
        "relevance",
        "timeliness",
        "sourceReliability",
    }


def test_score_describes_the_axes_used_for_the_evaluation():
    evaluation = evaluator().evaluate(request(minimumEvaluationScore=0))["qualityEvaluation"]
    score = evaluation["score"]

    assert score["scale"] == {"min": 0, "max": 100}
    assert [axis["key"] for axis in score["axes"]] == [
        "relevance",
        "timeliness",
        "sourceReliability",
    ]
    assert [axis["label"] for axis in score["axes"]] == [
        "개발 관련성",
        "시의성",
        "출처 신뢰도",
    ]
    assert [axis["weight"] for axis in score["axes"]] == [0.45, 0.30, 0.25]
    assert round(sum(axis["contribution"] for axis in score["axes"])) == score["overall"]
    for axis in score["axes"]:
        assert axis["value"] == score["dimensions"][axis["key"]]


def test_exactly_24_hours_has_zero_timeliness():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["originalPublishedAt"] = (NOW - timedelta(hours=24)).isoformat()
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["score"]["dimensions"]["timeliness"] == 0


def test_future_publication_is_capped_at_100():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["originalPublishedAt"] = (NOW + timedelta(hours=2)).isoformat()
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["score"]["dimensions"]["timeliness"] == 100


def test_invalid_timestamp_returns_failure_contract():
    payload = request()
    payload["article"]["originalPublishedAt"] = "not-a-date"
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["status"] == "FAILED"
    assert result["qualityEvaluation"]["error"]["code"] == "INVALID_INPUT"
    assert result["qualityEvaluation"]["error"]["retryable"] is False


def test_length_and_language_are_hard_rejections_even_with_zero_threshold():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["content"] = "Python"
    payload["article"]["language"] = "fr"
    result = evaluator().evaluate(payload)
    evaluation = result["qualityEvaluation"]
    assert evaluation["decision"] == "REJECT"
    assert {"CONTENT_TOO_SHORT", "LANGUAGE_NOT_ALLOWED"} <= set(evaluation["rejectionCodes"])


def test_maximum_length_is_enforced():
    payload = request(maximumContentLength=200)
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["decision"] == "REJECT"
    assert "CONTENT_TOO_LONG" in result["qualityEvaluation"]["rejectionCodes"]


def test_admin_review_policy_overrides_a_passing_score():
    result = evaluator().evaluate(
        request(minimumEvaluationScore=0, reviewLowerBound=0, requireAdminReview=True)
    )
    assert result["qualityEvaluation"]["decision"] == "REVIEW_REQUIRED"


def test_score_below_pass_but_above_review_floor_requires_review():
    baseline = evaluator().evaluate(request(minimumEvaluationScore=0))
    score = baseline["qualityEvaluation"]["score"]["overall"]
    result = evaluator().evaluate(
        request(minimumEvaluationScore=min(100, score + 1), reviewLowerBound=score)
    )
    assert result["qualityEvaluation"]["decision"] == "REVIEW_REQUIRED"


def test_spam_and_advertisement_policies_are_enforced():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["content"] = ("python " * 100) + " sponsored limited offer "
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["decision"] == "REJECT"
    assert {"SPAM_SUSPECTED", "ADVERTISEMENT_SUSPECTED"} <= set(
        result["qualityEvaluation"]["rejectionCodes"]
    )
