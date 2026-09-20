from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from tech_article_quality import QualityEvaluator
from tech_article_quality import evaluator as evaluator_module
from tech_article_quality.models import Article

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
        "technicalDepth",
        "timeliness",
        "articleQuality",
        "communityBonus",
    }


def test_score_describes_the_axes_used_for_the_evaluation():
    evaluation = evaluator().evaluate(request(minimumEvaluationScore=0))["qualityEvaluation"]
    score = evaluation["score"]

    assert score["scale"] == {"min": 0, "max": 100}
    assert [axis["key"] for axis in score["axes"]] == [
        "relevance",
        "technicalDepth",
        "timeliness",
        "articleQuality",
    ]
    assert [axis["label"] for axis in score["axes"]] == [
        "개발 관련성",
        "기술적 깊이",
        "최신성",
        "기사 품질",
    ]
    assert [axis["weight"] for axis in score["axes"]] == [0.35, 0.30, 0.25, 0.10]
    assert round(sum(axis["contribution"] for axis in score["axes"])) == score["overall"]
    for axis in score["axes"]:
        assert axis["value"] == score["dimensions"][axis["key"]]


def test_exactly_24_hours_has_71_timeliness_due_to_48h_half_life():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["originalPublishedAt"] = (NOW - timedelta(hours=24)).isoformat()
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["score"]["dimensions"]["timeliness"] == 71


def test_future_publication_is_capped_at_100():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["originalPublishedAt"] = (NOW + timedelta(hours=2)).isoformat()
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["score"]["dimensions"]["timeliness"] == 100


def test_invalid_timestamp_returns_failure_contract():
    payload = request(minimumEvaluationScore=0)
    payload["article"]["originalPublishedAt"] = "invalid-date"
    result = evaluator().evaluate(payload)
    assert result["qualityEvaluation"]["status"] == "FAILED"
    assert result["qualityEvaluation"]["error"]["code"] == "INVALID_INPUT"


def test_technical_depth_sends_the_full_article_to_gemini(monkeypatch):
    article = Article(
        title="Long technical article",
        content=("Introduction. " * 200) + "UNIQUE_TAIL_TECHNICAL_EVIDENCE",
        language="en",
    )
    captured: dict[str, object] = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        @staticmethod
        def read():
            return json.dumps({
                "candidates": [{"content": {"parts": [{"text": '{"depth_score": 77}'}]}}]
            }).encode()

    def fake_urlopen(request, timeout):
        captured["payload"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        return Response()

    monkeypatch.setattr(evaluator_module.urllib.request, "urlopen", fake_urlopen)

    assert QualityEvaluator.evaluate_technical_depth_llm(article, api_key="test-key") == 77
    prompt = captured["payload"]["contents"][0]["parts"][0]["text"]
    assert article.content in prompt
    assert "UNIQUE_TAIL_TECHNICAL_EVIDENCE" in prompt
    assert captured["timeout"] == 10


def test_advertisement_words_without_a_disclosure_do_not_create_a_signal(monkeypatch):
    for method in ("evaluate_developer_relevance", "evaluate_technical_depth_llm",
                   "evaluate_timeliness", "evaluate_article_quality"):
        monkeypatch.setattr(QualityEvaluator, method, staticmethod(lambda *args, **kwargs: 80))
    payload = request()
    payload["article"]["content"] = ("sponsored " * 100) + "architecture analysis"

    evaluation = evaluator().evaluate(payload)["qualityEvaluation"]

    assert evaluation["signals"]["advertisementSuspected"] is False
    assert evaluation["signals"]["spamSuspected"] is True
    assert evaluation["decision"] == "PASS"
    assert "ADVERTISEMENT_SUSPECTED" not in evaluation["rejectionCodes"]
    assert "SPAM_SUSPECTED" not in evaluation["rejectionCodes"]


def test_explicit_sponsorship_is_an_observation_signal_not_a_hard_rejection(monkeypatch):
    for method in ("evaluate_developer_relevance", "evaluate_technical_depth_llm",
                   "evaluate_timeliness", "evaluate_article_quality"):
        monkeypatch.setattr(QualityEvaluator, method, staticmethod(lambda *args, **kwargs: 80))
    payload = request()
    payload["article"]["content"] = "This article is sponsored by Example Corp. " + (
        "Detailed architecture analysis. " * 20
    )

    evaluation = evaluator().evaluate(payload)["qualityEvaluation"]

    assert evaluation["signals"]["advertisementSuspected"] is True
    assert evaluation["decision"] == "PASS"
    assert "ADVERTISEMENT_SUSPECTED" not in evaluation["rejectionCodes"]


@pytest.mark.parametrize(("stars_today", "expected_bonus"), [
    (None, None), (49, None), (50, 4), (150, 7), (300, 10),
])
def test_github_trending_bonus_uses_the_collected_daily_star_count(
    monkeypatch, stars_today, expected_bonus,
):
    for method in ("evaluate_developer_relevance", "evaluate_technical_depth_llm",
                   "evaluate_timeliness", "evaluate_article_quality"):
        monkeypatch.setattr(QualityEvaluator, method, staticmethod(lambda *args, **kwargs: 65))
    payload = request()
    payload["source"]["sourceId"] = "github-trending"
    if stars_today is not None:
        payload["article"]["starsToday"] = stars_today
    evaluation = evaluator().evaluate(payload)["qualityEvaluation"]
    assert evaluation["score"]["dimensions"]["communityBonus"] == expected_bonus
    assert evaluation["score"]["overall"] == 65 + (expected_bonus or 0)
    assert evaluation["decision"] == (
        "PASS" if 65 + (expected_bonus or 0) >= 70 else "REVIEW_REQUIRED"
    )


@pytest.mark.parametrize("source_id,engagement", [
    ("hugging-face-blog", {"likes": 1000}),
    ("infoq", {"views": 10000, "comments": 100}),
    ("sdtimes", {"views": 10000, "comments": 100}),
])
def test_uncollected_or_incomparable_source_metrics_do_not_get_a_bonus(
    monkeypatch, source_id, engagement,
):
    for method in ("evaluate_developer_relevance", "evaluate_technical_depth_llm",
                   "evaluate_timeliness", "evaluate_article_quality"):
        monkeypatch.setattr(QualityEvaluator, method, staticmethod(lambda *args, **kwargs: 65))
    payload = request()
    payload["source"]["sourceId"] = source_id
    payload["article"].update(engagement)
    evaluation = evaluator().evaluate(payload)["qualityEvaluation"]
    assert evaluation["score"]["dimensions"]["communityBonus"] is None
    assert evaluation["score"]["overall"] == 65
