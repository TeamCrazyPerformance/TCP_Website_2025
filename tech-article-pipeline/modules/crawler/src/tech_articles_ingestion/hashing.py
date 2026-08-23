from __future__ import annotations

import hashlib
import json
from typing import Any

from tech_articles_ingestion.models import RssItem


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_sha256(value: Any) -> str:
    return sha256_hex(canonical_json_bytes(value))


def source_payload_document(item: RssItem) -> dict[str, Any]:
    presence = item.field_presence
    return {
        "link": {"present": presence.get("link", False), "value": item.link},
        "title": {"present": presence.get("title", False), "value": item.title},
        "creators": {
            "present": presence.get("creators", False),
            "value": item.creators,
        },
        "pubDate": {
            "present": presence.get("pubDate", False),
            "value": item.pub_date_raw,
        },
        "description": {
            "present": presence.get("description", False),
            "value": item.description,
        },
        "categories": {
            "present": presence.get("categories", False),
            "value": item.categories,
        },
        "contentEncoded": {
            "present": presence.get("contentEncoded", False),
            "value": item.content_encoded,
        },
        "channelLanguage": {
            "present": presence.get("channelLanguage", False),
            "value": item.channel_language,
        },
    }


def source_payload_hash(item: RssItem) -> str:
    return json_sha256(source_payload_document(item))
