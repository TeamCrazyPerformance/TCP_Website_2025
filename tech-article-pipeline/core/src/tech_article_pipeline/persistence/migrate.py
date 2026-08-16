from __future__ import annotations

import hashlib
import os
from importlib.resources import files
from pathlib import Path

import mysql.connector
import sqlparse


def migration_directory() -> Path:
    configured = os.getenv("PIPELINE_MIGRATIONS_DIR")
    if configured:
        return Path(configured)
    source_tree = Path(__file__).resolve().parents[4] / "migrations"
    if source_tree.is_dir():
        return source_tree
    return Path(str(files("tech_article_pipeline").joinpath("migrations")))


def apply_migrations() -> None:
    connection = mysql.connector.connect(
        host=os.getenv("TECH_ARTICLE_MYSQL_HOST", "pipeline-mysql"),
        port=int(os.getenv("TECH_ARTICLE_MYSQL_PORT", "3306")),
        user=os.environ["TECH_ARTICLE_MYSQL_USER"],
        password=os.environ["TECH_ARTICLE_MYSQL_PASSWORD"],
        database=os.environ["TECH_ARTICLE_MYSQL_DATABASE"],
        autocommit=True,
        charset="utf8mb4",
        collation="utf8mb4_0900_ai_ci",
    )
    try:
        cursor = connection.cursor(dictionary=True)
        try:
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS pipeline_migration_history ("
                "version VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,"
                "filename VARCHAR(255) NOT NULL, checksum_sha256 CHAR(64) CHARACTER SET ascii "
                "COLLATE ascii_bin NOT NULL, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)"
                ") ENGINE=InnoDB"
            )
            for path in sorted(migration_directory().glob("[0-9][0-9][0-9]_*.sql")):
                version = path.name.split("_", 1)[0]
                content = path.read_text(encoding="utf-8")
                checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()
                cursor.execute(
                    "SELECT filename, checksum_sha256 FROM pipeline_migration_history "
                    "WHERE version = %s", (version,)
                )
                applied = cursor.fetchone()
                if applied:
                    if applied["filename"] != path.name or applied["checksum_sha256"] != checksum:
                        raise RuntimeError(f"Migration checksum mismatch for {version}")
                    continue
                for statement in sqlparse.split(content):
                    if statement.strip():
                        cursor.execute(statement)
                cursor.execute(
                    "INSERT INTO pipeline_migration_history (version, filename, checksum_sha256) "
                    "VALUES (%s, %s, %s)", (version, path.name, checksum)
                )
        finally:
            cursor.close()
    finally:
        connection.close()


if __name__ == "__main__":
    apply_migrations()
