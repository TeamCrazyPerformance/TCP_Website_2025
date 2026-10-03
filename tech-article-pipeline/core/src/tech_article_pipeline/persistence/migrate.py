from __future__ import annotations

import hashlib
import os
from importlib.resources import files
from pathlib import Path

import mysql.connector
import sqlparse

_KEYWORD_TABLES = {
    "008": {
        "quality_keyword_dictionary_versions": {
            "version_id": ("varchar(64)", "NO", "ascii_bin"),
            "status": ("enum('active','archived')", "NO", None),
            "source": ("varchar(64)", "NO", "ascii_bin"),
            "keyword_count": ("int unsigned", "NO", None),
            "checksum_sha256": ("char(64)", "NO", "ascii_bin"),
            "created_at": ("datetime(6)", "NO", None),
            "activated_at": ("datetime(6)", "YES", None),
        },
        "quality_keyword_dictionary_items": {
            "version_id": ("varchar(64)", "NO", "ascii_bin"),
            "keyword": ("varchar(255)", "NO", "utf8mb4_0900_ai_ci"),
            "source": ("varchar(64)", "NO", "ascii_bin"),
        },
        "quality_keyword_update_history": {
            "update_id": ("varchar(64)", "NO", "ascii_bin"),
            "status": ("enum('success','failed')", "NO", None),
            "source": ("varchar(64)", "NO", "ascii_bin"),
            "version_id": ("varchar(64)", "YES", "ascii_bin"),
            "added_count": ("int unsigned", "YES", None),
            "removed_count": ("int unsigned", "YES", None),
            "error_message": ("text", "YES", "utf8mb4_0900_ai_ci"),
            "completed_at": ("datetime(6)", "NO", None),
        },
    },
    "009": {
        "quality_keyword_observations": {
            "keyword": ("varchar(255)", "NO", "utf8mb4_0900_ai_ci"),
            "source": ("varchar(64)", "NO", "ascii_bin"),
            "first_collected_at": ("datetime(6)", "NO", None),
            "last_collected_at": ("datetime(6)", "NO", None),
        },
    },
}
_KEYWORD_INDEXES = {
    "quality_keyword_dictionary_versions": {
        "PRIMARY": ["version_id"],
        "idx_keyword_dictionary_active": ["status", "activated_at"],
    },
    "quality_keyword_dictionary_items": {"PRIMARY": ["version_id", "keyword"]},
    "quality_keyword_update_history": {
        "PRIMARY": ["update_id"],
        "idx_keyword_update_history_completed": ["completed_at"],
    },
    "quality_keyword_observations": {
        "PRIMARY": ["keyword"],
        "idx_keyword_observations_recent": ["last_collected_at", "first_collected_at"],
    },
}


