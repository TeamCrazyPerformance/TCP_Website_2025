from __future__ import annotations

import hashlib

from tech_article_admission.fingerprints import (
    build_fingerprint,
    exact_jaccard_counts,
    normalize_content,
)


def test_golden_vector_abcde() -> None:
    fingerprint = build_fingerprint("abcde")

    assert fingerprint.normalized_content == "abcde"
    assert fingerprint.content_sha256.hex() == (
        "36bbe50ed96841d10443bcb670d6554f0a34b761be67ec9c4a8ad2c0c44ca42c"
    )
    assert fingerprint.shingle_count == 1
    assert hashlib.sha256(fingerprint.signature).hexdigest() == (
        "93620da6c032df866e690612a4a4c1a34b61c6f476c7ea336b548e10574f63c5"
    )
    assert [value.hex() for value in fingerprint.buckets] == [
        "80f087214cb5c1d0",
        "65ec174bfe26f3eb",
        "9c28a4a5c34a4ae1",
        "4ce40804a95adf2c",
        "a80e8ec60ae21ec1",
        "42fc9dc91d8a8ce6",
        "a6db32d7c3397ef1",
        "3167ef711a793db4",
        "51c0779adecd5ecc",
        "0ff33579975b4c41",
        "ba8ea1bad08c4c98",
        "14f6c2235f9410b8",
        "3114c6fa2a71a843",
        "a781541483118c66",
        "f1b81941cdb4bd08",
        "4a3b6d6a9cf757cb",
    ]


def test_normalization_and_exact_jaccard_boundaries() -> None:
    assert normalize_content("\uff21\uff22\uff23\n  def") == "ABC def"

    possible_left = build_fingerprint("ABCDEFGHIJKLM")
    possible_right = build_fingerprint("ABCDEFGHIJKLX")
    assert exact_jaccard_counts(possible_left.shingles, possible_right.shingles) == (8, 10)

    duplicate_left = build_fingerprint("ABCDEFGHIJKLMNOPQRSTUVWXYZ12")
    duplicate_right = build_fingerprint("ABCDEFGHIJKLMNOPQRSTUVWXYZ1X")
    assert exact_jaccard_counts(duplicate_left.shingles, duplicate_right.shingles) == (
        23,
        25,
    )
