from __future__ import annotations

from contextlib import suppress
from datetime import UTC, datetime, timedelta
from typing import Any

from tech_articles_ingestion.article import CloudflareArticleExtractor
from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.contracts import ContractValidator
from tech_articles_ingestion.errors import ContractValidationError, IngestionError
from tech_articles_ingestion.hashing import json_sha256
from tech_articles_ingestion.http import SafeHttpClient
from tech_articles_ingestion.models import IngestionRunResult, RssItem, RunStatistics
from tech_articles_ingestion.normalization import ArticleNormalizer
from tech_articles_ingestion.payloads import (
    crawl_failure_payload,
    crawl_request_payload,
    crawl_run_completed_payload,
    crawl_success_payload,
    new_crawl_item_id,
    new_crawl_run_id,
    new_normalization_result_id,
    normalization_input_payload,
)
from tech_articles_ingestion.persistence import IngestionRepository
from tech_articles_ingestion.policy import CloudflarePolicyChecker
from tech_articles_ingestion.rss import CloudflareRssParser
from tech_articles_ingestion.sink import NormalizedArticleSink
from tech_articles_ingestion.timeutils import utc_iso, utc_now
from tech_articles_ingestion.urls import normalize_cloudflare_url


class CloudflareIngestionOrchestrator:
    def __init__(
        self,
        config: IngestionConfig,
        repository: IngestionRepository,
        *,
        sink: NormalizedArticleSink | None = None,
        http_client: SafeHttpClient | None = None,
        policy_checker: CloudflarePolicyChecker | None = None,
    ) -> None:
        config.validate()
        self._config = config
        self._repository = repository
        self._validator = ContractValidator()
        self._http = http_client or SafeHttpClient(config)
        self._policy = policy_checker or CloudflarePolicyChecker(config, self._http)
        self._rss_parser = CloudflareRssParser(config)
        self._article_extractor = CloudflareArticleExtractor()
        self._normalizer = ArticleNormalizer(config, self._validator)
        self._sink = sink

    async def run_once(
        self,
        *,
        requested_at: datetime | None = None,
        crawl_run_id: str | None = None,
    ) -> IngestionRunResult:
        requested_at = (requested_at or utc_now()).astimezone(UTC)
        started_at = utc_now()
        crawl_run_id = crawl_run_id or new_crawl_run_id(requested_at)
        request = crawl_request_payload(self._config, crawl_run_id, requested_at)
        statistics = RunStatistics()
        emitted_crawl_items: list[dict[str, Any]] = []
        normalized_articles: list[dict[str, Any]] = []
        await self._repository.start_run(
            crawl_run_id=crawl_run_id,
            source_id=self._config.source_id,
            requested_at=requested_at,
            started_at=started_at,
            crawler_version=self._config.crawler_version,
            request_payload=request,
        )

        terminal_error: IngestionError | None = None
        try:
            statistics.policy_checked_at = utc_iso(utc_now())
            try:
                await self._policy.ensure_allowed()
            except IngestionError:
                statistics.policy_allowed = False
                raise
            statistics.policy_allowed = True
            statistics.pages_visited += 1
            rss_response = await self._http.get(
                self._config.rss_url,
                accept="application/rss+xml, application/xml;q=0.9",
                allowed_content_types={"application/rss+xml", "application/xml", "text/xml"},
                error_prefix="RSS",
            )
            feed = self._rss_parser.parse(rss_response.body)
            statistics.rss_last_build_date = feed.last_build_date
            statistics.articles_discovered = len(feed.items)
            selected_indices, age_excluded = self._select_items(feed.items, requested_at)
            statistics.articles_excluded_by_age = len(age_excluded)

            for item in feed.items:
                if item.index in age_excluded:
                    await self._store_excluded_item(crawl_run_id, item, "EXCLUDED_BY_AGE")
                    continue
                if item.index not in selected_indices:
                    await self._store_excluded_item(crawl_run_id, item, "EXCLUDED_BY_LIMIT")
                    continue
                await self._process_item(
                    crawl_run_id=crawl_run_id,
                    item=item,
                    statistics=statistics,
                    emitted_crawl_items=emitted_crawl_items,
                    normalized_articles=normalized_articles,
                )
        except IngestionError as exc:
            terminal_error = exc
            statistics.articles_failed = max(
                statistics.articles_failed,
                statistics.articles_attempted - statistics.articles_succeeded,
            )
        except Exception as exc:
            terminal_error = IngestionError(
                code="CRAWL_RUN_UNEXPECTED_FAILURE",
                message="The crawl run failed unexpectedly.",
                retryable=False,
                stage="RSS_REQUEST",
                details={"exceptionType": type(exc).__name__},
            )
            statistics.articles_failed = max(
                statistics.articles_failed,
                statistics.articles_attempted - statistics.articles_succeeded,
            )

        status = self._run_status(statistics, terminal_error)
        completed_at = utc_now()
        completed_candidate = crawl_run_completed_payload(
            crawl_run_id,
            status,
            started_at,
            completed_at,
            statistics,
        )
        completed = self._validator.validate_crawl_run(
            completed_candidate, expected_run_id=crawl_run_id, round_trip=True
        )
        await self._repository.complete_run(
            crawl_run_id=crawl_run_id,
            status=status,
            completed_at=completed_at,
            official_payload=completed,
            official_statistics=statistics.official(),
            internal_statistics=statistics.internal(),
            error=terminal_error.to_internal_dict() if terminal_error else None,
        )
        return IngestionRunResult(
            crawl_run_completed=completed,
            crawl_items_produced=emitted_crawl_items,
            normalized_articles=normalized_articles,
        )

    async def _process_item(
        self,
        *,
        crawl_run_id: str,
        item: RssItem,
        statistics: RunStatistics,
        emitted_crawl_items: list[dict[str, Any]],
        normalized_articles: list[dict[str, Any]],
    ) -> None:
        crawl_item_id = new_crawl_item_id(crawl_run_id, item.index)
        discovered_url, validation_error = self._validate_required_item_fields(item)
        if validation_error is not None:
            statistics.articles_attempted += 1
            statistics.articles_failed += 1
            await self._repository.create_crawl_item(
                crawl_item_id=crawl_item_id,
                crawl_run_id=crawl_run_id,
                source_id=self._config.source_id,
                item=item,
                collection_state="INVALID",
                processing_status="DISCOVERED",
                discovered_url=discovered_url,
            )
            official_failure = None
            if discovered_url is not None:
                failure_candidate = crawl_failure_payload(
                    self._config,
                    crawl_run_id=crawl_run_id,
                    crawl_item_id=crawl_item_id,
                    discovered_url=discovered_url,
                    final_url=None,
                    crawled_at=utc_now(),
                    error=validation_error,
                )
                official_failure = self._try_validate_failure(
                    failure_candidate, crawl_run_id, crawl_item_id
                )
                if official_failure is not None:
                    emitted_crawl_items.append(official_failure)
                    statistics.crawl_items_emitted += 1
            await self._repository.save_crawl_result(
                crawl_item_id=crawl_item_id,
                processing_status="CRAWL_FAILED",
                final_url=None,
                canonical_url=None,
                http_status_code=None,
                official_payload=official_failure,
                error=validation_error.to_internal_dict(),
                crawled_at=utc_now(),
            )
            return

        assert item.guid is not None
        assert item.source_payload_hash is not None
        assert discovered_url is not None
        previous_state = await self._repository.get_source_state(self._config.source_id, item.guid)
        collection_state = self._classify(item.source_payload_hash, previous_state)
        await self._repository.observe_source_item(
            source_id=self._config.source_id,
            source_guid=item.guid,
            source_payload_hash=item.source_payload_hash,
            observed_at=utc_now(),
        )
        if collection_state == "UNCHANGED":
            statistics.articles_unchanged += 1
            await self._repository.create_crawl_item(
                crawl_item_id=crawl_item_id,
                crawl_run_id=crawl_run_id,
                source_id=self._config.source_id,
                item=item,
                collection_state="UNCHANGED",
                processing_status="SKIPPED",
                discovered_url=discovered_url,
            )
            return

        statistics.articles_attempted += 1
        await self._repository.create_crawl_item(
            crawl_item_id=crawl_item_id,
            crawl_run_id=crawl_run_id,
            source_id=self._config.source_id,
            item=item,
            collection_state=collection_state,
            processing_status="DISCOVERED",
            discovered_url=discovered_url,
        )
        statistics.pages_visited += 1
        try:
            article_response = await self._http.get(
                discovered_url,
                accept="text/html, application/xhtml+xml;q=0.9",
                allowed_content_types={"text/html", "application/xhtml+xml"},
                error_prefix="ARTICLE",
            )
            page = self._article_extractor.extract(
                article_response.body,
                discovered_url=discovered_url,
                final_url=article_response.url,
                http_status_code=article_response.status_code,
            )
            success_candidate = crawl_success_payload(
                self._config,
                crawl_run_id=crawl_run_id,
                crawl_item_id=crawl_item_id,
                rss_item=item,
                article=page,
            )
            crawl_output = self._validator.validate_crawl_item(
                success_candidate,
                expected_run_id=crawl_run_id,
                expected_item_id=crawl_item_id,
                round_trip=True,
            )
        except IngestionError as exc:
            await self._handle_crawl_failure(
                crawl_run_id=crawl_run_id,
                crawl_item_id=crawl_item_id,
                discovered_url=discovered_url,
                error=exc,
                statistics=statistics,
                emitted_crawl_items=emitted_crawl_items,
            )
            return

        await self._repository.save_crawl_result(
            crawl_item_id=crawl_item_id,
            processing_status="CRAWL_SUCCESS",
            final_url=crawl_output["urls"]["finalUrl"],
            canonical_url=crawl_output["urls"]["canonicalUrl"],
            http_status_code=crawl_output["crawl"]["httpStatusCode"],
            official_payload=crawl_output,
            error=None,
            crawled_at=self._parse_utc(crawl_output["crawl"]["crawledAt"]),
        )
        emitted_crawl_items.append(crawl_output)
        statistics.crawl_items_emitted += 1
        statistics.articles_succeeded += 1

        normalization_result_id = new_normalization_result_id()
        try:
            normalization_input = normalization_input_payload(crawl_output)
            normalized = self._normalizer.normalize(normalization_input)
            normalized_at = self._parse_utc(normalized["normalization"]["normalizedAt"])
            await self._repository.save_normalization_success(
                normalization_result_id=normalization_result_id,
                crawl_item_id=crawl_item_id,
                source_id=self._config.source_id,
                source_guid=item.guid,
                source_payload_hash=item.source_payload_hash,
                normalizer_version=self._config.normalizer_version,
                normalized_payload=normalized,
                normalized_payload_hash=json_sha256(normalized),
                warnings=normalized["normalization"]["warnings"],
                normalized_at=normalized_at,
            )
        except IngestionError as exc:
            statistics.normalizations_failed += 1
            await self._store_normalization_failure(
                normalization_result_id,
                crawl_item_id,
                exc,
            )
            return

        statistics.normalizations_succeeded += 1
        normalized_articles.append(normalized)
        if self._sink is not None:
            await self._deliver(normalization_result_id, normalized)

    async def _handle_crawl_failure(
        self,
        *,
        crawl_run_id: str,
        crawl_item_id: str,
        discovered_url: str,
        error: IngestionError,
        statistics: RunStatistics,
        emitted_crawl_items: list[dict[str, Any]],
    ) -> None:
        statistics.articles_failed += 1
        failure_candidate = crawl_failure_payload(
            self._config,
            crawl_run_id=crawl_run_id,
            crawl_item_id=crawl_item_id,
            discovered_url=discovered_url,
            final_url=None,
            crawled_at=utc_now(),
            error=error,
        )
        official_failure = self._try_validate_failure(
            failure_candidate, crawl_run_id, crawl_item_id
        )
        if official_failure is not None:
            emitted_crawl_items.append(official_failure)
            statistics.crawl_items_emitted += 1
        await self._repository.save_crawl_result(
            crawl_item_id=crawl_item_id,
            processing_status=(
                "CRAWL_OUTPUT_INVALID"
                if isinstance(error, ContractValidationError)
                else "CRAWL_FAILED"
            ),
            final_url=None,
            canonical_url=None,
            http_status_code=error.http_status_code,
            official_payload=official_failure,
            error=error.to_internal_dict(),
            crawled_at=utc_now(),
        )

    async def _store_normalization_failure(
        self,
        normalization_result_id: str,
        crawl_item_id: str,
        error: IngestionError,
    ) -> None:
        await self._repository.save_normalization_failure(
            normalization_result_id=normalization_result_id,
            crawl_item_id=crawl_item_id,
            normalizer_version=self._config.normalizer_version,
            failure_stage=error.stage or "NORMALIZATION",
            error=error.to_internal_dict(),
            failed_at=utc_now(),
        )

    async def _deliver(self, normalization_result_id: str, normalized: dict[str, Any]) -> None:
        assert self._sink is not None
        attempted_at = utc_now()
        try:
            await self._sink.emit(normalized)
        except Exception as exc:
            await self._repository.mark_duplicate_delivery(
                normalization_result_id=normalization_result_id,
                status="FAILED",
                attempted_at=attempted_at,
                error={
                    "code": "DUPLICATE_DELIVERY_FAILED",
                    "message": "The normalized article sink rejected the payload.",
                    "retryable": False,
                    "details": {"exceptionType": type(exc).__name__},
                },
            )
            return
        await self._repository.mark_duplicate_delivery(
            normalization_result_id=normalization_result_id,
            status="DELIVERED",
            attempted_at=attempted_at,
            error=None,
        )

    async def _store_excluded_item(
        self, crawl_run_id: str, item: RssItem, collection_state: str
    ) -> None:
        discovered_url: str | None = None
        if item.link:
            with suppress(IngestionError):
                discovered_url = normalize_cloudflare_url(item.link)
        await self._repository.create_crawl_item(
            crawl_item_id=new_crawl_item_id(crawl_run_id, item.index),
            crawl_run_id=crawl_run_id,
            source_id=self._config.source_id,
            item=item,
            collection_state=collection_state,
            processing_status="SKIPPED",
            discovered_url=discovered_url,
        )

    def _select_items(
        self, items: list[RssItem], requested_at: datetime
    ) -> tuple[set[int], set[int]]:
        boundary = requested_at - timedelta(hours=self._config.maximum_age_hours)
        age_excluded = {
            item.index
            for item in items
            if item.parsed_published_at is not None and item.parsed_published_at < boundary
        }
        eligible = [item for item in items if item.index not in age_excluded]
        eligible.sort(
            key=lambda item: (
                item.parsed_published_at is not None,
                item.parsed_published_at or datetime.min.replace(tzinfo=UTC),
                -item.index,
            ),
            reverse=True,
        )
        selected = {item.index for item in eligible[: self._config.maximum_article_count]}
        return selected, age_excluded

    @staticmethod
    def _validate_required_item_fields(
        item: RssItem,
    ) -> tuple[str | None, IngestionError | None]:
        if item.guid is None or not item.guid.strip():
            return None, IngestionError(
                code="RSS_REQUIRED_GUID_MISSING",
                message="The RSS item does not provide a guid.",
                stage="RSS_ITEM_VALIDATION",
            )
        if item.link is None or not item.link.strip():
            return None, IngestionError(
                code="RSS_REQUIRED_LINK_MISSING",
                message="The RSS item does not provide a link.",
                stage="RSS_ITEM_VALIDATION",
            )
        try:
            discovered_url = normalize_cloudflare_url(item.link)
        except IngestionError:
            return None, IngestionError(
                code="RSS_LINK_INVALID",
                message="The RSS item link is not an allowed Cloudflare URL.",
                stage="RSS_ITEM_VALIDATION",
            )
        if item.title is None or not item.title.strip():
            return discovered_url, IngestionError(
                code="RSS_REQUIRED_TITLE_MISSING",
                message="The RSS item does not provide a usable title.",
                stage="RSS_ITEM_VALIDATION",
            )
        return discovered_url, None

    @staticmethod
    def _classify(source_hash: str, previous_state: Any) -> str:
        if (
            previous_state is None
            or previous_state.last_successfully_normalized_payload_hash is None
        ):
            return "NEW"
        if previous_state.last_successfully_normalized_payload_hash == source_hash:
            return "UNCHANGED"
        return "CHANGED"

    def _try_validate_failure(
        self, candidate: dict[str, Any], crawl_run_id: str, crawl_item_id: str
    ) -> dict[str, Any] | None:
        try:
            return self._validator.validate_crawl_item(
                candidate,
                expected_run_id=crawl_run_id,
                expected_item_id=crawl_item_id,
                round_trip=True,
            )
        except ContractValidationError:
            return None

    @staticmethod
    def _run_status(statistics: RunStatistics, terminal_error: IngestionError | None) -> str:
        if terminal_error is not None:
            return "FAILED"
        if statistics.articles_failed == 0:
            return "COMPLETED"
        if statistics.articles_succeeded > 0 or statistics.articles_unchanged > 0:
            return "PARTIALLY_COMPLETED"
        return "FAILED"

    @staticmethod
    def _parse_utc(value: str) -> datetime:
        return datetime.fromisoformat(value[:-1] + "+00:00")
