# Quality module

Deterministic quality evaluation for normalized technical articles. The four-axis formula uses
35% relevance, 30% technical depth, 25% timeliness, and 10% article quality.
The score result is self-describing: `score.axes` records each axis key, display
label, value, weight, and weighted contribution used for that evaluation. The
legacy `score.dimensions` object remains during the compatibility period.
Length, language, spam, and advertisement policies are hard gates. Invalid input
is returned through the shared failure contract instead of raising from the public API.

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


## Community bonus removal (evaluator 2.2.7)

New evaluations use only the four weighted axes. Engagement metadata is still
accepted for input compatibility, but never changes the score, decision, or
reason. New results omit `score.dimensions.communityBonus`.

Stored evaluations retain their original score, decision, reason, and evaluator
version; the API can still read their legacy metadata. The administrator UI no
longer renders a separate bonus indicator. This change does not migrate or
recalculate historical results. Reprocess selected articles explicitly if they
need an evaluation under the new version.
