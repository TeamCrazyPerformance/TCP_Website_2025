# Crawler implementations

This module contains the canonical source implementations and their regression
tests:

- `tech_articles_ingestion`: Cloudflare Blog RSS and article pages
- `technical_news_pipeline`: InfoQ news/articles through RSS or web listings
- `sdtimes_crawler`: SD Times through web, RSS, or WordPress API
- `github_trending_pipeline`: GitHub Trending Daily discovery and rendered README normalization
- `tech_article_sources`: the source-neutral adapters and registry used by core

The stable boundary is `CrawlRequested -> CrawlBatch`. A batch contains the
official `CrawlRunCompleted`, all emitted `CrawlItemProduced` records, and zero
or more source-normalized articles. Core validates every successful normalized
article again as `NormalizedArticleCandidate` before admission.

Source implementations use in-process memory only. Their standalone PostgreSQL
or SQLite adapters are retained as provenance code but are not imported by the
registry or used by their canonical CLIs. Durable queue, run, item, and submission
state belongs exclusively to the core MySQL repository.

The legacy `tech_articles_ingestion run-scheduled` CLI is retained for standalone
Cloudflare development only. Website and Private QA deployments do not run it.
Recurring website collection is owned by the NestJS scheduler, which submits all
configured source profiles through the core MySQL crawl queue.

Collection never accepts an arbitrary target host. The registry derives fixed
entry points from `sourceId`, `sourceType`, and `sectionKey`:

| sourceId | supported sourceType | sectionKey |
| --- | --- | --- |
| `cloudflare-blog` | `RSS` | `BLOG` |
| `infoq` | `RSS`, `WEB_CRAWL` | `NEWS`, `ENGINEERING` |
| `sdtimes` | `RSS`, `WEB_CRAWL`, `API` | `NEWS` |
| `github-trending` | `WEB_CRAWL` | `REPOSITORIES` |

GitHub Trending is fixed to the daily, all-language listing. A request selects
one to three repositories in DOM rank order and fetches only those rendered
READMEs; a failed README is retained as an item failure and is not replaced with
a lower-ranked repository. The package has no core, database, queue, or Gemini
dependency.

Trending rank, period, star/fork counters, contributors, and the crawl timestamp
are observation metadata. They remain in `discovery`/`CrawlItemProduced` and are
not prefixed to normalized `content`. This keeps the article fingerprint stable
when only a daily rank or counter changes. The current Gemini request and public
article projection do not expose this metadata to end users.

Live network tests remain opt-in. Fixture-backed source regression tests run in
the default suite.
