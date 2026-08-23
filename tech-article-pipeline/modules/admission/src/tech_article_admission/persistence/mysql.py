from __future__ import annotations

import json
from contextlib import AbstractContextManager
from datetime import UTC, date, datetime, timedelta
from typing import Any

from ..config import MySQLSettings
from ..constants import (
    CONTENT_NORMALIZATION_VERSION,
    FINGERPRINT_VERSION,
    GLOBAL_LOCK_NAME,
    SCHEMA_MIGRATION_VERSION,
)
from ..digests import url_sha256
from ..domain.models import CandidateBatch, DecisionResult, PreparedAdmission, ReferenceRecord
from ..errors import AdmissionError
from ..fingerprints import Fingerprint


class _MySQLTransaction(AbstractContextManager["_MySQLTransaction"]):
    def __init__(self, pool: MySQLConnectionPool) -> None:
        self._pool = pool
        self.connection: Any = None

    def __enter__(self) -> _MySQLTransaction:
        try:
            self.connection = self._pool.get_connection()
            self.connection.autocommit = False
            cursor = self.connection.cursor()
            try:
                cursor.execute("SET SESSION time_zone = '+00:00'")
                cursor.execute(
                    "SET SESSION sql_mode = "
                    "'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
                )
            finally:
                cursor.close()
            self.connection.start_transaction(isolation_level="READ COMMITTED")
            return self
        except AdmissionError:
            if self.connection is not None:
                self.connection.close()
            raise
        except Exception as exc:
            if self.connection is not None:
                self.connection.close()
            raise self._pool.persistence_error(exc) from exc

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> bool:
        assert self.connection is not None
        try:
            if exc_type is None:
                self.connection.commit()
            else:
                self.connection.rollback()
        except Exception as transaction_error:
            raise self._pool.persistence_error(transaction_error) from transaction_error
        finally:
            self.connection.close()
        if exc_type is not None and not issubclass(exc_type, AdmissionError):
            raise self._pool.persistence_error(exc) from exc
        return False


class MySQLConnectionPool:
    def __init__(self, settings: MySQLSettings) -> None:
        settings.validate()
        try:
            from mysql.connector import Error as MySQLError
            from mysql.connector.pooling import MySQLConnectionPool as ConnectorPool
        except ModuleNotFoundError as exc:
            raise AdmissionError(
                code="CONFIGURATION_ERROR",
                message="mysql-connector-python is required for the MySQL adapter.",
            ) from exc
        self._error_type = MySQLError
        try:
            self._pool = ConnectorPool(
                pool_name=settings.pool_name,
                pool_size=settings.pool_size,
                pool_reset_session=True,
                host=settings.host,
                port=settings.port,
                user=settings.user,
                password=settings.password,
                database=settings.database,
                connection_timeout=settings.connect_timeout_seconds,
                charset="utf8mb4",
                collation="utf8mb4_0900_ai_ci",
                use_unicode=True,
            )
        except Exception as exc:
            raise self.persistence_error(exc) from exc

    def get_connection(self) -> Any:
        try:
            return self._pool.get_connection()
        except Exception as exc:
            raise self.persistence_error(exc) from exc

    def persistence_error(self, exc: BaseException) -> AdmissionError:
        details: dict[str, Any] = {"exceptionType": type(exc).__name__}
        errno = getattr(exc, "errno", None)
        if isinstance(errno, int):
            details["databaseErrorNumber"] = errno
        if errno == 1205:
            return AdmissionError(
                code="ADMISSION_LOCK_TIMEOUT",
                message="The MySQL admission lock timed out.",
                retryable=True,
                details=details,
            )
        if errno == 1213:
            return AdmissionError(
                code="ADMISSION_DEADLOCK",
                message="MySQL rolled back the admission because of a deadlock.",
                retryable=True,
                details=details,
            )
        return AdmissionError(
            code="PERSISTENCE_ERROR",
            message="The MySQL operation failed.",
            retryable=True,
            details=details,
        )


