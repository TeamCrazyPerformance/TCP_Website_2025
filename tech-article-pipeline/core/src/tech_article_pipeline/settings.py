from __future__ import annotations

import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        raise RuntimeError(f"Missing required environment variable {name}")
    return value


@dataclass(frozen=True, slots=True)
class Settings:
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str
    service_token: str
    mysql_pool_size: int = 5
    worker_concurrency: int = 1
    worker_poll_seconds: float = 1.0
    worker_lease_seconds: int = 60
    job_max_attempts: int = 3
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    crawler_public_url: str | None = None
    crawler_contact: str | None = None
    backend: str = "mysql"

    @classmethod
    def from_env(cls) -> Settings:
        backend = os.getenv("PIPELINE_BACKEND", "mysql").lower()
        return cls(
            mysql_host=os.getenv("TECH_ARTICLE_MYSQL_HOST", "pipeline-mysql"),
            mysql_port=int(os.getenv("TECH_ARTICLE_MYSQL_PORT", "3306")),
            mysql_user=os.getenv("TECH_ARTICLE_MYSQL_USER", "pipeline"),
            mysql_password=(
                _required("TECH_ARTICLE_MYSQL_PASSWORD") if backend == "mysql" else "memory"
            ),
            mysql_database=os.getenv("TECH_ARTICLE_MYSQL_DATABASE", "tech_articles"),
            service_token=_required("PIPELINE_SERVICE_TOKEN"),
            mysql_pool_size=int(os.getenv("TECH_ARTICLE_MYSQL_POOL_SIZE", "5")),
            worker_concurrency=int(os.getenv("PIPELINE_WORKER_CONCURRENCY", "1")),
            worker_poll_seconds=float(os.getenv("PIPELINE_WORKER_POLL_SECONDS", "1")),
            worker_lease_seconds=int(os.getenv("PIPELINE_WORKER_LEASE_SECONDS", "60")),
            job_max_attempts=int(os.getenv("PIPELINE_JOB_MAX_ATTEMPTS", "3")),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
            crawler_public_url=os.getenv("CRAWLER_PUBLIC_URL"),
            crawler_contact=os.getenv("CRAWLER_CONTACT"),
            backend=backend,
        )
