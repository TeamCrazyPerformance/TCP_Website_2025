# Internal API

All routes below use `/internal/v1` and require a Bearer service token. Health
routes (`/health/live`, `/health/ready`) are the only exceptions.

## Submission and jobs

- `POST /crawl-runs` — requires `Idempotency-Key`; the trusted website service sets
  `X-Crawl-Trigger: MANUAL|SCHEDULED` (default `MANUAL`). It enqueues one source
  crawl and returns HTTP 202 with `crawlRunId`, `jobId`, `trigger`, and `operation`.
- `GET /crawl-runs/{crawlRunId}` — returns crawl/job status, attempts, aggregate
  statistics, errors, and each item's downstream `submissionId` when available.
- `GET /crawl-runs` — returns newest-first crawl history with `limit|offset` and
  optional `status`, `sourceId`, and `trigger=MANUAL|SCHEDULED` filters. Each row
  includes timing, source capability, retry state, stored item count, and final
  statistics when the source adapter has finished. Errors are limited to `code`,
  `message`, and `retryable`; job results, request payloads, leases, and raw crawl
  evidence are not part of either crawl-run read response.
- `POST /normalized-articles` — requires `Idempotency-Key`; returns HTTP 202 with
  `submissionId`, the initial `jobId`, and `operation: CREATED|REPLAYED`.
- `GET /jobs/{jobId}` — returns stage, status, attempts, lease, result, and error.

The submission body is the admission module's normalized article contract plus
`qualityPolicy` and `generationOptions`. Defaults are supplied for quality and
generation policy, while `duplicatePolicy` is explicit because it affects the
atomic admission decision.

Successful quality results are self-describing. `qualityEvaluation.score.axes`
stores the ordered axis key, display label, numeric value, optional weight, and
server-calculated contribution used by that evaluation. `score.scale` declares
the numeric range. The legacy `score.dimensions` object remains temporarily for
rolling-deployment compatibility, but clients should consume `axes`. Because the
metadata is stored with each result, historical articles keep the policy that
actually produced their score when a later evaluator changes its axes.

The crawl request does not accept URLs. This prevents the internal endpoint from
becoming an SSRF proxy; entry points are selected from the registered source:

```json
{
  "schemaVersion": "1.0",
  "source": {
    "sourceId": "infoq",
    "sourceType": "RSS",
    "sectionKey": "NEWS"
  },
  "crawlOptions": {
    "maximumArticleCount": 10,
    "maximumAgeHours": 720,
    "followPagination": false,
    "maximumPageCount": 1,
    "requestTimeoutMs": 15000
  }
}
```

The current source adapter contract returns one completed `CrawlBatch`; it does
not stream per-page or per-article progress. While a run is queued, running, or
waiting to retry, clients may display its run/job status, timestamps, attempts,
and error. `statistics` is `null` until the adapter finishes, and `itemCount`
counts only records already persisted by the worker. Clients must not derive a
live phase or percentage from `maximumArticleCount`, because that option is an
upper bound rather than the number of articles that will be discovered.

Supported combinations are Cloudflare `RSS/BLOG`, InfoQ
`RSS|WEB_CRAWL` with `NEWS|ENGINEERING`, and SD Times
`RSS|WEB_CRAWL|API` with `NEWS`, plus GitHub Trending
`WEB_CRAWL/REPOSITORIES`. Duplicate, quality, and generation policies may be
supplied on the same request and otherwise use the core defaults.

GitHub Trending requests accept `maximumArticleCount` from 1 through 3 and
`requestTimeoutMs`. `followPagination` must be false and `maximumPageCount` must
remain 1. Discovery is always `https://github.com/trending?since=daily` with no
language filter; the selected rank is never backfilled after a README failure.
Rank, period, counters, contributors, and crawl time are retained in internal
crawl-item records rather than inserted into normalized article content. Crawl-run
reads expose only item identifiers and processing outcomes; raw item evidence is
not returned by the API, article reads, or Gemini enrichment.

For a repository seen in an earlier window, canonical URL equality selects the
existing article as an admission candidate. It is not an unconditional duplicate
key: the current policy returns automatic `DUPLICATE` for an exact content hash
or content Jaccard similarity of at least 92%, and `POSSIBLE_DUPLICATE` from 80%
through less than 92%.

## Reads and administration

- `GET /public/articles` — keeps `limit|offset` and adds `keyword`, repeated
  canonical `tags`, `totalCount`, and `lastCrawledAt`. Each item is a dedicated
  list projection containing only identity/display title, one-line summary, tags,
  source name/domain, publication time, and `isNew`.
