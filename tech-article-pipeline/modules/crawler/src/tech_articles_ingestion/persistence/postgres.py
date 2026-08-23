from __future__ import annotations

from datetime import datetime
from importlib.resources import files
from typing import Any

from psycopg.errors import DatabaseError, IntegrityError
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from tech_articles_ingestion.errors import PersistenceError
from tech_articles_ingestion.models import RssItem, SourceState


class PostgresIngestionRepository:
    def __init__(self, database_url: str) -> None:
        self._pool = AsyncConnectionPool(
            conninfo=database_url,
            min_size=1,
            max_size=4,
            open=False,
            kwargs={"row_factory": dict_row},
        )

    async def open(self) -> None:
        await self._pool.open()

    async def close(self) -> None:
        await self._pool.close()

    async def migrate(self) -> None:
        migration = (
            files("tech_articles_ingestion.persistence.migrations")
            .joinpath("001_create_ingestion_tables.sql")
            .read_text(encoding="utf-8")
        )
        async with self._pool.connection() as connection, connection.transaction():
            for statement in _split_sql_statements(migration):
                await connection.execute(statement)

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
        query = """
            INSERT INTO crawl_runs (
                crawl_run_id, source_id, requested_at, started_at, status,
                crawler_version, request_payload
            ) VALUES (%s, %s, %s, %s, 'RUNNING', %s, %s)
        """
        try:
            async with self._pool.connection() as connection:
                await connection.execute(
                    query,
                    (
                        crawl_run_id,
                        source_id,
                        requested_at,
                        started_at,
                        crawler_version,
                        Jsonb(request_payload),
                    ),
                )
        except IntegrityError as exc:
            raise PersistenceError(
                code="CRAWL_RUN_PERSISTENCE_FAILED",
                message="A crawl run is already active for this source.",
                retryable=False,
                stage="PERSISTENCE",
            ) from exc

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
        query = """
            UPDATE crawl_runs
            SET status = %s,
                completed_at = %s,
                official_completed_payload = %s,
                official_statistics = %s,
                internal_statistics = %s,
                error = %s,
                updated_at = now()
            WHERE crawl_run_id = %s AND status = 'RUNNING'
        """
        async with self._pool.connection() as connection:
            cursor = await connection.execute(
                query,
                (
                    status,
                    completed_at,
                    Jsonb(official_payload),
                    Jsonb(official_statistics),
                    Jsonb(internal_statistics),
                    Jsonb(error) if error is not None else None,
                    crawl_run_id,
                ),
            )
            if cursor.rowcount != 1:
                raise PersistenceError(
                    code="CRAWL_RUN_PERSISTENCE_FAILED",
                    message="The active crawl run could not be completed.",
                    stage="PERSISTENCE",
                )

    async def get_source_state(self, source_id: str, source_guid: str) -> SourceState | None:
        query = """
            SELECT source_id, source_guid,
                   last_successfully_normalized_payload_hash,
                   state_version
            FROM cloudflare_source_states
            WHERE source_id = %s AND source_guid = %s
        """
        async with self._pool.connection() as connection:
            cursor = await connection.execute(query, (source_id, source_guid))
            row = await cursor.fetchone()
        if row is None:
            return None
        return SourceState(
            source_id=row["source_id"],
            source_guid=row["source_guid"],
            last_successfully_normalized_payload_hash=row[
                "last_successfully_normalized_payload_hash"
            ],
            state_version=row["state_version"],
        )

    async def observe_source_item(
        self,
        *,
        source_id: str,
        source_guid: str,
        source_payload_hash: str,
        observed_at: datetime,
    ) -> None:
        query = """
            INSERT INTO cloudflare_source_states (
                source_id, source_guid, last_observed_payload_hash, last_observed_at
            ) VALUES (%s, %s, %s, %s)
            ON CONFLICT (source_id, source_guid) DO UPDATE
            SET last_observed_payload_hash = EXCLUDED.last_observed_payload_hash,
                last_observed_at = EXCLUDED.last_observed_at,
                updated_at = now()
        """
        async with self._pool.connection() as connection:
            await connection.execute(
                query, (source_id, source_guid, source_payload_hash, observed_at)
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
        query = """
            INSERT INTO crawl_items (
                crawl_item_id, crawl_run_id, source_id, source_guid,
                rss_item_index, source_payload_hash, collection_state,
                processing_status, discovered_url, rss_payload
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        try:
            async with self._pool.connection() as connection:
                await connection.execute(
                    query,
                    (
                        crawl_item_id,
                        crawl_run_id,
                        source_id,
                        item.guid,
                        item.index,
                        item.source_payload_hash,
                        collection_state,
                        processing_status,
                        discovered_url,
                        Jsonb(item.internal_payload()),
                    ),
                )
        except DatabaseError as exc:
            raise PersistenceError(
                code="CRAWL_ITEM_PERSISTENCE_FAILED",
                message="The crawl item could not be stored.",
                stage="PERSISTENCE",
            ) from exc

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
        query = """
            UPDATE crawl_items
            SET processing_status = %s,
                final_url = %s,
                canonical_url = %s,
                http_status_code = %s,
                official_crawl_output_payload = %s,
                crawl_error = %s,
                crawled_at = %s,
                updated_at = now()
            WHERE crawl_item_id = %s
        """
        async with self._pool.connection() as connection:
            cursor = await connection.execute(
                query,
                (
                    processing_status,
                    final_url,
                    canonical_url,
                    http_status_code,
                    Jsonb(official_payload) if official_payload is not None else None,
                    Jsonb(error) if error is not None else None,
                    crawled_at,
                    crawl_item_id,
                ),
            )
            if cursor.rowcount != 1:
                raise PersistenceError(
                    code="CRAWL_ITEM_PERSISTENCE_FAILED",
                    message="The crawl result could not be stored.",
                    stage="PERSISTENCE",
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
        try:
            async with self._pool.connection() as connection, connection.transaction():
                await connection.execute(
                    """
                        INSERT INTO cloudflare_source_states (source_id, source_guid)
                        VALUES (%s, %s)
                        ON CONFLICT (source_id, source_guid) DO NOTHING
                        """,
                    (source_id, source_guid),
                )
                await connection.execute(
                    """
                        SELECT state_version
                        FROM cloudflare_source_states
                        WHERE source_id = %s AND source_guid = %s
                        FOR UPDATE
                        """,
                    (source_id, source_guid),
                )
                await connection.execute(
                    """
                        INSERT INTO crawl_item_normalization_results (
                            normalization_result_id, crawl_item_id, attempt, status,
                            normalizer_version, normalized_payload,
                            normalized_payload_hash, warnings, normalized_at,
                            duplicate_delivery_status
                        ) VALUES (%s, %s, 1, 'SUCCESS', %s, %s, %s, %s, %s, 'NOT_ATTEMPTED')
                        """,
                    (
                        normalization_result_id,
                        crawl_item_id,
                        normalizer_version,
                        Jsonb(normalized_payload),
                        normalized_payload_hash,
                        Jsonb(warnings),
                        normalized_at,
                    ),
                )
                item_cursor = await connection.execute(
                    """
                        UPDATE crawl_items
                        SET processing_status = 'NORMALIZATION_SUCCESS', updated_at = now()
                        WHERE crawl_item_id = %s
                        """,
                    (crawl_item_id,),
                )
                if item_cursor.rowcount != 1:
                    raise PersistenceError(
                        code="NORMALIZATION_RESULT_PERSISTENCE_FAILED",
                        message="The source crawl item does not exist.",
                        stage="PERSISTENCE",
                    )
                state_cursor = await connection.execute(
                    """
                        UPDATE cloudflare_source_states
                        SET last_observed_payload_hash = %s,
                            last_observed_at = %s,
                            last_successfully_normalized_payload_hash = %s,
                            last_successful_crawl_item_id = %s,
                            last_successful_normalization_result_id = %s,
                            last_successfully_normalized_at = %s,
                            state_version = state_version + 1,
                            updated_at = now()
                        WHERE source_id = %s AND source_guid = %s
                        """,
                    (
                        source_payload_hash,
                        normalized_at,
                        source_payload_hash,
                        crawl_item_id,
                        normalization_result_id,
                        normalized_at,
                        source_id,
                        source_guid,
                    ),
                )
                if state_cursor.rowcount != 1:
                    raise PersistenceError(
                        code="SOURCE_STATE_UPDATE_FAILED",
                        message="The source state could not be updated.",
                        stage="PERSISTENCE",
                    )
        except PersistenceError:
            raise
        except DatabaseError as exc:
            raise PersistenceError(
                code="NORMALIZATION_RESULT_PERSISTENCE_FAILED",
                message="The normalization result transaction failed.",
                stage="PERSISTENCE",
            ) from exc

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
        try:
            async with self._pool.connection() as connection, connection.transaction():
                await connection.execute(
                    """
                        INSERT INTO crawl_item_normalization_results (
                            normalization_result_id, crawl_item_id, attempt, status,
                            failure_stage, normalizer_version, error, normalized_at,
                            duplicate_delivery_status
                        ) VALUES (%s, %s, 1, 'FAILED', %s, %s, %s, %s, 'NOT_ATTEMPTED')
                        """,
                    (
                        normalization_result_id,
                        crawl_item_id,
                        failure_stage,
                        normalizer_version,
                        Jsonb(error),
                        failed_at,
                    ),
                )
                await connection.execute(
                    """
                        UPDATE crawl_items
                        SET processing_status = 'NORMALIZATION_FAILED', updated_at = now()
                        WHERE crawl_item_id = %s
                        """,
                    (crawl_item_id,),
                )
        except DatabaseError as exc:
            raise PersistenceError(
                code="NORMALIZATION_RESULT_PERSISTENCE_FAILED",
                message="The normalization failure could not be stored.",
                stage="PERSISTENCE",
            ) from exc

    async def mark_duplicate_delivery(
        self,
        *,
        normalization_result_id: str,
        status: str,
        attempted_at: datetime,
        error: dict[str, Any] | None,
    ) -> None:
        query = """
            UPDATE crawl_item_normalization_results
            SET duplicate_delivery_status = %s,
                duplicate_delivery_attempted_at = %s,
                duplicate_delivery_error = %s,
                updated_at = now()
            WHERE normalization_result_id = %s AND status = 'SUCCESS'
        """
        async with self._pool.connection() as connection:
            await connection.execute(
                query,
                (
                    status,
                    attempted_at,
                    Jsonb(error) if error is not None else None,
                    normalization_result_id,
                ),
            )


def _split_sql_statements(sql: str) -> list[str]:
    return [statement.strip() for statement in sql.split(";") if statement.strip()]
