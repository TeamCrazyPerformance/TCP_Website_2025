from __future__ import annotations

import copy
from datetime import datetime
from typing import Any

from tech_articles_ingestion.models import RssItem, SourceState


class InMemoryIngestionRepository:
    """Test repository that mirrors the PostgreSQL state transitions."""

    def __init__(self) -> None:
        self.runs: dict[str, dict[str, Any]] = {}
        self.items: dict[str, dict[str, Any]] = {}
        self.normalization_results: dict[str, dict[str, Any]] = {}
        self.source_states: dict[tuple[str, str], SourceState] = {}

    async def open(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def migrate(self) -> None:
        return None

    async def start_run(
        self,
        *,
        crawl_run_id: str,
        source_id: str,
        requested_at: datetime,
        started_at: datetime,
        crawler_version: str,
        request_payload: dict[str, Any],
    ) -> None:
        if any(
            run["source_id"] == source_id and run["status"] == "RUNNING"
            for run in self.runs.values()
        ):
            raise RuntimeError("source run already active")
        self.runs[crawl_run_id] = {
            "source_id": source_id,
            "requested_at": requested_at,
            "started_at": started_at,
            "status": "RUNNING",
            "crawler_version": crawler_version,
            "request_payload": copy.deepcopy(request_payload),
        }

    async def complete_run(
        self,
        *,
        crawl_run_id: str,
        status: str,
        completed_at: datetime,
        official_payload: dict[str, Any],
        official_statistics: dict[str, int],
        internal_statistics: dict[str, Any],
        error: dict[str, Any] | None,
    ) -> None:
        self.runs[crawl_run_id].update(
            {
                "status": status,
                "completed_at": completed_at,
                "official_payload": copy.deepcopy(official_payload),
                "official_statistics": copy.deepcopy(official_statistics),
                "internal_statistics": copy.deepcopy(internal_statistics),
                "error": copy.deepcopy(error),
            }
        )

    async def get_source_state(self, source_id: str, source_guid: str) -> SourceState | None:
        return self.source_states.get((source_id, source_guid))

    async def observe_source_item(
        self,
        *,
        source_id: str,
        source_guid: str,
        source_payload_hash: str,
        observed_at: datetime,
    ) -> None:
        key = (source_id, source_guid)
        self.source_states.setdefault(
            key,
            SourceState(
                source_id=source_id,
                source_guid=source_guid,
                last_successfully_normalized_payload_hash=None,
                state_version=0,
            ),
        )

    async def create_crawl_item(
        self,
        *,
        crawl_item_id: str,
        crawl_run_id: str,
        source_id: str,
        item: RssItem,
        collection_state: str,
        processing_status: str,
        discovered_url: str | None,
    ) -> None:
        self.items[crawl_item_id] = {
            "crawl_run_id": crawl_run_id,
            "source_id": source_id,
            "item": copy.deepcopy(item),
            "collection_state": collection_state,
            "processing_status": processing_status,
            "discovered_url": discovered_url,
        }

    async def save_crawl_result(
        self,
        *,
        crawl_item_id: str,
        processing_status: str,
        final_url: str | None,
        canonical_url: str | None,
        http_status_code: int | None,
        official_payload: dict[str, Any] | None,
        error: dict[str, Any] | None,
        crawled_at: datetime,
    ) -> None:
        self.items[crawl_item_id].update(
            {
                "processing_status": processing_status,
                "final_url": final_url,
                "canonical_url": canonical_url,
                "http_status_code": http_status_code,
                "official_payload": copy.deepcopy(official_payload),
                "error": copy.deepcopy(error),
                "crawled_at": crawled_at,
            }
        )

    async def save_normalization_success(
        self,
        *,
        normalization_result_id: str,
        crawl_item_id: str,
        source_id: str,
        source_guid: str,
        source_payload_hash: str,
        normalizer_version: str,
        normalized_payload: dict[str, Any],
        normalized_payload_hash: str,
        warnings: list[str],
        normalized_at: datetime,
    ) -> None:
        self.normalization_results[normalization_result_id] = {
            "crawl_item_id": crawl_item_id,
            "status": "SUCCESS",
            "normalizer_version": normalizer_version,
            "normalized_payload": copy.deepcopy(normalized_payload),
            "normalized_payload_hash": normalized_payload_hash,
            "warnings": list(warnings),
            "normalized_at": normalized_at,
            "duplicate_delivery_status": "NOT_ATTEMPTED",
        }
        self.items[crawl_item_id]["processing_status"] = "NORMALIZATION_SUCCESS"
        previous = self.source_states.get((source_id, source_guid))
        version = previous.state_version if previous else 0
        self.source_states[(source_id, source_guid)] = SourceState(
            source_id=source_id,
            source_guid=source_guid,
            last_successfully_normalized_payload_hash=source_payload_hash,
            state_version=version + 1,
        )

    async def save_normalization_failure(
        self,
        *,
        normalization_result_id: str,
        crawl_item_id: str,
        normalizer_version: str,
        failure_stage: str,
        error: dict[str, Any],
        failed_at: datetime,
    ) -> None:
        self.normalization_results[normalization_result_id] = {
            "crawl_item_id": crawl_item_id,
            "status": "FAILED",
            "normalizer_version": normalizer_version,
            "failure_stage": failure_stage,
            "error": copy.deepcopy(error),
            "normalized_at": failed_at,
            "duplicate_delivery_status": "NOT_ATTEMPTED",
        }
        self.items[crawl_item_id]["processing_status"] = "NORMALIZATION_FAILED"

    async def mark_duplicate_delivery(
        self,
        *,
        normalization_result_id: str,
        status: str,
        attempted_at: datetime,
        error: dict[str, Any] | None,
    ) -> None:
        self.normalization_results[normalization_result_id].update(
            {
                "duplicate_delivery_status": status,
                "duplicate_delivery_attempted_at": attempted_at,
                "duplicate_delivery_error": copy.deepcopy(error),
            }
        )
