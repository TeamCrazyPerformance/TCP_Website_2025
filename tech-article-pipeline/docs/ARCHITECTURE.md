# Architecture

The deployable unit contains one FastAPI process and an in-process durable queue
worker. MySQL 8.4 is a separate service and is the only authority for pipeline
state. The existing website PostgreSQL database is not accessed.

```text
source crawl API -> MySQL crawl job -> in-memory source crawler + normalizer
  -> validated normalized candidate -> MySQL ADMISSION job
  -> admission UNIQUE -> QUALITY job
  -> quality PASS -> ENRICHMENT job
  -> quality REVIEW_REQUIRED -> admin approval -> ENRICHMENT job
  -> Gemini success -> IMMEDIATE: PUBLISHED
                     -> REVIEW: publication review queue
```

Cloudflare, InfoQ, SD Times, and GitHub Trending adapters contain no production
database client. They return source events in memory. MySQL remains the durable boundary for crawl
commands, worker leases, raw event records, and downstream submission links. A
restart can repeat network collection but cannot create a second pipeline
submission for the same `crawlRunId + crawlItemId`.

Crawler entry URLs are derived from a closed registry rather than accepted from
API clients. Source-native contracts are projected and then validated by the
core's strict Pydantic contract before admission.

GitHub Trending follows the same boundary with an especially narrow dependency
direction:

```text
github_trending_pipeline (contracts + HTTP + parser + crawler + normalizer)
  -> tech_article_sources.GitHubTrendingSourceAdapter
  -> CrawlBatch
  -> core validation, admission, quality, and enrichment
```

The source package does not import `tech_article_sources`, core, persistence,
FastAPI, or Gemini. Rank and star/fork discovery metadata remain outside the
normalized article body so recurring appearances do not change its content hash.
The core stores `discovery` with the admitted article, but the enrichment request
contains only title, content, and language, and public/admin article projections
currently omit `discovery`. Trending rank remains internal crawl evidence. The
UTC crawl observation time is additionally projected to `originalPublishedAt`
because GitHub Trending does not provide an original publication timestamp; the
normalization warning preserves that distinction.

An exact canonical URL is used to load an existing article as a duplicate
candidate. Under `duplicate-policy-v1`, however, canonical equality is evidence,
not a terminal decision by itself: automatic `DUPLICATE` still requires an exact
content hash or at least 92% content Jaccard similarity, while 80% through less
than 92% becomes `POSSIBLE_DUPLICATE`. A substantially changed README can
therefore be admitted as unique even when the repository URL is unchanged.

`DUPLICATE` is terminal. `POSSIBLE_DUPLICATE` waits in the admission module's
review table; approval as unique creates the article and enqueues quality.
`REVIEW_REQUIRED` waits in `quality_review_cases`; approval enqueues enrichment.
Quality rejection never calls Gemini.

The core sends the summarizer an effective `PASS` decision and only
`score.overall`. Quality dimension scores remain stored in the original quality
result for administration and are not part of the summarizer's strict input
contract. For a directly passed article, the effective decision comes from the
original `PASS`. For a `REVIEW_REQUIRED` article, it comes from a resolved admin
approval while the stored original decision remains `REVIEW_REQUIRED`.
Unapproved or rejected articles are blocked before Gemini is called, including
if an enrichment job is enqueued manually.

Workers claim `PENDING/RETRY` rows under `SELECT ... FOR UPDATE SKIP LOCKED`,
increment the attempt count, and attach a lease token. Expired leases become
`RETRY` (or `DEAD` after the final attempt). Contract failures use each module's
`retryable` value and exponential backoff. Stage job unique keys make enqueueing
and recovery idempotent.

Gemini request starts are serialized through a process-wide summarizer limiter
with a 4.2-second minimum interval, covering both initial generation and the one
allowed regeneration. This keeps the single deployed pipeline process below the
configured model's 15 RPM quota. A `RATE_LIMITED` enrichment job waits at least
65 seconds before retrying; other retryable stage failures keep the standard
short exponential backoff. TPM and RPD enforcement remains provider-owned.

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
