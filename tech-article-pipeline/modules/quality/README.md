# Quality module

Deterministic quality evaluation for normalized technical articles. The supplied
45% relevance, 30% timeliness, and 25% source-metadata formula is preserved.
The score result is self-describing: `score.axes` records each axis key, display
label, value, weight, and weighted contribution used for that evaluation. The
legacy `score.dimensions` object remains during the compatibility period.
Length, language, spam, and advertisement policies are hard gates. Invalid input
is returned through the shared failure contract instead of raising from the public API.
