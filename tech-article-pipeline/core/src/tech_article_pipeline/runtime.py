from __future__ import annotations

from dataclasses import dataclass

from developer_news_summarizer import DeveloperNewsSummarizer
from tech_article_admission import (
    MySQLSettings,
    create_memory_admission_service,
    create_mysql_admission_service_from_pool,
)
from tech_article_admission.application import ArticleAdmissionService
from tech_article_admission.persistence import MySQLConnectionPool
from tech_article_quality import QualityEvaluator
from tech_article_sources import SourceAdapterRegistry

from tech_article_pipeline.orchestration import CrawlOrchestrator, PipelineOrchestrator
from tech_article_pipeline.persistence import MemoryPipelineRepository, MySQLPipelineRepository
from tech_article_pipeline.settings import Settings
from tech_article_pipeline.worker import DurableWorker


@dataclass(slots=True)
class Runtime:
    repository: MemoryPipelineRepository | MySQLPipelineRepository
    admission: ArticleAdmissionService
    orchestrator: PipelineOrchestrator
    crawl_orchestrator: CrawlOrchestrator
    worker: DurableWorker


def build_runtime(settings: Settings) -> Runtime:
    if settings.backend == "memory":
        repository = MemoryPipelineRepository()
        admission = create_memory_admission_service()
    elif settings.backend == "mysql":
        mysql_settings = MySQLSettings(
            host=settings.mysql_host,
            port=settings.mysql_port,
            user=settings.mysql_user,
            password=settings.mysql_password,
            database=settings.mysql_database,
            pool_name="tech_article_pipeline",
            pool_size=settings.mysql_pool_size,
        )
        pool = MySQLConnectionPool(mysql_settings)
        repository = MySQLPipelineRepository(pool)
        admission = create_mysql_admission_service_from_pool(pool)
    else:
        raise RuntimeError(f"Unsupported PIPELINE_BACKEND: {settings.backend}")
    quality = QualityEvaluator()
    summarizer = DeveloperNewsSummarizer(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )
    orchestrator = PipelineOrchestrator(
        repository,
        admission,
        quality,
        summarizer,
        job_max_attempts=settings.job_max_attempts,
    )
    registry = SourceAdapterRegistry.default(
        public_url=settings.crawler_public_url,
        contact=settings.crawler_contact,
    )
    crawl_orchestrator = CrawlOrchestrator(repository, registry)
    worker = DurableWorker(
        repository,
        orchestrator,
        crawl_orchestrator=crawl_orchestrator,
        job_max_attempts=settings.job_max_attempts,
        concurrency=settings.worker_concurrency,
        poll_seconds=settings.worker_poll_seconds,
        lease_seconds=settings.worker_lease_seconds,
    )
    return Runtime(repository, admission, orchestrator, crawl_orchestrator, worker)
