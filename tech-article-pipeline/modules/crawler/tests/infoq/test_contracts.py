from __future__ import annotations

import unittest
from datetime import datetime

from technical_news_pipeline.cli import build_request
from technical_news_pipeline.contracts import (
    ContractValidationError,
    CrawlOptions,
    CrawlRequest,
    NormalizationOptions,
)
from technical_news_pipeline.ids import new_crawl_run_id


class ContractTests(unittest.TestCase):
    def test_crawl_request_uses_exact_camel_case_contract_fields(self) -> None:
        payload = build_request("news", 3, 72).to_dict()

        self.assertEqual(
            set(payload),
            {"schemaVersion", "messageType", "crawlRunId", "requestedAt", "source", "crawlOptions"},
        )
        self.assertEqual(payload["schemaVersion"], "1.0")
        self.assertEqual(payload["messageType"], "CrawlRequested")
        self.assertEqual(
            set(payload["source"]),
            {"sourceId", "sourceType", "baseUrl", "entryPoint"},
        )
        self.assertEqual(
            set(payload["crawlOptions"]),
            {
                "maximumArticleCount",
                "maximumAgeHours",
                "followPagination",
                "maximumPageCount",
                "requestTimeoutMs",
            },
        )
        datetime.fromisoformat(payload["requestedAt"].replace("Z", "+00:00"))
        self.assertEqual(build_request("news", 3, 72).from_dict(payload).to_dict(), payload)

    def test_required_contract_fields_are_not_defaulted(self) -> None:
        payload = build_request("news", 3, 72).to_dict()
        payload.pop("schemaVersion")
        with self.assertRaises(ContractValidationError):
            CrawlRequest.from_dict(payload)

        payload = build_request("news", 3, 72).to_dict()
        payload["messageType"] = "CRAWL_REQUESTED"
        with self.assertRaises(ContractValidationError):
            CrawlRequest.from_dict(payload)

        payload = build_request("news", 3, 72).to_dict()
        payload["requestedAt"] = 123
        with self.assertRaises(ContractValidationError):
            CrawlRequest.from_dict(payload)

        payload = build_request("news", 3, 72).to_dict()
        payload["crawlOptions"].pop("followPagination")
        with self.assertRaises(ContractValidationError):
            CrawlRequest.from_dict(payload)

    def test_crawl_options_validate_contract_ranges(self) -> None:
        with self.assertRaises(ContractValidationError):
            CrawlOptions(maximum_article_count=0)
        with self.assertRaises(ContractValidationError):
            CrawlOptions(maximum_article_count=1, request_timeout_ms=999)
        with self.assertRaises(ContractValidationError):
            CrawlOptions(maximum_article_count=True)
        with self.assertRaises(ContractValidationError):
            CrawlOptions(maximum_article_count=1, maximum_page_count=None)  # type: ignore[arg-type]

    def test_normalization_options_validate_boolean_fields(self) -> None:
        with self.assertRaises(ContractValidationError):
            NormalizationOptions(remove_boilerplate="true")  # type: ignore[arg-type]
        with self.assertRaisesRegex(ContractValidationError, "normalizeWhitespace must be true"):
            NormalizationOptions(normalize_whitespace=False)
        with self.assertRaisesRegex(ContractValidationError, "resolveCanonicalUrl must be true"):
            NormalizationOptions(resolve_canonical_url=False)

    def test_run_ids_are_unique_within_the_same_day(self) -> None:
        ids = {new_crawl_run_id() for _ in range(1_000)}
        self.assertEqual(len(ids), 1_000)


if __name__ == "__main__":
    unittest.main()
