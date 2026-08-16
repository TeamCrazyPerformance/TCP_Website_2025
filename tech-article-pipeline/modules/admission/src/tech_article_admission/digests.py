from __future__ import annotations

import hashlib
from typing import Any

import rfc8785

from .errors import AdmissionError


def canonical_json_bytes(value: Any) -> bytes:
    try:
        return rfc8785.dumps(value)
    except (TypeError, ValueError) as exc:
        raise AdmissionError(
            code="INVALID_INPUT",
            message="The request is not canonical JSON data.",
        ) from exc


def sha256_digest(value: Any) -> bytes:
    return hashlib.sha256(canonical_json_bytes(value)).digest()


def url_sha256(value: str | None) -> bytes | None:
    return None if value is None else hashlib.sha256(value.encode("utf-8")).digest()
