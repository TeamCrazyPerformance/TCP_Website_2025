# TCP_Website_2025 integration handoff

This implementation does not modify the remote website repository. The next
integration change should use its current Docker Compose and NestJS modular
monolith as the boundary.

## Compose changes

Add a MySQL 8.4 service, a named MySQL data volume, the one-shot migration service,
and the pipeline application service using the definitions in `compose.local.yml`.
Keep the existing PostgreSQL service and data untouched. Do not add a strong
`api depends_on` relationship to the pipeline: pipeline failure must not prevent
member, notice, or other existing website functions from starting.

Do not publish the pipeline port to the host. Place NestJS and the pipeline on a
shared internal Docker network and configure:

```text
PIPELINE_BASE_URL=http://tech-article-pipeline:8080
PIPELINE_SERVICE_TOKEN=<same secret injected into the pipeline>
CRAWLER_PUBLIC_URL=<public service/crawler information URL>
CRAWLER_CONTACT=<operational crawler email address>
```

Store the service token and both MySQL passwords in the deployment secret system,
not Compose source or an image layer.

## NestJS proxy

Add a technical-articles module whose controllers perform the site's normal JWT
authentication and ADMIN authorization before calling the internal API. The
NestJS service sends the service token, forwards `Idempotency-Key`, maps pipeline
409/422 responses without hiding their error codes, and applies strict timeouts.
NestJS must not receive MySQL credentials or query pipeline tables directly.

Proxy public list/detail, admin inventory, all three review queues and resolutions,
publication actions, and publication-policy GET/PATCH. Public endpoints must rely
on the pipeline's `ENRICHED + PUBLISHED` filter rather than reimplement it.

Add an admin-only crawl trigger/status proxy for `POST /internal/v1/crawl-runs`,
`GET /internal/v1/crawl-runs`, and `GET /internal/v1/crawl-runs/{crawlRunId}`.
Do not allow the browser or NestJS
request body to supply an arbitrary crawl URL; forward only the registered
`sourceId`, `sourceType`, section, bounded options, and policy fields.
NestJS assigns `X-Crawl-Trigger: MANUAL` to administrator requests and
`X-Crawl-Trigger: SCHEDULED` to scheduler requests. Both services must project
an explicit allowlist for crawl reads and must never return request payloads,
lease tokens, job results, or raw crawl-item evidence to the browser.

Proxy the run state without inventing a live phase or percentage. Source
adapters return their `CrawlBatch` only after collection finishes, so active
runs expose status, timestamps, attempts, and errors; the six official crawl
statistics and persisted item count are final-result data.

## Operations

Back up and restore the new MySQL volume independently of the existing PostgreSQL
backup. A restore drill must include migration history, admission fingerprints and
buckets, pending/retry jobs, review cases, settings, and publication events. Start
MySQL, run the migration job, then start the pipeline. NestJS can start at any time
and should return a bounded upstream-unavailable response while the pipeline is
not ready.

Reference repository files at planning time:

- https://github.com/TeamCrazyPerformance/TCP_Website_2025/blob/main/docker-compose.yml
- https://github.com/TeamCrazyPerformance/TCP_Website_2025/blob/main/api/package.json
