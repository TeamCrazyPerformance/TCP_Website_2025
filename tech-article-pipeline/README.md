# TCP technical article pipeline

This directory is the canonical, independently deployable Python 3.12 pipeline
for Cloudflare Blog, InfoQ, SD Times, and GitHub Trending collection and
normalization, normalized article admission, deterministic quality evaluation,
Gemini enrichment, review, and publication. The source fragment directories one level
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
service URL and operational address before running the Cloudflare or GitHub
crawler. GitHub Trending uses the public daily listing and unauthenticated README
API; no GitHub token is read by the pipeline.

GitHub rank, counters, and observation time stay in internal crawl/discovery
records. They are not inserted into README-derived normalized content and are not
currently exposed through Gemini summaries or public article responses.

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
`tech-articles` Docker Compose profile. Keep the profile for manual isolation,
but use the repository operations scripts for deployable environments:

```bash
bash CICDtools/ServerSetupRemove/set_env.sh prod
bash CICDtools/update_pipeline.sh
# or deploy pipeline + API + frontend as one release
bash CICDtools/update_all.sh
```

The operations scripts always enable the profile, wait for MySQL, require the
checksum migration job to exit 0, and verify readiness. Pipeline MySQL is backed
up and restored in the same manifest-verified set as PostgreSQL and persistent
files; do not create independently matched production dumps. See
`../docs/TECH_ARTICLE_PIPELINE_OPERATIONS.md` and `../CICDtools/README.md`.

최초 모듈 구현자와 담당 범위는 [`CREDITS.md`](CREDITS.md)에 기록되어 있습니다.
