# TCP technical article pipeline

This directory is the canonical, independently deployable Python 3.12 pipeline
for Cloudflare Blog, InfoQ, and SD Times collection and normalization, normalized
article admission, deterministic quality evaluation, Gemini enrichment, review,
and publication. The source fragment directories one level
above are retained only for provenance.

## Local development

```powershell
uv sync --python 3.12
uv run pytest
Copy-Item .env.example .env
docker compose --env-file .env -f compose.local.yml up --build
```

The application is intentionally not mapped to a host port by the local Compose
file. Other services on the Compose network call it at
`http://tech-article-pipeline:8080`. For isolated API development, set
`PIPELINE_BACKEND=memory`, provide `PIPELINE_SERVICE_TOKEN`, and run Uvicorn.

All `/internal/v1/*` routes require `Authorization: Bearer <service token>`.
Submit a normalized article with a non-empty `Idempotency-Key`; a replay with an
identical canonical JSON body returns the original job and a changed body returns
HTTP 409.

`POST /internal/v1/crawl-runs` provides the first-party ingestion entry point.
Each source adapter uses only process-memory storage. The core MySQL repository
durably stores crawl commands, leases, raw crawl events, and links to downstream
article submissions. Set `CRAWLER_PUBLIC_URL` and `CRAWLER_CONTACT` to an actual
service URL and operational address before running the Cloudflare crawler.

Database changes are applied only by the one-shot migration command. The runner
records each filename and SHA-256 checksum in `pipeline_migration_history` and
refuses changed applied migrations.

Live Gemini calls are absent from the default test suite. Run the explicit manual
profile only after setting `GEMINI_API_KEY`:

```powershell
docker compose --env-file .env -f compose.local.yml --profile gemini-smoke run --rm pipeline-gemini-smoke
```

See `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SOURCE_INGESTION_REVIEW.md`,
`docs/LIVE_SMOKE_RESULTS.md`, and `docs/TCP_WEBSITE_2025_INTEGRATION.md` for
contracts, verification evidence, and integration notes.

## TCP website deployment

In the TCP website repository this image is integrated through the
`tech-articles` Docker Compose profile. From the repository root, inject the
pipeline secrets and run:

```powershell
docker compose --profile tech-articles up -d --build pipeline-mysql pipeline-migrate tech-article-pipeline
```

The profile keeps normal website-only Compose commands independent of pipeline
configuration and health. See `../docs/TECH_ARTICLE_PIPELINE_OPERATIONS.md` for
the deployment, readiness, independent backup, and restore procedure.

최초 모듈 구현자와 담당 범위는 [`CREDITS.md`](CREDITS.md)에 기록되어 있습니다.