def verify_keyword_schema(cursor, version: str) -> None:
    for table, expected in _KEYWORD_TABLES.get(version, {}).items():
        cursor.execute(
            "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
            (table,),
        )
        engine = cursor.fetchone()
        if not engine or engine["ENGINE"] != "InnoDB":
            raise RuntimeError(f"Keyword schema mismatch: {table} engine")
        cursor.execute(
            "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLLATION_NAME, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s",
            (table,),
        )
        column_rows = cursor.fetchall()
        columns = {
            row["COLUMN_NAME"]: (
                row["COLUMN_TYPE"].lower(),
                row["IS_NULLABLE"],
                row["COLLATION_NAME"],
            )
            for row in column_rows
        }
        if any(
            name not in columns
            or columns[name][:2] != definition[:2]
            or (definition[2] is not None and columns[name][2] != definition[2])
            for name, definition in expected.items()
        ):
            raise RuntimeError(f"Keyword schema mismatch: {table} columns")
        if any(
            row["COLUMN_NAME"] in expected
            and expected[row["COLUMN_NAME"]][:2] == ("datetime(6)", "NO")
            and str(row["COLUMN_DEFAULT"]).lower() != "current_timestamp(6)"
            for row in column_rows
        ):
            raise RuntimeError(f"Keyword schema mismatch: {table} timestamp defaults")
        cursor.execute(
            "SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s ORDER BY INDEX_NAME, SEQ_IN_INDEX",
            (table,),
        )
        indexes = {}
        for row in cursor.fetchall():
            indexes.setdefault(row["INDEX_NAME"], []).append(row["COLUMN_NAME"])
        if any(indexes.get(name) != columns for name, columns in _KEYWORD_INDEXES[table].items()):
            raise RuntimeError(f"Keyword schema mismatch: {table} indexes")
    if version == "008":
        cursor.execute(
            "SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA = r.CONSTRAINT_SCHEMA AND k.CONSTRAINT_NAME = r.CONSTRAINT_NAME AND k.TABLE_NAME = r.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.TABLE_NAME IN ('quality_keyword_dictionary_items', 'quality_keyword_update_history')"
        )
        foreign_keys = {
            (
                row["TABLE_NAME"],
                row["COLUMN_NAME"],
                row["REFERENCED_TABLE_NAME"],
                row["REFERENCED_COLUMN_NAME"],
                row["DELETE_RULE"],
            )
            for row in cursor.fetchall()
        }
        expected = {
            (
                "quality_keyword_dictionary_items",
                "version_id",
                "quality_keyword_dictionary_versions",
                "version_id",
                "CASCADE",
            ),
            (
                "quality_keyword_update_history",
                "version_id",
                "quality_keyword_dictionary_versions",
                "version_id",
                "SET NULL",
            ),
        }
        if not expected <= foreign_keys:
            raise RuntimeError("Keyword schema mismatch: version foreign keys")
        cursor.execute(
            "SELECT t.ENFORCED, c.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS t "
            "JOIN information_schema.CHECK_CONSTRAINTS c ON t.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA "
            "AND t.CONSTRAINT_NAME = c.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA = DATABASE() "
            "AND t.TABLE_NAME = 'quality_keyword_dictionary_versions' AND t.CONSTRAINT_NAME = 'chk_keyword_dictionary_count'"
        )
        check = cursor.fetchone()
        expression = "".join(
            char for char in (check or {}).get("CHECK_CLAUSE", "").lower() if char not in "` ()\n\t"
        )
        if not check or check["ENFORCED"] != "YES" or expression != "keyword_count>0":
            raise RuntimeError("Keyword schema mismatch: keyword count constraint")


def migration_directory() -> Path:
    configured = os.getenv("PIPELINE_MIGRATIONS_DIR")
    if configured:
        return Path(configured)
    source_tree = Path(__file__).resolve().parents[4] / "migrations"
    if source_tree.is_dir():
        return source_tree
    return Path(str(files("tech_article_pipeline").joinpath("migrations")))


def apply_migrations(*, through_version: str | None = None) -> None:
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
                if through_version is not None and version > through_version:
                    continue
                content = path.read_text(encoding="utf-8")
                checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()
                cursor.execute(
                    "SELECT filename, checksum_sha256 FROM pipeline_migration_history "
                    "WHERE version = %s",
                    (version,),
                )
                applied = cursor.fetchone()
                if applied:
                    if applied["filename"] != path.name or applied["checksum_sha256"] != checksum:
                        raise RuntimeError(f"Migration checksum mismatch for {version}")
                    verify_keyword_schema(cursor, version)
                    continue
                for statement in sqlparse.split(content):
                    if statement.strip():
                        cursor.execute(statement)
                verify_keyword_schema(cursor, version)
                cursor.execute(
                    "INSERT INTO pipeline_migration_history (version, filename, checksum_sha256) "
                    "VALUES (%s, %s, %s)",
                    (version, path.name, checksum),
                )
        finally:
            cursor.close()
    finally:
        connection.close()


if __name__ == "__main__":
    apply_migrations()
