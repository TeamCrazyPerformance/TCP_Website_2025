from __future__ import annotations

from tech_articles_ingestion.config import IngestionConfig


def test_config_builds_database_url_from_existing_api_environment(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DB_HOST", "db")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_USER", "tcp user")
    monkeypatch.setenv("DB_PASSWORD", "p@ss/word")
    monkeypatch.setenv("DB_NAME", "tcp db")
    monkeypatch.setenv("CRAWLER_PUBLIC_URL", "https://tcp.or.kr/crawler")
    monkeypatch.setenv("CRAWLER_CONTACT", "crawler@tcp.or.kr")
    config = IngestionConfig.from_env()
    assert config.database_url == ("postgresql://tcp%20user:p%40ss%2Fword@db:5432/tcp%20db")
