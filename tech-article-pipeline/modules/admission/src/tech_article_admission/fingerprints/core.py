from __future__ import annotations

import base64
import hashlib
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from ..constants import (
    BAND_COUNT,
    CONTENT_NORMALIZATION_VERSION,
    EXPECTED_UNICODE_VERSION,
    FINGERPRINT_ARTIFACT_VERSION,
    FINGERPRINT_VERSION,
    MAX_CONTENT_BYTES,
    MAX_UNIQUE_SHINGLES,
    ROWS_PER_BAND,
    SIGNATURE_BYTES,
    SIGNATURE_WORDS,
)
from ..errors import AdmissionError, ResourceLimitExceeded

_P = 18_446_744_073_709_551_557


@dataclass(frozen=True, slots=True)
class Fingerprint:
    version: str
    normalized_content: str
    content_sha256: bytes
    shingles: frozenset[str]
    signature: bytes
    buckets: tuple[bytes, ...]

    @property
    def shingle_count(self) -> int:
        return len(self.shingles)

    def artifact(self) -> dict[str, Any]:
        return {
            "artifactVersion": FINGERPRINT_ARTIFACT_VERSION,
            "contentNormalizationVersion": CONTENT_NORMALIZATION_VERSION,
            "fingerprintVersion": self.version,
            "contentSha256": self.content_sha256.hex(),
            "minHashSignatureBase64": base64.b64encode(self.signature).decode("ascii"),
            "shingleCount": self.shingle_count,
            "lshBuckets": [
                {"bandIndex": index, "bucketHash": value.hex()}
                for index, value in enumerate(self.buckets)
            ],
        }


def assert_runtime_unicode() -> None:
    if unicodedata.unidata_version != EXPECTED_UNICODE_VERSION:
        raise AdmissionError(
            code="SERVICE_NOT_READY",
            message=(
                "Python Unicode data does not match the fingerprint contract "
                f"({unicodedata.unidata_version} != {EXPECTED_UNICODE_VERSION})."
            ),
            retryable=True,
        )


def normalize_content(content: str) -> str:
    normalized = " ".join(unicodedata.normalize("NFKC", content).split())
    if len(normalized) < 5:
        raise AdmissionError(
            code="INVALID_INPUT",
            message="Normalized content must contain at least five Unicode code points.",
            details={
                "validationIssues": [
                    {"instancePath": "/article/content", "keyword": "minNormalizedLength"}
                ]
            },
        )
    if len(normalized.encode("utf-8")) > MAX_CONTENT_BYTES:
        raise AdmissionError(
            code="CONTENT_LIMIT_EXCEEDED",
            message="Normalized content exceeds the five MiB UTF-8 limit.",
        )
    return normalized


def create_shingles(normalized_content: str) -> frozenset[str]:
    shingles = frozenset(
        normalized_content[index : index + 5]
        for index in range(len(normalized_content) - 4)
    )
    if len(shingles) > MAX_UNIQUE_SHINGLES:
        raise ResourceLimitExceeded("UNIQUE_SHINGLE_COUNT", MAX_UNIQUE_SHINGLES)
    return shingles


@lru_cache(maxsize=8)
def _permutations(version: str) -> tuple[tuple[int, int], ...]:
    version_bytes = version.encode("utf-8")
    values: list[tuple[int, int]] = []
    for index in range(SIGNATURE_WORDS):
        index_bytes = index.to_bytes(2, "big")
        a_digest = hashlib.sha256(version_bytes + b"\x00a\x00" + index_bytes).digest()
        b_digest = hashlib.sha256(version_bytes + b"\x00b\x00" + index_bytes).digest()
        a_value = 1 + int.from_bytes(a_digest[:8], "big") % (_P - 1)
        b_value = int.from_bytes(b_digest[:8], "big") % _P
        values.append((a_value, b_value))
    return tuple(values)


def minhash_signature(shingles: frozenset[str], version: str = FINGERPRINT_VERSION) -> bytes:
    bases = tuple(
        int.from_bytes(hashlib.sha256(value.encode("utf-8")).digest()[:8], "big") % _P
        for value in shingles
    )
    words = [
        min((a_value * base + b_value) % _P for base in bases)
        for a_value, b_value in _permutations(version)
    ]
    return b"".join(word.to_bytes(8, "big") for word in words)


def lsh_buckets(signature: bytes, version: str = FINGERPRINT_VERSION) -> tuple[bytes, ...]:
    if len(signature) != SIGNATURE_BYTES:
        raise AdmissionError(
            code="FINGERPRINT_ARTIFACT_INVALID",
            message="MinHash signature must contain exactly 1,024 bytes.",
        )
    version_bytes = version.encode("utf-8")
    band_size = ROWS_PER_BAND * 8
    values: list[bytes] = []
    for band_index in range(BAND_COUNT):
        start = band_index * band_size
        band = signature[start : start + band_size]
        digest = hashlib.sha256(
            version_bytes + b"\x00band\x00" + bytes([band_index]) + band
        ).digest()
        values.append(digest[:8])
    return tuple(values)


def build_fingerprint(content: str, version: str = FINGERPRINT_VERSION) -> Fingerprint:
    normalized = normalize_content(content)
    shingles = create_shingles(normalized)
    signature = minhash_signature(shingles, version)
    return Fingerprint(
        version=version,
        normalized_content=normalized,
        content_sha256=hashlib.sha256(normalized.encode("utf-8")).digest(),
        shingles=shingles,
        signature=signature,
        buckets=lsh_buckets(signature, version),
    )


def exact_jaccard_counts(
    left: frozenset[str], right: frozenset[str]
) -> tuple[int, int]:
    return len(left & right), len(left | right)


def minhash_similarity(left: bytes, right: bytes) -> float:
    if len(left) != SIGNATURE_BYTES or len(right) != SIGNATURE_BYTES:
        raise AdmissionError(
            code="REFERENCE_DATA_INVALID",
            message="Stored MinHash signature length is invalid.",
        )
    equal = sum(
        left[index : index + 8] == right[index : index + 8]
        for index in range(0, SIGNATURE_BYTES, 8)
    )
    return equal / SIGNATURE_WORDS
