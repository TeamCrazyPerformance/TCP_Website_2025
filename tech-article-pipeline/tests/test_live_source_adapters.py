from __future__ import annotations

import hashlib
import json
import os

import pytest
from tech_article_pipeline.contracts import CrawlRequested
from tech_article_pipeline.orchestration import CrawlOrchestrator
from tech_article_pipeline.persistence.memory import MemoryPipelineRepository
from tech_article_sources import SourceAdapterRegistry

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_SOURCE_ADAPTERS") != "1",
    reason="set RUN_LIVE_SOURCE_ADAPTERS=1 to run all live source adapters",
)


@pytest.mark.parametrize(
    ("source_id", "source_type", "section_key"),
    [
        ("cloudflare-blog", "RSS", "BLOG"),
        ("infoq", "RSS", "NEWS"),
        ("sdtimes", "RSS", "NEWS"),
        ("github-trending", "WEB_CRAWL", "REPOSITORIES"),
    ],
)
def test_live_source_adapter_reaches_core_submission(
    source_id: str, source_type: str, section_key: str
) -> None:
    crawl_options = {
        "maximumArticleCount": 1,
        "requestTimeoutMs": 15_000,
    }
    if source_id != "github-trending":
        crawl_options["maximumAgeHours"] = 2_160
    command = CrawlRequested.model_validate(
        {
            "source": {
                "sourceId": source_id,
                "sourceType": source_type,
                "sectionKey": section_key,
            },
            "crawlOptions": crawl_options,
        }
    ).model_dump(by_alias=True, mode="json")
    encoded = json.dumps(
        command, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    repository = MemoryPipelineRepository()
    response, _ = repository.submit_crawl(
        idempotency_key=f"live-source-adapter:{source_id}",
        body_digest=hashlib.sha256(encoded).digest(),
        payload=command,
        max_attempts=1,
    )
    job = repository.claim_crawl_job(lease_seconds=120)
    assert job is not None
    registry = SourceAdapterRegistry.default(
        public_url=os.environ["CRAWLER_PUBLIC_URL"],
        contact=os.environ["CRAWLER_CONTACT"],
    )
    result = CrawlOrchestrator(repository, registry).execute(job)
    assert result["normalizedArticles"], result
    repository.complete_crawl_job(job, result, max_attempts=1)
    run = repository.get_crawl_run(response["crawlRunId"])
    assert run is not None
    assert run["items"]
    assert run["items"][0]["submissionId"]
