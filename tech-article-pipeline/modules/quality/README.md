# Quality module

Deterministic quality evaluation for normalized technical articles. The supplied
45% relevance, 30% timeliness, and 25% source-metadata formula is preserved.
The score result is self-describing: `score.axes` records each axis key, display
label, value, weight, and weighted contribution used for that evaluation. The
legacy `score.dimensions` object remains during the compatibility period.
Length, language, spam, and advertisement policies are hard gates. Invalid input
is returned through the shared failure contract instead of raising from the public API.

## Keyword cache and startup safety

- The bundled `keywords.json` is a read-only seed, restored to the pre-contamination
  core dictionary (113 keywords). The tracked history was cleared because it
  contained manual/test updates; Git retains that history.
- Runtime updates write to `~/.cache/tech-article-quality`, or the directory set by
  `QUALITY_KEYWORD_CACHE_DIR`. Both dictionary and history are stored there, using
  atomic file replacement. Do not point this setting at the module source folder.
- The existing refresh behavior is unchanged: initialization checks the cache's
  24-hour age when the process starts. It is not a daily background scheduler.
- Empty/failed collection preserves the last valid cache, falling back to the
  bundled seed and then the built-in core. Invalid caches are ignored. A cache
  write failure logs a warning and does not prevent initialization.
- Pytest uses a temporary cache seeded before collection imports the evaluator;
  tests do not initialize from the operator's runtime cache or update source JSON.
- No database migration or new production environment variable is required. The
  default Docker user has `/app` as its home; its cache is disposable across
  container replacement. Build and recreate the pipeline container to deploy.
  Confirm the administrator keyword snapshot contains the core keywords and no
  `alpha`, `beta`, or `gamma` test entries. New startup collection may add real tags.
- Existing stored article evaluations are not recalculated by this change.
