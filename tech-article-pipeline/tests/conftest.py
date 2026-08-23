from __future__ import annotations

from datetime import UTC, datetime

import pytest


@pytest.fixture
def normalized_payload():
    content = (
        "Python FastAPI 서버와 MySQL 데이터베이스를 Docker로 배포하는 개발 기사다. "
        "API 아키텍처와 보안, 테스트, 성능, 동시성 설계를 자세히 설명한다. "
        "Kubernetes 환경에서 Redis와 Kafka를 연결하고 pytest 회귀 테스트를 수행한다. "
        "개발자는 클라우드 운영 과정에서 발견한 문제와 오픈소스 해결 방법을 공유한다. "
        "백엔드 구현과 자동화된 배포가 팀의 소프트웨어 품질에 미친 영향도 분석한다."
    )
    return {
        "schemaVersion": "1.0",
        "crawlRunId": "run-1",
        "crawlItemId": "item-1",
        "source": {"sourceId": "example", "sourceType": "WEB_CRAWL"},
        "discovery": {},
        "urls": {
            "discoveredUrl": "https://example.com/a",
            "finalUrl": "https://example.com/a",
            "canonicalUrl": "https://example.com/a",
        },
        "article": {
            "title": "Python API architecture",
            "authors": ["TCP"],
            "originalPublishedAt": datetime.now(UTC).isoformat(),
            "content": content,
            "language": "ko",
        },
        "normalization": {
            "status": "SUCCESS",
            "normalizedAt": datetime.now(UTC).isoformat(),
            "normalizerVersion": "test-v1",
            "warnings": [],
            "error": None,
        },
        "duplicatePolicy": {
            "policyVersion": "duplicate-policy-v1",
            "checkCanonicalUrl": True,
            "checkContentHash": True,
            "checkTitleSimilarity": True,
            "duplicateTitleThreshold": 0.92,
            "possibleDuplicateThreshold": 0.80,
            "maximumCandidateCount": 100,
        },
        "qualityPolicy": {
            "policyVersion": "quality-policy-v1",
            "minimumEvaluationScore": 0,
            "reviewLowerBound": 0,
            "minimumContentLength": 200,
            "maximumContentLength": 10000,
            "allowedLanguages": ["ko", "en"],
            "rejectSpam": True,
            "rejectAdvertisements": True,
            "requireAdminReview": False,
        },
        "generationOptions": {
            "outputLanguage": "ko",
            "maximumSummaryLength": 500,
            "maximumOneLineSummaryLength": 100,
            "maximumTagCount": 3,
            "translateTitle": True,
            "translateContent": False,
        },
    }
