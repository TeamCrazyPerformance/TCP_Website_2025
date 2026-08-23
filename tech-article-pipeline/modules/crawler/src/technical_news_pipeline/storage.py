from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Protocol

from .contracts import CrawlItemProduced, CrawlRequest, CrawlRunCompleted, iso_utc


class RawCrawlRepository(Protocol):
    def save_run_started(self, request: CrawlRequest) -> None: ...

    def save_item(self, item: CrawlItemProduced) -> None: ...

    def save_run_completed(self, completed: CrawlRunCompleted) -> None: ...


class InMemoryRawCrawlRepository:
    def __init__(self) -> None:
        self.runs: dict[str, dict] = {}
        self.items: dict[str, dict] = {}

    def save_run_started(self, request: CrawlRequest) -> None:
        self.runs[request.crawl_run_id] = {
            "request": request.to_dict(),
            "status": "RUNNING",
            "completed": None,
        }

    def save_item(self, item: CrawlItemProduced) -> None:
        if item.crawl_run_id not in self.runs:
            raise RuntimeError("crawl run must be stored before crawl items")
        self.items[item.crawl_item_id] = item.to_dict()

    def save_run_completed(self, completed: CrawlRunCompleted) -> None:
        run = self.runs.get(completed.crawl_run_id)
        if run is None:
            raise RuntimeError("crawl run must be stored before completion")
        run["status"] = completed.status.value
        run["completed"] = completed.to_dict()


class SQLiteRawCrawlRepository:
    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _initialize(self) -> None:
        with closing(self._connect()) as connection, connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS crawl_runs (
                    crawl_run_id TEXT PRIMARY KEY,
                    source_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    requested_at TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    statistics_json TEXT,
                    request_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS crawl_items (
                    crawl_item_id TEXT PRIMARY KEY,
                    crawl_run_id TEXT NOT NULL REFERENCES crawl_runs(crawl_run_id),
                    discovered_url TEXT NOT NULL,
                    final_url TEXT,
                    canonical_url TEXT,
                    crawl_status TEXT NOT NULL,
                    http_status_code INTEGER,
                    raw_content TEXT,
                    error_json TEXT,
                    payload_json TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_crawl_items_run_id
                    ON crawl_items(crawl_run_id);
                CREATE INDEX IF NOT EXISTS idx_crawl_items_canonical_url
                    ON crawl_items(canonical_url);
                """
            )

    def save_run_started(self, request: CrawlRequest) -> None:
        payload = request.to_dict()
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO crawl_runs (
                    crawl_run_id, source_id, status, requested_at, started_at, request_json
                ) VALUES (?, ?, 'RUNNING', ?, ?, ?)
                """,
                (
                    request.crawl_run_id,
                    request.source.source_id,
                    iso_utc(request.requested_at),
                    iso_utc(request.requested_at),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )

    def save_item(self, item: CrawlItemProduced) -> None:
        payload = item.to_dict()
        error = payload["crawl"]["error"]
        raw_content = payload["rawArticle"]["contentText"] if payload["rawArticle"] else None
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT INTO crawl_items (
                    crawl_item_id, crawl_run_id, discovered_url, final_url, canonical_url,
                    crawl_status, http_status_code, raw_content, error_json, payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.crawl_item_id,
                    item.crawl_run_id,
                    item.urls.discovered_url,
                    item.urls.final_url,
                    item.urls.canonical_url,
                    item.crawl.status.value,
                    item.crawl.http_status_code,
                    raw_content,
                    json.dumps(error, ensure_ascii=False) if error else None,
                    json.dumps(payload, ensure_ascii=False),
                ),
            )

    def save_run_completed(self, completed: CrawlRunCompleted) -> None:
        payload = completed.to_dict()
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute(
                """
                UPDATE crawl_runs
                SET status = ?, started_at = ?, completed_at = ?, statistics_json = ?
                WHERE crawl_run_id = ?
                """,
                (
                    completed.status.value,
                    iso_utc(completed.started_at),
                    iso_utc(completed.completed_at),
                    json.dumps(payload["statistics"], ensure_ascii=False),
                    completed.crawl_run_id,
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("crawl run was not stored before completion")
