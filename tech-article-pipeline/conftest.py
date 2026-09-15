"""Isolate keyword initialization before test collection imports the evaluator."""
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

_keyword_cache = TemporaryDirectory(prefix="quality-keywords-test-")
_previous_cache_dir = os.environ.get("QUALITY_KEYWORD_CACHE_DIR")
os.environ["QUALITY_KEYWORD_CACHE_DIR"] = _keyword_cache.name
shutil.copyfile(
    Path(__file__).parent / "modules/quality/src/tech_article_quality/keywords.json",
    Path(_keyword_cache.name) / "keywords.json",
)


def pytest_unconfigure(config):
    if _previous_cache_dir is None:
        os.environ.pop("QUALITY_KEYWORD_CACHE_DIR", None)
    else:
        os.environ["QUALITY_KEYWORD_CACHE_DIR"] = _previous_cache_dir
    _keyword_cache.cleanup()
