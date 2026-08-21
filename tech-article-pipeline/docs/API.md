# Internal API

All routes below use `/internal/v1` and require a Bearer service token. Health
routes (`/health/live`, `/health/ready`) are the only exceptions.

## Submission and jobs

- `POST /crawl-runs` — requires `Idempotency-Key`; enqueues one source crawl and
  returns HTTP 202 with `crawlRunId`, `jobId`, and `operation`.
- `GET /crawl-runs/{crawlRunId}` — returns crawl/job status, attempts, aggregate
  statistics, errors, and each item's downstream `submissionId` when available.
- `POST /normalized-articles` — requires `Idempotency-Key`; returns HTTP 202 with
  `submissionId`, the initial `jobId`, and `operation: CREATED|REPLAYED`.
- `GET /jobs/{jobId}` — returns stage, status, attempts, lease, result, and error.

The submission body is the admission module's normalized article contract plus
`qualityPolicy` and `generationOptions`. Defaults are supplied for quality and
generation policy, while `duplicatePolicy` is explicit because it affects the
atomic admission decision.

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

Supported combinations are Cloudflare `RSS/BLOG`, InfoQ
`RSS|WEB_CRAWL` with `NEWS|ENGINEERING`, and SD Times
`RSS|WEB_CRAWL|API` with `NEWS`, plus GitHub Trending
`WEB_CRAWL/REPOSITORIES`. Duplicate, quality, and generation policies may be
supplied on the same request and otherwise use the core defaults.

GitHub Trending requests accept `maximumArticleCount` from 1 through 3 and
`requestTimeoutMs`. `followPagination` must be false and `maximumPageCount` must
remain 1. Discovery is always `https://github.com/trending?since=daily` with no
language filter; the selected rank is never backfilled after a README failure.
Rank, period, counters, contributors, and crawl time are retained in crawl-item
records rather than inserted into normalized article content. Crawl-run reads
may expose that raw item evidence, but article reads and Gemini enrichment do not
currently project it, so it is not visible on the public website.

For a repository seen in an earlier window, canonical URL equality selects the
existing article as an admission candidate. It is not an unconditional duplicate
key: the current policy returns automatic `DUPLICATE` for an exact content hash
or content Jaccard similarity of at least 92%, and `POSSIBLE_DUPLICATE` from 80%
through less than 92%.

## Reads and administration

- `GET /public/articles` — keeps `limit|offset` and adds `keyword`, repeated
  canonical `tags`, `totalCount`, and `lastCrawledAt`.
- `GET /public/tags` and `GET /public/articles/{articleId}`
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

Review queues accept `limit`, `offset`, `keyword`, `filter`, and a queue-specific
`sort` value and return `totalCount`. Article and review projections combine the
existing article, submission, quality-result, and crawl-item records; no public
website projection republishes the collected source body.
