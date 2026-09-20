# Quality module

Deterministic quality evaluation for normalized technical articles. The four-axis formula uses
35% relevance, 30% technical depth, 25% timeliness, and 10% article quality.
The score result is self-describing: `score.axes` records each axis key, display
label, value, weight, and weighted contribution used for that evaluation. The
legacy `score.dimensions` object remains during the compatibility period.
Length and language policies are hard gates. Spam and advertisement findings are
administrator-visible signals only. Advertisement detection uses explicit
commercial disclosures and calls to purchase (for example, a statement that an
article is sponsored, affiliate links, discount codes, or purchase prompts), not
a bare word such as `sponsored`. Source crawlers also exclude explicit
non-article and sponsor page types before quality evaluation. Invalid input is
returned through the shared failure contract instead of raising from the public API.

## Technical-depth input

The Gemini depth evaluator receives the complete normalized article body, not a
leading excerpt. This lets technical material, benchmark results, and incident
analysis that appear later in a long article affect the depth score. The current
Gemini request timeout remains 10 seconds; an API failure still returns the
deterministic fallback score of 50.

## Durable keyword dictionary

- The bundled `keywords.json` is a read-only 113-keyword core seed. It is never
  changed at runtime and is used only when no durable dictionary is available.
  The bundled `keywords_history.json` remains an empty compatibility template;
  it is not the operational update history.
- In the pipeline runtime, MySQL is the source of truth. Migration `008` creates
  immutable dictionary versions, their keyword items, and successful/failed
  update history. A new version becomes active only after all its items are saved.
- The evaluator does not collect during Python module import. After the pipeline
  has configured its repository, the first request checks the active DB version;
  later checks run every `QUALITY_KEYWORD_REFRESH_CHECK_SECONDS` seconds (300 by
  default). A dictionary older than 24 hours is refreshed on the next request.
  The authenticated internal refresh endpoint is intended for the daily external
  scheduler, so a container replacement cannot create a file-cache dictionary first.
- Dynamic candidates combine Stack Overflow's popular tags and explicit topics of
  the three daily GitHub Trending repositories. Repository names/descriptions and
  broad topic labels are excluded. A GitHub outage leaves Stack Overflow available;
  an optional `GITHUB_KEYWORD_TOKEN` only raises GitHub's public API quota.
- The dynamic dictionary retains up to 250 keywords. Daily collection is capped
  at 125 (half of that maximum): up to 100 candidates from Stack Overflow and 25
  from GitHub. Source collection order is preserved, duplicates are retained once,
  and the first source wins attribution.
  `quality_keyword_observations` records each keyword's first and latest collection
  timestamp; a repeated keyword updates only its latest timestamp. The active
  dynamic dictionary is the most recently collected 250 observations.
- Empty/failed collection keeps the last active DB version unchanged and records
  a failed update history item. If durable storage cannot be read, the evaluator
  falls back to its in-memory dictionary and then the bundled core seed.
- `QUALITY_KEYWORD_CACHE_DIR` is retained only for standalone library use without
  a configured pipeline repository. It is not used as the production source of
  truth after the DB migration.
- The administrator Overview response exposes the active storage type, version,
  stored keyword count, and latest update status without requiring Docker or
  direct database access.
- Apply migration `008` before deploying the code. Existing article evaluations
  are not recalculated by this change.
- Existing stored article evaluations are not recalculated by this change.


## Community bonus (evaluator 2.4.4)

The four weighted axes remain the base score. A separate, capped community bonus
is applied only when the pipeline has a comparable source-owned metric. At
present this means GitHub Trending's already-collected `starsToday`: 50/150/300
daily stars yield +4/+7/+10 points. Missing values and every other source yield
0; likes, views, and comments are intentionally not estimated or compared across
sources.

The core quality stage copies `discovery.starsToday` only for `github-trending`
into the module request. It does not change the normalized article, public API,
or database schema. The result exposes a nullable
`score.dimensions.communityBonus`; `score.axes` continues to describe only the
four 100%-weighted base axes. Existing evaluations are not recalculated.
