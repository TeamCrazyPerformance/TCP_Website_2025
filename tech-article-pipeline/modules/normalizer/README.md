# Source normalizers

Normalization is implemented next to each crawler because HTML structure,
canonical URL rules, and publication metadata are source-specific. The core does
not trust native output directly: `CrawlOrchestrator` projects source metadata to
the shared shape, rejects failed or incomplete normalization, attaches duplicate,
quality, and generation policies, and validates `NormalizedArticleCandidate`.

Normalizers do not query a database and do not perform duplicate admission.
Cloudflare's source-change cache, InfoQ raw repository, and SD Times intermediate
objects are held in process memory. A process restart can cause a source item to
be collected again; the downstream idempotency key and admission module make that
safe.
