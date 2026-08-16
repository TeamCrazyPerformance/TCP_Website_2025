# Crawler implementations

This module contains the canonical source implementations and their regression
tests:

- `tech_articles_ingestion`: Cloudflare Blog RSS and article pages
- `technical_news_pipeline`: InfoQ news/articles through RSS or web listings
- `sdtimes_crawler`: SD Times through web, RSS, or WordPress API
- `tech_article_sources`: the source-neutral adapters and registry used by core

The stable boundary is `CrawlRequested -> CrawlBatch`. A batch contains the
official `CrawlRunCompleted`, all emitted `CrawlItemProduced` records, and zero
or more source-normalized articles. Core validates every successful normalized
article again as `NormalizedArticleCandidate` before admission.

Source implementations use in-process memory only. Their standalone PostgreSQL
or SQLite adapters are retained as provenance code but are not imported by the
registry or used by their canonical CLIs. Durable queue, run, item, and submission
state belongs exclusively to the core MySQL repository.

Collection never accepts an arbitrary target host. The registry derives fixed
entry points from `sourceId`, `sourceType`, and `sectionKey`:

| sourceId | supported sourceType | sectionKey |
| --- | --- | --- |
| `cloudflare-blog` | `RSS` | `BLOG` |
| `infoq` | `RSS`, `WEB_CRAWL` | `NEWS`, `ENGINEERING` |
| `sdtimes` | `RSS`, `WEB_CRAWL`, `API` | `NEWS` |

Live network tests remain opt-in. Fixture-backed source regression tests run in
the default suite.
