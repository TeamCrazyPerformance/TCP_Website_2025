from __future__ import annotations

import pytest

from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.urls import normalize_cloudflare_url


def test_normalize_cloudflare_url_removes_tracking_and_fragment():
    assert (
        normalize_cloudflare_url(
            "https://BLOG.cloudflare.com/a/../example/?utm_source=rss&keep=1#section"
        )
        == "https://blog.cloudflare.com/example/?keep=1"
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://blog.cloudflare.com/example/",
        "https://evil.example/example/",
        "https://user@blog.cloudflare.com/example/",
        "https://blog.cloudflare.com:444/example/",
        "https://blog.cloudflare.com/preview/example/",
        "https://blog.cloudflare.com/%70review/example/",
    ],
)
def test_normalize_cloudflare_url_rejects_unsafe_targets(url):
    with pytest.raises(IngestionError):
        normalize_cloudflare_url(url)
