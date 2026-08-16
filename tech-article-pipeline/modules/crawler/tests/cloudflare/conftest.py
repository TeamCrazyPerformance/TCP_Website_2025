from __future__ import annotations

from pathlib import Path

import pytest

from tech_articles_ingestion.config import IngestionConfig


@pytest.fixture
def config() -> IngestionConfig:
    return IngestionConfig(
        database_url="postgresql://test:test@localhost/test",
        public_url="https://tcp.or.kr/crawler",
        contact="crawler@tcp.or.kr",
        content_short_threshold=20,
    )


@pytest.fixture
def fixture_dir() -> Path:
    return Path(__file__).parent / "fixtures"