class MySQLAdmissionRepository:
    def __init__(self, pool: MySQLConnectionPool) -> None:
        self._pool = pool

    def transaction(self) -> _MySQLTransaction:
        return _MySQLTransaction(self._pool)

    def check_readiness(self) -> None:
        connection = self._pool.get_connection()
        try:
            cursor = connection.cursor(dictionary=True)
            try:
                cursor.execute(
                    "SELECT version FROM tech_article_schema_migrations "
                    "WHERE version = %s",
                    (SCHEMA_MIGRATION_VERSION,),
                )
                if cursor.fetchone() is None:
                    raise AdmissionError(
                        code="SERVICE_NOT_READY",
                        message="The required MySQL admission migration is not applied.",
                        retryable=True,
                    )
            finally:
                cursor.close()
        except AdmissionError:
            raise
        except Exception as exc:
            raise self._pool.persistence_error(exc) from exc
        finally:
            connection.close()

    def acquire_global_lock(self, tx: _MySQLTransaction) -> None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT lock_name FROM pipeline_locks WHERE lock_name = %s FOR UPDATE",
                (GLOBAL_LOCK_NAME,),
            )
            if cursor.fetchone() is None:
                raise AdmissionError(
                    code="SERVICE_NOT_READY",
                    message="The admission global lock row is missing.",
                    retryable=True,
                )
        finally:
            cursor.close()

    def load_candidates(
        self, tx: _MySQLTransaction, prepared: PreparedAdmission
    ) -> CandidateBatch:
        self._assert_corpus_integrity(tx)
        policy = prepared.request["duplicatePolicy"]
        incoming = prepared.fingerprint
        exact_ids: set[str] = set()

        cursor = tx.connection.cursor(dictionary=True)
        try:
            if policy["checkContentHash"]:
                cursor.execute(
                    "SELECT article_id FROM article_fingerprints "
                    "WHERE fingerprint_version = %s AND content_sha256 = %s",
                    (FINGERPRINT_VERSION, incoming.content_sha256),
                )
                exact_ids.update(row["article_id"] for row in cursor.fetchall())

            if policy["checkCanonicalUrl"]:
                canonical_hash = url_sha256(prepared.request["urls"]["canonicalUrl"])
                final_hash = url_sha256(prepared.request["urls"].get("finalUrl"))
                if final_hash is None:
                    cursor.execute(
                        "SELECT article_id FROM articles WHERE canonical_url_sha256 = %s",
                        (canonical_hash,),
                    )
                else:
                    cursor.execute(
                        "SELECT article_id FROM articles "
                        "WHERE canonical_url_sha256 = %s OR final_url_sha256 = %s",
                        (canonical_hash, final_hash),
                    )
                exact_ids.update(row["article_id"] for row in cursor.fetchall())

            predicates = " OR ".join(
                "(b.band_index = %s AND b.bucket_hash = %s)" for _ in incoming.buckets
            )
            parameters: list[Any] = [FINGERPRINT_VERSION]
            for index, bucket in enumerate(incoming.buckets):
                parameters.extend((index, bucket))
            age_clause = ""
            age_days = policy.get("candidateMaximumAgeDays")
            if age_days is not None:
                age_clause = (
                    " AND COALESCE(a.original_published_at, a.created_at) >= %s"
                )
                cutoff = prepared.prepared_at - timedelta(days=age_days)
                parameters.append(_db_time(cutoff))
            parameters.append(policy["maximumCandidateCount"] + 1)
            cursor.execute(
                "SELECT b.article_id, COUNT(*) AS band_match_count "
                "FROM article_lsh_buckets b "
                "JOIN articles a ON a.article_id = b.article_id "
                "WHERE b.fingerprint_version = %s AND ("
                + predicates
                + ")"
                + age_clause
                + " GROUP BY b.article_id "
                "ORDER BY band_match_count DESC, b.article_id ASC LIMIT %s",
                tuple(parameters),
            )
            lsh_rows = cursor.fetchall()
        finally:
            cursor.close()

        maximum = policy["maximumCandidateCount"]
        truncated = len(lsh_rows) > maximum
        band_counts = {
            row["article_id"]: int(row["band_match_count"])
            for row in lsh_rows[:maximum]
        }
        candidate_ids = exact_ids | set(band_counts)
        records = self._fetch_reference_records(tx, candidate_ids, band_counts)
        return CandidateBatch(records=records, truncated=truncated)

    def _assert_corpus_integrity(self, tx: _MySQLTransaction) -> None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT a.article_id, COUNT(DISTINCT f.fingerprint_version) AS fp_count, "
                "COUNT(b.band_index) AS bucket_count, "
                "SUM(f.content_version <> a.content_version) AS version_mismatch "
                "FROM articles a "
                "LEFT JOIN article_fingerprints f ON f.article_id = a.article_id "
                "AND f.fingerprint_version = %s "
                "LEFT JOIN article_lsh_buckets b ON b.article_id = f.article_id "
                "AND b.fingerprint_version = f.fingerprint_version "
                "GROUP BY a.article_id "
                "HAVING fp_count <> 1 OR bucket_count <> 16 OR version_mismatch <> 0 LIMIT 1",
                (FINGERPRINT_VERSION,),
            )
            invalid = cursor.fetchone()
            if invalid is not None:
                raise AdmissionError(
                    code="REFERENCE_CORPUS_INCOMPLETE",
                    message="A current article is missing its searchable fingerprint index.",
                    retryable=True,
                    details={"articleId": invalid["article_id"]},
                )
            cursor.execute(
                "SELECT HEX(content_sha256) AS content_hash "
                "FROM article_fingerprints WHERE fingerprint_version = %s "
                "GROUP BY content_sha256 HAVING COUNT(*) > 1 LIMIT 1",
                (FINGERPRINT_VERSION,),
            )
            duplicate_hash = cursor.fetchone()
            if duplicate_hash is not None:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="Multiple current articles share one content hash.",
                )
        finally:
            cursor.close()

    def _fetch_reference_records(
        self,
        tx: _MySQLTransaction,
        article_ids: set[str],
        band_counts: dict[str, int],
    ) -> tuple[ReferenceRecord, ...]:
        if not article_ids:
            return ()
        placeholders = ",".join("%s" for _ in article_ids)
        ids = tuple(sorted(article_ids))
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT a.article_id, a.title, a.content, a.canonical_url, a.final_url, "
                "a.original_published_at, a.created_at, a.content_version, "
                "f.fingerprint_version, f.content_normalization_version, "
                "f.content_version AS fingerprint_content_version, f.content_sha256, "
                "f.minhash_signature, f.shingle_count "
                "FROM articles a JOIN article_fingerprints f ON f.article_id = a.article_id "
                "AND f.fingerprint_version = %s "
                f"WHERE a.article_id IN ({placeholders})",
                (FINGERPRINT_VERSION, *ids),
            )
            rows = cursor.fetchall()
            cursor.execute(
                "SELECT article_id, band_index, bucket_hash FROM article_lsh_buckets "
                "WHERE fingerprint_version = %s "
                f"AND article_id IN ({placeholders}) ORDER BY article_id, band_index",
                (FINGERPRINT_VERSION, *ids),
            )
            bucket_rows = cursor.fetchall()
        finally:
            cursor.close()
        by_article: dict[str, list[bytes]] = {article_id: [] for article_id in ids}
        for row in bucket_rows:
            by_article[row["article_id"]].append(bytes(row["bucket_hash"]))
        records = [
            ReferenceRecord(
                article_id=row["article_id"],
                title=row["title"],
                content=row["content"],
                canonical_url=row["canonical_url"],
                final_url=row["final_url"],
                original_published_at=_utc_time(row["original_published_at"]),
                created_at=_utc_time(row["created_at"]),
                content_version=int(row["content_version"]),
                fingerprint_version=row["fingerprint_version"],
                content_normalization_version=row["content_normalization_version"],
                fingerprint_content_version=int(row["fingerprint_content_version"]),
                content_sha256=bytes(row["content_sha256"]),
                minhash_signature=bytes(row["minhash_signature"]),
                shingle_count=int(row["shingle_count"]),
                buckets=tuple(by_article[row["article_id"]]),
                band_match_count=band_counts.get(row["article_id"], 0),
            )
            for row in rows
        ]
        if len(records) != len(article_ids):
            missing = sorted(article_ids - {record.article_id for record in records})
            raise AdmissionError(
                code="REFERENCE_CORPUS_INCOMPLETE",
                message="A selected reference is missing its current fingerprint.",
                retryable=True,
                details={"articleIds": missing[:10]},
            )
        return tuple(sorted(records, key=lambda item: item.article_id))

    def find_check_by_request(
        self, tx: _MySQLTransaction, request_key: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT * FROM duplicate_checks WHERE request_key = %s",
                (request_key,),
            )
            row = cursor.fetchone()
            return None if row is None else _decode_check(row)
        finally:
            cursor.close()

    def find_article(
        self, tx: _MySQLTransaction, article_id: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM articles WHERE article_id = %s", (article_id,))
            row = cursor.fetchone()
            return None if row is None else _decode_article(row)
        finally:
            cursor.close()

    def deletion_audit_exists(self, tx: _MySQLTransaction, article_id: str) -> bool:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT deletion_request_id FROM article_deletion_audits "
                "WHERE article_id_snapshot = %s LIMIT 1",
                (article_id,),
            )
            return cursor.fetchone() is not None
        finally:
            cursor.close()

    def insert_check_processing(
        self,
        tx: _MySQLTransaction,
        *,
        check_id: str,
        request_key: str,
        check_kind: str,
        parent_check_id: str | None,
        prepared: PreparedAdmission,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO duplicate_checks ("
                "check_id, request_key, check_kind, parent_check_id, crawl_run_id, "
                "crawl_item_id, input_digest, status, decision, policy_version, "
                "fingerprint_version, content_sha256, matched_article_id, new_article_id, "
                "matched_by, candidates, candidate_search_status, error, checked_at"
                ") VALUES (%s,%s,%s,%s,%s,%s,%s,'PROCESSING',NULL,%s,%s,%s,"
                "NULL,NULL,NULL,NULL,NULL,NULL,NULL)",
                (
                    check_id,
                    request_key,
                    check_kind,
                    parent_check_id,
                    prepared.request["crawlRunId"],
                    prepared.request["crawlItemId"],
                    prepared.input_digest,
                    prepared.request["duplicatePolicy"]["policyVersion"],
                    prepared.fingerprint.version,
                    prepared.fingerprint.content_sha256,
                ),
            )
        finally:
            cursor.close()

    def complete_check(
        self,
        tx: _MySQLTransaction,
        *,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        checked_at: datetime,
        new_article_id: str | None,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "UPDATE duplicate_checks SET status='SUCCESS', decision=%s, "
                "matched_article_id=%s, new_article_id=%s, matched_by=%s, candidates=%s, "
                "candidate_search_status=%s, checked_at=%s "
                "WHERE check_id=%s AND status='PROCESSING'",
                (
                    decision.decision.value,
                    decision.matched_article_id,
                    new_article_id,
                    _json(list(decision.matched_by)),
                    _json([item.projection() for item in decision.candidates]),
                    decision.candidate_search_status,
                    _db_time(checked_at),
                    check_id,
                ),
            )
            if cursor.rowcount != 1:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="The duplicate check finalization state is invalid.",
                )
        finally:
            cursor.close()

    def allocate_article_id(self, tx: _MySQLTransaction, sequence_date: date) -> str:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT sequence_value FROM article_id_sequences "
                "WHERE sequence_date=%s FOR UPDATE",
                (sequence_date,),
            )
            row = cursor.fetchone()
            if row is None:
                value = 1
                cursor.execute(
                    "INSERT INTO article_id_sequences (sequence_date,sequence_value) "
                    "VALUES (%s,%s)",
                    (sequence_date, value),
                )
            else:
                value = int(row["sequence_value"]) + 1
                cursor.execute(
                    "UPDATE article_id_sequences SET sequence_value=%s "
                    "WHERE sequence_date=%s",
                    (value, sequence_date),
                )
        finally:
            cursor.close()
        if value > 999_999_999_999:
            raise AdmissionError(
                code="ARTICLE_ID_EXHAUSTED",
                message="The daily article ID sequence is exhausted.",
            )
        return f"article-{sequence_date:%Y%m%d}-{value:06d}"

    def insert_article(
        self,
        tx: _MySQLTransaction,
        *,
        article_id: str,
        origin_check_id: str,
        origin_resolution_request_id: str | None,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        request = prepared.request
        article = request["article"]
        urls = request["urls"]
        normalization = request.get("normalization") or {}
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO articles ("
                "article_id,origin_check_id,origin_resolution_request_id,crawl_run_id,"
                "crawl_item_id,ingest_input_digest,source_id,discovery,discovered_url,"
                "discovered_url_sha256,final_url,final_url_sha256,canonical_url,"
                "canonical_url_sha256,title,authors,content,language,original_published_at,"
                "normalizer_version,normalization_warnings,processing_status,review_status,"
                "publication_status,record_version,content_version,created_at,updated_at"
                ") VALUES ("
                "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,"
                "'INGESTED','NOT_REQUIRED','UNPUBLISHED',1,1,%s,%s)",
                (
                    article_id,
                    origin_check_id,
                    origin_resolution_request_id,
                    request["crawlRunId"],
                    request["crawlItemId"],
                    prepared.input_digest,
                    request["source"]["sourceId"],
                    _json_or_none(request.get("discovery")),
                    urls.get("discoveredUrl"),
                    url_sha256(urls.get("discoveredUrl")),
                    urls.get("finalUrl"),
                    url_sha256(urls.get("finalUrl")),
                    urls["canonicalUrl"],
                    url_sha256(urls["canonicalUrl"]),
                    article["title"],
                    _json(article["authors"]),
                    article["content"],
                    article["language"],
                    _db_time(_parse_time(article["originalPublishedAt"])),
                    normalization.get("normalizerVersion"),
                    _json_or_none(normalization.get("warnings")),
                    _db_time(created_at),
                    _db_time(created_at),
                ),
            )
        finally:
            cursor.close()

    def insert_fingerprint(
        self,
        tx: _MySQLTransaction,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        fingerprint = prepared.fingerprint
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO article_fingerprints ("
                "article_id,fingerprint_version,content_normalization_version,content_version,"
                "content_sha256,minhash_signature,shingle_count,created_at,updated_at"
                ") VALUES (%s,%s,%s,1,%s,%s,%s,%s,%s)",
                (
                    article_id,
                    fingerprint.version,
                    CONTENT_NORMALIZATION_VERSION,
                    fingerprint.content_sha256,
                    fingerprint.signature,
                    fingerprint.shingle_count,
                    _db_time(created_at),
                    _db_time(created_at),
                ),
            )
        finally:
            cursor.close()

    def insert_buckets(
        self,
        tx: _MySQLTransaction,
        *,
        article_id: str,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.executemany(
                "INSERT INTO article_lsh_buckets ("
                "article_id,fingerprint_version,band_index,bucket_hash,created_at"
                ") VALUES (%s,%s,%s,%s,%s)",
                [
                    (
                        article_id,
                        prepared.fingerprint.version,
                        index,
                        bucket,
                        _db_time(created_at),
                    )
                    for index, bucket in enumerate(prepared.fingerprint.buckets)
                ],
            )
            if cursor.rowcount != 16:
                raise AdmissionError(
                    code="FINGERPRINT_ARTIFACT_INVALID",
                    message="Exactly sixteen LSH buckets must be stored.",
                )
        finally:
            cursor.close()

    def insert_review_case(
        self,
        tx: _MySQLTransaction,
        *,
        review_case_id: str,
        check_id: str,
        prepared: PreparedAdmission,
        decision: DecisionResult,
        created_at: datetime,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO duplicate_review_cases ("
                "review_case_id,original_check_id,crawl_run_id,crawl_item_id,"
                "admission_input_digest,admission_payload,original_candidate_snapshot,status,"
                "case_version,created_at,updated_at"
                ") VALUES (%s,%s,%s,%s,%s,%s,%s,'PENDING',1,%s,%s)",
                (
                    review_case_id,
                    check_id,
                    prepared.request["crawlRunId"],
                    prepared.request["crawlItemId"],
                    prepared.input_digest,
                    _json(prepared.request),
                    _json([item.projection() for item in decision.candidates]),
                    _db_time(created_at),
                    _db_time(created_at),
                ),
            )
        finally:
            cursor.close()

    def find_review_by_original_check(
        self, tx: _MySQLTransaction, check_id: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT * FROM duplicate_review_cases WHERE original_check_id=%s",
                (check_id,),
            )
            row = cursor.fetchone()
            return None if row is None else _decode_review(row)
        finally:
            cursor.close()

    def find_review_case(
        self,
        tx: _MySQLTransaction,
        review_case_id: str,
        *,
        for_update: bool,
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            suffix = " FOR UPDATE" if for_update else ""
            cursor.execute(
                "SELECT * FROM duplicate_review_cases WHERE review_case_id=%s" + suffix,
                (review_case_id,),
            )
            row = cursor.fetchone()
            return None if row is None else _decode_review(row)
        finally:
            cursor.close()

    def find_resolution(
        self, tx: _MySQLTransaction, resolution_request_id: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT * FROM duplicate_review_resolutions WHERE resolution_request_id=%s",
                (resolution_request_id,),
            )
            row = cursor.fetchone()
            return None if row is None else _decode_resolution(row)
        finally:
            cursor.close()

    def insert_resolution_processing(
        self,
        tx: _MySQLTransaction,
        *,
        request: dict[str, Any],
        request_digest: bytes,
        requested_at: datetime,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO duplicate_review_resolutions ("
                "resolution_request_id,review_case_id,request_digest,expected_case_version,"
                "action,administrator_id,status,requested_at"
                ") VALUES (%s,%s,%s,%s,%s,%s,'PROCESSING',%s)",
                (
                    request["resolutionRequestId"],
                    request["reviewCaseId"],
                    request_digest,
                    request["expectedCaseVersion"],
                    request["action"],
                    request["administratorId"],
                    _db_time(requested_at),
                ),
            )
        finally:
            cursor.close()

    def complete_resolution(
        self,
        tx: _MySQLTransaction,
        *,
        resolution_request_id: str,
        status: str,
        final_decision: str | None,
        final_check_id: str | None,
        matched_article_id: str | None,
        new_article_id: str | None,
        error: dict[str, Any] | None,
        completed_at: datetime,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "UPDATE duplicate_review_resolutions SET status=%s,final_decision=%s,"
                "final_check_id=%s,matched_article_id=%s,new_article_id=%s,error=%s,"
                "completed_at=%s WHERE resolution_request_id=%s",
                (
                    status,
                    final_decision,
                    final_check_id,
                    matched_article_id,
                    new_article_id,
                    _json_or_none(error),
                    _db_time(completed_at),
                    resolution_request_id,
                ),
            )
        finally:
            cursor.close()

    def update_review_case(
        self,
        tx: _MySQLTransaction,
        *,
        review_case_id: str,
        status: str,
        case_version: int,
        candidate_snapshot: list[dict[str, Any]],
        resolved_at: datetime | None,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "UPDATE duplicate_review_cases SET status=%s,case_version=%s,"
                "original_candidate_snapshot=%s,resolved_at=%s,updated_at=CURRENT_TIMESTAMP(6) "
                "WHERE review_case_id=%s",
                (
                    status,
                    case_version,
                    _json(candidate_snapshot),
                    _db_time(resolved_at),
                    review_case_id,
                ),
            )
        finally:
            cursor.close()

    def find_deletion_audit(
        self, tx: _MySQLTransaction, deletion_request_id: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT * FROM article_deletion_audits WHERE deletion_request_id=%s",
                (deletion_request_id,),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            value = dict(row)
            value["deleted_at"] = _utc_time(value.get("deleted_at"))
            return value
        finally:
            cursor.close()

    def find_article_for_update(
        self, tx: _MySQLTransaction, article_id: str
    ) -> dict[str, Any] | None:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT * FROM articles WHERE article_id=%s FOR UPDATE",
                (article_id,),
            )
            row = cursor.fetchone()
            return None if row is None else _decode_article(row)
        finally:
            cursor.close()

    def insert_deletion_audit(
        self,
        tx: _MySQLTransaction,
        *,
        request: dict[str, Any],
        deleted_at: datetime,
    ) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO article_deletion_audits ("
                "deletion_request_id,article_id_snapshot,expected_record_version,"
                "administrator_id,reason_code,deleted_at"
                ") VALUES (%s,%s,%s,%s,%s,%s)",
                (
                    request["deletionRequestId"],
                    request["articleId"],
                    request["expectedRecordVersion"],
                    request["administratorId"],
                    request["reasonCode"],
                    _db_time(deleted_at),
                ),
            )
        finally:
            cursor.close()

    def purge_origin_review_payload(
        self,
        tx: _MySQLTransaction,
        *,
        origin_resolution_request_id: str | None,
        purged_at: datetime,
    ) -> None:
        if origin_resolution_request_id is None:
            return
        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "UPDATE duplicate_review_cases c "
                "JOIN duplicate_review_resolutions r "
                "ON r.review_case_id=c.review_case_id "
                "SET c.admission_payload=NULL,c.payload_purged_at=%s,"
                "c.updated_at=CURRENT_TIMESTAMP(6) "
                "WHERE r.resolution_request_id=%s",
                (_db_time(purged_at), origin_resolution_request_id),
            )
            if cursor.rowcount != 1:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="The article origin resolution has no review payload owner.",
                )
        finally:
            cursor.close()

    def delete_article(self, tx: _MySQLTransaction, article_id: str) -> None:
        cursor = tx.connection.cursor()
        try:
            cursor.execute("DELETE FROM articles WHERE article_id=%s", (article_id,))
            if cursor.rowcount != 1:
                raise AdmissionError(
                    code="ARTICLE_NOT_FOUND",
                    message="The article does not exist.",
                )
        finally:
            cursor.close()

    def list_backfill_candidates(
        self,
        tx: _MySQLTransaction,
        *,
        after_article_id: str,
        limit: int,
    ) -> tuple[dict[str, Any], ...]:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT a.article_id,a.content,a.content_version FROM articles a "
                "LEFT JOIN article_fingerprints f ON f.article_id=a.article_id "
                "AND f.fingerprint_version=%s "
                "WHERE a.article_id>%s AND f.article_id IS NULL "
                "ORDER BY a.article_id ASC LIMIT %s",
                (FINGERPRINT_VERSION, after_article_id, limit),
            )
            return tuple(dict(row) for row in cursor.fetchall())
        finally:
            cursor.close()

    def store_backfill_fingerprint(
        self,
        tx: _MySQLTransaction,
        *,
        article_id: str,
        expected_content_version: int,
        expected_content: str,
        fingerprint: Fingerprint,
        created_at: datetime,
    ) -> str:
        cursor = tx.connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT content,content_version FROM articles "
                "WHERE article_id=%s FOR UPDATE",
                (article_id,),
            )
            article = cursor.fetchone()
            if article is None:
                return "STALE"
            cursor.execute(
                "SELECT 1 AS present FROM article_fingerprints "
                "WHERE article_id=%s AND fingerprint_version=%s",
                (article_id, fingerprint.version),
            )
            if cursor.fetchone() is not None:
                return "NO_CHANGE"
            if (
                int(article["content_version"]) != expected_content_version
                or article["content"] != expected_content
            ):
                return "STALE"
            cursor.execute(
                "SELECT article_id FROM article_fingerprints "
                "WHERE fingerprint_version=%s AND content_sha256=%s LIMIT 1",
                (fingerprint.version, fingerprint.content_sha256),
            )
            duplicate = cursor.fetchone()
            if duplicate is not None:
                raise AdmissionError(
                    code="REFERENCE_DATA_INVALID",
                    message="Backfill found articles with the same normalized content hash.",
                    details={
                        "articleId": article_id,
                        "matchedArticleId": duplicate["article_id"],
                    },
                )
        finally:
            cursor.close()

        cursor = tx.connection.cursor()
        try:
            cursor.execute(
                "INSERT INTO article_fingerprints ("
                "article_id,fingerprint_version,content_normalization_version,content_version,"
                "content_sha256,minhash_signature,shingle_count,created_at,updated_at"
                ") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    article_id,
                    fingerprint.version,
                    CONTENT_NORMALIZATION_VERSION,
                    expected_content_version,
                    fingerprint.content_sha256,
                    fingerprint.signature,
                    fingerprint.shingle_count,
                    _db_time(created_at),
                    _db_time(created_at),
                ),
            )
            cursor.executemany(
                "INSERT INTO article_lsh_buckets ("
                "article_id,fingerprint_version,band_index,bucket_hash,created_at"
                ") VALUES (%s,%s,%s,%s,%s)",
                [
                    (
                        article_id,
                        fingerprint.version,
                        index,
                        bucket,
                        _db_time(created_at),
                    )
                    for index, bucket in enumerate(fingerprint.buckets)
                ],
            )
            if cursor.rowcount != 16:
                raise AdmissionError(
                    code="FINGERPRINT_ARTIFACT_INVALID",
                    message="Exactly sixteen LSH buckets must be stored.",
                )
        finally:
            cursor.close()
        return "CREATED"


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def _json_or_none(value: Any) -> str | None:
    return None if value is None else _json(value)


def _decode_json(value: Any) -> Any:
    if value is None or isinstance(value, (dict, list)):
        return value
    return json.loads(value)


def _decode_check(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    value["matched_by"] = _decode_json(value.get("matched_by"))
    value["candidates"] = _decode_json(value.get("candidates"))
    value["error"] = _decode_json(value.get("error"))
    value["checked_at"] = _utc_time(value.get("checked_at"))
    return value


def _decode_article(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    value["discovery"] = _decode_json(value.get("discovery"))
    value["authors"] = _decode_json(value.get("authors"))
    value["normalization_warnings"] = _decode_json(value.get("normalization_warnings"))
    value["original_published_at"] = _utc_time(value.get("original_published_at"))
    value["created_at"] = _utc_time(value.get("created_at"))
    value["updated_at"] = _utc_time(value.get("updated_at"))
    return value


def _decode_review(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    value["admission_payload"] = _decode_json(value.get("admission_payload"))
    value["original_candidate_snapshot"] = _decode_json(
        value.get("original_candidate_snapshot")
    )
    value["created_at"] = _utc_time(value.get("created_at"))
    value["resolved_at"] = _utc_time(value.get("resolved_at"))
    return value


def _decode_resolution(row: dict[str, Any]) -> dict[str, Any]:
    value = dict(row)
    value["error"] = _decode_json(value.get("error"))
    value["requested_at"] = _utc_time(value.get("requested_at"))
    value["completed_at"] = _utc_time(value.get("completed_at"))
    return value


def _parse_time(value: str | None) -> datetime | None:
    return None if value is None else datetime.fromisoformat(value[:-1] + "+00:00")


def _db_time(value: datetime | None) -> datetime | None:
    return None if value is None else value.astimezone(UTC).replace(tzinfo=None)


def _utc_time(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
