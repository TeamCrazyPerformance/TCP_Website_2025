# Architecture

The deployable unit contains one FastAPI process and an in-process durable queue
worker. MySQL 8.4 is a separate service and is the only authority for pipeline
state. The existing website PostgreSQL database is not accessed.

```text
source crawl API -> MySQL crawl job -> in-memory source crawler + normalizer
  -> validated normalized candidate -> MySQL ADMISSION job
  -> admission UNIQUE -> QUALITY job
  -> quality PASS -> ENRICHMENT job
  -> Gemini success -> IMMEDIATE: PUBLISHED
                     -> REVIEW: publication review queue
```

Cloudflare, InfoQ, and SD Times adapters contain no production database client.
They return source events in memory. MySQL remains the durable boundary for crawl
commands, worker leases, raw event records, and downstream submission links. A
restart can repeat network collection but cannot create a second pipeline
submission for the same `crawlRunId + crawlItemId`.

Crawler entry URLs are derived from a closed registry rather than accepted from
API clients. Source-native contracts are projected and then validated by the
core's strict Pydantic contract before admission.

`DUPLICATE` is terminal. `POSSIBLE_DUPLICATE` waits in the admission module's
review table; approval as unique creates the article and enqueues quality.
`REVIEW_REQUIRED` waits in `quality_review_cases`; approval enqueues enrichment.
Quality rejection never calls Gemini.

Workers claim `PENDING/RETRY` rows under `SELECT ... FOR UPDATE SKIP LOCKED`,
increment the attempt count, and attach a lease token. Expired leases become
`RETRY` (or `DEAD` after the final attempt). Contract failures use each module's
`retryable` value and exponential backoff. Stage job unique keys make enqueueing
and recovery idempotent.

`crawl_jobs` uses the same lease and retry model independently of article stage
jobs. A completed crawl transaction stores crawl items and creates each ADMISSION
job atomically. Source run `FAILED` uses source error retryability; partial runs
retain successful articles and per-item failures.

The admission module owns the transaction that writes an article, fingerprint,
and all 16 LSH buckets. A shared MySQL connection pool is injected into its
repository and the core repository; neither owns schema migration.

## State separation

- Processing: `INGESTED`, `QUALITY_EVALUATED`, `QUALITY_REJECTED`,
  `ENRICHMENT_PENDING`, `ENRICHED`, `PROCESSING_FAILED`
- Review: `NOT_REQUIRED`, `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`,
  `CHANGES_REQUESTED`
- Publication: `UNPUBLISHED`, `SCHEDULED`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`

Public reads always require both `processing_status = ENRICHED` and
`publication_status = PUBLISHED`.
