# Live source smoke results

Executed on 2026-08-16 with a one-article limit and the temporary test identity:

- public URL: `https://github.com/TeamCrazyPerformance/TCP_Website_2025`
- contact: `crawler-test@tcp.or.kr`

## Source-native paths

- Cloudflare RSS -> article fetch -> normalization: passed
- InfoQ WEB_CRAWL -> article fetch -> normalization: passed
- InfoQ RSS -> article fetch -> normalization: passed
- SD Times RSS -> normalization: passed

Pytest result: `3 passed, 2 subtests passed`.

## Integrated adapter paths

Each registered source was run again through `SourceAdapterRegistry` and
`CrawlOrchestrator`. The live normalized output passed the strict shared
`NormalizedArticleCandidate` contract, was recorded by the memory core
repository, and created a downstream ADMISSION submission.

- `cloudflare-blog / RSS / BLOG`: passed
- `infoq / RSS / NEWS`: passed
- `sdtimes / RSS / NEWS`: passed

Pytest result: `3 passed`.

These tests prove the source pages and contracts were compatible at the execution
time. They remain opt-in because they access third-party sites and may fail later
when a site changes its HTML, feed, robots policy, or availability.
