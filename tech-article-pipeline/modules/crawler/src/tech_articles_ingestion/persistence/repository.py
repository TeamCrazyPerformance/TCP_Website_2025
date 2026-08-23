from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol

from tech_articles_ingestion.models import RssItem, SourceState


class IngestionRepository(Protocol):
    async def open(self) -> None: ...

    async def close(self) -> None: ...

    async def migrate(self) -> None: ...

    async def start_run(
        self,
        *,
        crawl_run_id: str,
        source_id: str,
        requested_at: datetime,
        started_at: datetime,
        crawler_version: str,
        request_payload: dict[str, Any],
    ) -> None: ...

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
    ) -> None: ...

    async def get_source_state(self, source_id: str, source_guid: str) -> SourceState | None: ...

    async def observe_source_item(
        self,
        *,
        source_id: str,
        source_guid: str,
        source_payload_hash: str,
        observed_at: datetime,
    ) -> None: ...

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
    ) -> None: ...

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
    ) -> None: ...

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
    ) -> None: ...

    async def save_normalization_failure(
        self,
        *,
        normalization_result_id: str,
        crawl_item_id: str,
        normalizer_version: str,
        failure_stage: str,
        error: dict[str, Any],
        failed_at: datetime,
    ) -> None: ...

    async def mark_duplicate_delivery(
        self,
        *,
        normalization_result_id: str,
        status: str,
        attempted_at: datetime,
        error: dict[str, Any] | None,
    ) -> None: ...
