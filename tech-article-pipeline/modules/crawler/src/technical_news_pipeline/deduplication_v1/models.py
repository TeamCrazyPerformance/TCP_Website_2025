from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class DuplicateValidationError(ValueError):
    """Raised when an exact duplicate-check contract is invalid."""


@dataclass(frozen=True, slots=True)
class Fingerprints:
    content_sha256: str

    def to_dict(self) -> dict[str, str]:
        return {"contentSha256": self.content_sha256}


@dataclass(frozen=True, slots=True)
class ExactDuplicatePolicy:
    policy_version: str
    check_canonical_url: bool
    check_content_hash: bool

    @classmethod
    def from_dict(cls, value: Any) -> "ExactDuplicatePolicy":
        if not isinstance(value, dict):
            raise DuplicateValidationError("exactDuplicatePolicy must be an object")

        policy_version = value.get("policyVersion")
        if not isinstance(policy_version, str) or not policy_version.strip():
            raise DuplicateValidationError("exactDuplicatePolicy.policyVersion is required")

        checks: dict[str, bool] = {}
        for name in ("checkCanonicalUrl", "checkContentHash"):
            item = value.get(name)
            if not isinstance(item, bool):
                raise DuplicateValidationError(f"exactDuplicatePolicy.{name} must be a boolean")
            checks[name] = item

        return cls(
            policy_version=policy_version,
            check_canonical_url=checks["checkCanonicalUrl"],
            check_content_hash=checks["checkContentHash"],
        )


@dataclass(frozen=True, slots=True)
class ArticleRecord:
    article_id: str
    canonical_url: str | None
    content_sha256: str | None
