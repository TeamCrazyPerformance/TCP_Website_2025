from __future__ import annotations

import unittest
from datetime import datetime, timezone

from technical_news_pipeline.deduplication_v1 import (
    ExactDuplicateCheckService,
    InMemoryDuplicateArticleRepository,
    check_exact_duplicate,
    create_fingerprints,
)


POLICY = {
    "policyVersion": "duplicate-policy-v1",
    "checkCanonicalUrl": True,
    "checkContentHash": True,
}


def normalized(*, url: str | None = "https://example.com/new", title: str = "Python 3.15 is faster",
               content: str = "normalized article body", language: str = "en") -> dict:
    return {
        "crawlRunId": "crawl-run-1",
        "crawlItemId": "crawl-item-1",
        "source": {"sourceId": "infoq", "sourceType": "WEB_CRAWL"},
        "urls": {
            "discoveredUrl": "https://example.com/discovered",
            "finalUrl": "https://example.com/new",
            "canonicalUrl": url,
        },
        "article": {
            "title": title,
            "authors": ["John Doe"],
            "content": content,
            "language": language,
            "originalPublishedAt": "2026-08-01T09:30:00Z",
        },
        "normalization": {"status": "SUCCESS"},
    }


def record(article_id: str, *, url: str, content: str) -> dict:
    return {
        "articleId": article_id,
        "urls": {"canonicalUrl": url},
        "fingerprints": {"contentSha256": create_fingerprints(content).content_sha256},
    }


class DuplicateV1Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 2, 3, tzinfo=timezone.utc)

    def service(self, values: list[dict]) -> tuple[ExactDuplicateCheckService, InMemoryDuplicateArticleRepository]:
        repository = InMemoryDuplicateArticleRepository.from_dicts(values)
        return ExactDuplicateCheckService(repository, now=lambda: self.now), repository

    def test_fingerprint_contains_only_content_sha256(self) -> None:
        fingerprints = create_fingerprints("한글 English !@#")
        self.assertEqual(len(fingerprints.content_sha256), 64)
        self.assertEqual(set(fingerprints.to_dict()), {"contentSha256"})
        self.assertEqual(fingerprints, create_fingerprints("한글 English !@#"))
        self.assertNotEqual(fingerprints, create_fingerprints("한글 English !@?"))

    def test_existing_fingerprint_must_use_the_shared_sha256_format(self) -> None:
        with self.assertRaisesRegex(ValueError, "64 lowercase hexadecimal"):
            InMemoryDuplicateArticleRepository.from_dicts(
                [
                    {
                        "articleId": "old",
                        "canonicalUrl": "https://example.com/old",
                        "contentSha256": "sha256:not-the-shared-format",
                    }
                ]
            )

    def test_url_match_searches_all_records_and_short_circuits(self) -> None:
        service, repository = self.service([
            record("old", url="https://example.com/new", content="old")
        ])
        result = service.check(normalized(), POLICY)
        self.assertEqual(result["duplicateCheck"]["decision"], "DUPLICATE")
        self.assertEqual(result["duplicateCheck"]["matchedBy"], ["CANONICAL_URL"])
        self.assertEqual(
            result["duplicateCheck"]["candidates"],
            [{"articleId": "old", "matchedBy": ["CANONICAL_URL"]}],
        )
        self.assertEqual(repository.calls, {"canonicalUrl": 1, "contentSha256": 0})

    def test_content_hash_match_searches_all_records_and_short_circuits(self) -> None:
        service, repository = self.service([
            record("old", url="https://example.com/old", content="same body")
        ])
        result = service.check(normalized(content="same body"), POLICY)
        self.assertEqual(result["duplicateCheck"]["decision"], "DUPLICATE")
        self.assertEqual(result["duplicateCheck"]["matchedBy"], ["CONTENT_HASH"])
        self.assertEqual(repository.calls, {"canonicalUrl": 1, "contentSha256": 1})

    def test_no_exact_match_returns_the_approximate_check_handoff(self) -> None:
        service, repository = self.service([
            record("other", url="https://example.com/old", content="different body")
        ])
        result = service.check(normalized(), POLICY)
        self.assertNotIn("duplicateCheck", result)
        self.assertEqual(result["exactDuplicateCheck"]["decision"], "NO_EXACT_MATCH")
        self.assertEqual(result["exactDuplicateCheck"]["matchedBy"], [])
        self.assertEqual(result["article"]["content"], "normalized article body")
        self.assertEqual(result["article"]["title"], "Python 3.15 is faster")
        self.assertEqual(result["urls"]["canonicalUrl"], "https://example.com/new")
        self.assertEqual(set(result["fingerprints"]), {"contentSha256"})
        self.assertNotIn("candidates", result["exactDuplicateCheck"])
        self.assertEqual(repository.calls, {"canonicalUrl": 1, "contentSha256": 1})

    def test_disabled_checks_do_not_call_repository(self) -> None:
        service, repository = self.service([])
        disabled = dict(POLICY, checkCanonicalUrl=False, checkContentHash=False)
        result = service.check(normalized(), disabled)
        self.assertEqual(result["exactDuplicateCheck"]["decision"], "NO_EXACT_MATCH")
        self.assertEqual(repository.calls, {"canonicalUrl": 0, "contentSha256": 0})

    def test_convenience_adapter_uses_the_same_contract(self) -> None:
        result = check_exact_duplicate(normalized(), [], POLICY, checked_at=self.now)
        self.assertEqual(result["exactDuplicateCheck"]["decision"], "NO_EXACT_MATCH")

    def test_invalid_input_returns_failed_instead_of_handoff(self) -> None:
        service, _ = self.service([])
        result = service.check(normalized(content=""), POLICY)
        self.assertEqual(result["exactDuplicateCheck"]["status"], "FAILED")
        self.assertIsNone(result["exactDuplicateCheck"]["decision"])
        self.assertEqual(
            result["exactDuplicateCheck"]["error"]["code"], "INVALID_DUPLICATE_INPUT"
        )


if __name__ == "__main__":
    unittest.main()
