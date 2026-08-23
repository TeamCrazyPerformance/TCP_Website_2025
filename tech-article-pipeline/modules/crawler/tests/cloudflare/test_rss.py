from __future__ import annotations

import pytest

from tech_articles_ingestion.errors import IngestionError
from tech_articles_ingestion.hashing import source_payload_hash
from tech_articles_ingestion.rss import CloudflareRssParser


def test_rss_parser_preserves_repeated_namespaced_fields(config, fixture_dir):
    feed = CloudflareRssParser(config).parse((fixture_dir / "cloudflare-rss.xml").read_bytes())
    item = feed.items[0]
    assert item.creators == ["Jane Doe", "John Doe"]
    assert item.categories == ["Developers"]
    assert item.channel_language == "en-us"
    assert item.field_presence["contentEncoded"] is True
    assert source_payload_hash(item) == item.source_payload_hash


def test_rss_parser_rejects_dtd(config):
    xml = (
        b'<!DOCTYPE rss [<!ENTITY x "boom">]>'
        b'<rss version="2.0"><channel><item>&x;</item></channel></rss>'
    )
    with pytest.raises(IngestionError) as raised:
        CloudflareRssParser(config).parse(xml)
    assert raised.value.code == "RSS_DTD_NOT_ALLOWED"