- `GET /public/tags` and `GET /public/articles/{articleId}`. Detail uses a separate
  projection with summary Markdown, source path/article URL, language, collection
  time, and a minimal `valueScore`. The score contains only `overall`, `scale`, and
  ordered `breakdown[{label, contribution}]`; evaluator/policy versions, decision,
  reason, signals, axis keys, raw axis values, and weights do not cross this boundary.
- `GET /public/articles` — also supports `sources` (repeatable). Unknown ids return
  422 `INVALID_ARTICLE_SOURCE`. Every item carries `isNew`, true when the article was
  both collected and originally published within `NEW_ARTICLE_WINDOW_HOURS` (24).
  The public list is ordered by the
  `originalPublishedAt` service timestamp. Source-provided publication time is used
  normally; GitHub Trending uses its UTC crawl observation time because that source
  has no original publication timestamp, so its UTC crawl observation time is used for
  both publication freshness and collection freshness.
- `POST /public/articles/{articleId}/view?member=true|false` — bumps the per-article
  counter. Operations-only aggregate; no per-user history is stored, so it is not
  personal data. Unknown ids match no row in `articles`, so the insert affects nothing
  and raises nothing — the path is reachable without auth, so a foreign-key error per
  request would let anyone flood the log with stack traces. Callers do not await it.
- `GET /public/sources` — id, name, domain, category and published `count` per source.
  Sources keep growing, so this is a separate call rather than a field on the list
  response, mirroring `GET /public/tags`.
- `GET /admin/articles` — also supports `stage`, one of `INGESTED`, `QUALITY_REVIEW`,
  `ENRICHING`, `PUBLICATION_REVIEW`, `COMPLETED`, `FAILED_AFTER_APPROVAL`, `FAILED`,
  `QUALITY_REJECTED`. The stage rule lives in `persistence.mysql.STAGE_PREDICATES`;
  `FAILED_AFTER_APPROVAL` reads `quality_review_cases`, not `review_status`.
  `statusMismatch=true` narrows to articles whose `review_status` is `APPROVED` on a
  processing status that cannot produce it; it is a separate axis from `stage`.
  `GET /admin/articles/stats` adds `stages` (a count per stage over every article, zero
  counts included), `stageOldest` (oldest `updated_at` per stage, a lower bound for how
  long an article has sat there), and `statusMismatch`. It accepts `keyword` and
  `publicationStatus` so the counts match the list the admin is looking at; it does not
  accept `stage`. The `reviews` queue counts come from other tables and stay unfiltered.
  `sort` also accepts `OLDEST`.
- `GET /admin/articles` — supports `keyword`, `publicationStatus`, and
  `NEWEST|SCORE_DESC|SCORE_ASC`; returns `totalCount`.
- `GET /admin/articles/stats` and `GET /admin/articles/{articleId}`
- `GET /admin/reviews/duplicate|quality|publication`
- `GET /admin/crawl-sources`
- `POST /admin/reviews/duplicate/{caseId}/resolution`
- `POST /admin/reviews/quality/{caseId}/resolution`
- `POST /admin/articles/{articleId}/publication`
- `GET|PATCH /admin/settings/publication-policy`

Duplicate resolution bodies follow the admission module contract, including
`resolutionRequestId`, `expectedCaseVersion`, administrator, action, and UTC
`resolvedAt`. Quality actions are `APPROVE|REJECT`. Publication actions are
`PUBLISH|HIDE|ARCHIVE` and require the expected article record version.

A successful quality `APPROVE` resolution records the approval and enqueues
enrichment. It does not overwrite the stored `REVIEW_REQUIRED` quality decision.
The orchestrator derives an effective `PASS` for the strict summarizer contract
and forwards only the overall quality score; the original decision and dimension
scores remain available in the persisted quality result and admin projections.

The publication policy setting is `IMMEDIATE|REVIEW`, defaults to `IMMEDIATE`,
and uses an optional expected version on PATCH for optimistic concurrency.

Public list SQL selects neither article bodies nor authors, quality payloads,
workflow states, crawl payloads, or view counts. Public detail selects the score JSON
subdocument instead of the full quality evaluation. The API then constructs a fresh
allowlisted object, so repository row widening cannot automatically widen the service
response. Stored axes are preferred; pre-axes three-axis and four-axis dimensions are
restored with their respective historical labels and weights.

Review queues accept `limit`, `offset`, `keyword`, `filter`, and a queue-specific
`sort` value and return `totalCount`. Article and review projections combine the
existing article, submission, quality-result, and crawl-item records; no public
website projection republishes the collected source body.
