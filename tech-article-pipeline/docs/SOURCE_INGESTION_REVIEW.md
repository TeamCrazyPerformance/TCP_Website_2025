# Source crawler and normalizer review

## Cloudflare Blog — 박준우

The strongest implementation of the three. It has strict JSON-schema contracts,
defused RSS XML parsing, bounded/allowlisted HTTP, robots policy checks, redirect
limits, rich content normalization, fixture tests, and `NEW/CHANGED/UNCHANGED`
classification. The standalone package coupled this logic to PostgreSQL and its
orchestrator generated its own run ID.

Integration keeps the crawler, parser, normalizer, safety policy, and in-memory
source-state repository. PostgreSQL is not imported by the canonical persistence
package or CLI. The orchestrator accepts the core-assigned `crawlRunId`, allowing
raw items and downstream submissions to share one identity. An operational
public URL and contact address remain mandatory for live crawling.

## InfoQ — 윤태완

This implementation already has strong standard-library HTTP controls, exact
host/path allowlists, safe redirects, response limits, robots checks, retry and
rate limiting, per-article failure isolation, RSS/web modes, strict dataclass
contracts, and a broad fixture/unit suite. Its SQLite repository and an early
exact dedup prototype overlap with core responsibilities.

Integration uses only `InMemoryRawCrawlRepository`; the canonical CLI also uses
memory. `deduplication_v1` is not called because admission owns SHA-256, MinHash,
LSH, locking, and review decisions. Native `messageType` and broader contract
fields are projected into the strict core candidate before submission.

## SD Times — 김재민

The initial implementation covered web, RSS, WordPress API, URL cleanup, text
cleanup, publication date parsing, and basic tests, but its boundary was weaker.
It accepted lookalike hosts through `endswith("sdtimes.com")`, let feedparser make
an unbounded network request, followed redirects without validating each target,
mutated the crawl item while normalizing, swallowed run exceptions, and could
report success with required normalized fields missing.

Integration routes RSS through the configured session and timeout, validates
HTTPS/exact hosts and every redirect, adds robots/rate handling for web crawling,
rejects off-domain canonical metadata, avoids input mutation/default model reuse,
and marks missing title/content/canonical URL as normalization failure. Core then
applies the same strict candidate validation used for the other registered sources.

## GitHub Trending

This is a new canonical implementation rather than a copy of a prior source
module. It accepts only exact HTTPS `github.com` and `api.github.com` hosts,
revalidates every redirect, bounds response bodies, and checks GitHub robots
policy before fetching the daily Trending listing. The crawler identity requires
the configured public URL and contact address before any network request.

Repository cards are parsed in DOM order and the first one to three ranks are
fixed before README retrieval. READMEs are fetched sequentially from the public
repository README endpoint using GitHub's rendered-HTML media type and without a
token. `403`/`429`, `5xx`, timeout, and connection failures are retryable;
README `404`, invalid structure, unsafe redirects, and robots refusal are not.
Rendered README HTML is reduced to plain text after active/non-content elements
are removed. The normalized body contains only the repository description and
README text; ranking and repository counters remain in discovery/raw events.
The crawl timestamp is the observation time. Date, rank, and counters are
deliberately not prepended to normalized content because doing so would change
the exact content hash on every observation and weaken duplicate detection.

`discovery` is persisted as internal evidence but is not sent to Gemini or
included in the current public/admin article projection. Consequently, the
website does not display Trending rank or observation date. Repeated repository
URLs enter admission's candidate set through canonical URL lookup, but canonical
equality alone is not terminal under the current policy; unchanged content is an
exact duplicate and heavily changed README content may still be admitted as a
new article.

## Shared operational decision

No source adapter writes PostgreSQL, SQLite, MySQL, or output files in the service
execution path. All four return a `CrawlBatch` in memory. The core MySQL layer is
separate and stores durable crawl commands, leases, raw events, completion stats,
and downstream submission links. Live network tests are opt-in; deterministic
fixture regression tests are part of the default suite.
