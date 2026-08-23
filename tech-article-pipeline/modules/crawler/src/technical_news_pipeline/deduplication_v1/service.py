from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable, Iterable

from .fingerprint import create_fingerprints
from .models import DuplicateValidationError, ExactDuplicatePolicy, Fingerprints
from .repository import DuplicateArticleRepository, InMemoryDuplicateArticleRepository


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class ExactDuplicateCheckService:
    def __init__(
        self,
        repository: DuplicateArticleRepository,
        *,
        now: Callable[[], datetime] = _utc_now,
    ) -> None:
        self.repository = repository
        self.now = now

    def check(self, normalized: dict[str, Any], exact_policy: dict[str, Any]) -> dict[str, Any]:
        checked_at = self.now()
        policy_version = exact_policy.get("policyVersion") if isinstance(exact_policy, dict) else None
        fingerprints: Fingerprints | None = None
        try:
            policy = ExactDuplicatePolicy.from_dict(exact_policy)
            article, canonical_url = self._validate_input(normalized)
            fingerprints = create_fingerprints(article["content"])

            if policy.check_canonical_url and canonical_url:
                matched = self.repository.find_by_canonical_url(canonical_url)
                if matched is not None:
                    return self._duplicate(
                        normalized,
                        policy,
                        checked_at,
                        fingerprints,
                        matched_article_id=matched.article_id,
                        matched_by="CANONICAL_URL",
                    )

            if policy.check_content_hash:
                matched = self.repository.find_by_content_sha256(fingerprints.content_sha256)
                if matched is not None:
                    return self._duplicate(
                        normalized,
                        policy,
                        checked_at,
                        fingerprints,
                        matched_article_id=matched.article_id,
                        matched_by="CONTENT_HASH",
                    )

            return self._handoff(normalized, policy, checked_at, fingerprints)
        except DuplicateValidationError as exc:
            return self._failed(normalized, checked_at, policy_version, fingerprints,
                                "INVALID_DUPLICATE_INPUT", str(exc), retryable=False)
        except Exception as exc:
            return self._failed(normalized, checked_at, policy_version, fingerprints,
                                "DUPLICATE_CHECK_FAILED", str(exc), retryable=True)

    @staticmethod
    def _validate_input(normalized: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
        if not isinstance(normalized, dict):
            raise DuplicateValidationError("normalized input must be an object")
        normalization = normalized.get("normalization")
        if not isinstance(normalization, dict) or normalization.get("status") != "SUCCESS":
            raise DuplicateValidationError("normalization.status must be SUCCESS")
        for name in ("crawlRunId", "crawlItemId"):
            if not isinstance(normalized.get(name), str) or not normalized[name]:
                raise DuplicateValidationError(f"{name} is required")
        source = normalized.get("source")
        if not isinstance(source, dict):
            raise DuplicateValidationError("source is required")
        if not isinstance(source.get("sourceId"), str) or not source["sourceId"]:
            raise DuplicateValidationError("source.sourceId is required")
        article = normalized.get("article")
        if not isinstance(article, dict):
            raise DuplicateValidationError("article is required")
        for name in ("title", "content", "language"):
            if not isinstance(article.get(name), str) or not article[name].strip():
                raise DuplicateValidationError(f"article.{name} must be a non-empty string")
        urls = normalized.get("urls")
        if not isinstance(urls, dict):
            raise DuplicateValidationError("urls is required")
        canonical_url = urls.get("canonicalUrl")
        if canonical_url is not None and (
            not isinstance(canonical_url, str) or not canonical_url.strip()
        ):
            raise DuplicateValidationError("urls.canonicalUrl must be a non-empty string or null")
        return article, canonical_url

    @staticmethod
    def _duplicate(
        normalized: dict[str, Any],
        policy: ExactDuplicatePolicy,
        checked_at: datetime,
        fingerprints: Fingerprints,
        *,
        matched_article_id: str,
        matched_by: str,
    ) -> dict[str, Any]:
        return {
            "crawlRunId": normalized["crawlRunId"],
            "crawlItemId": normalized["crawlItemId"],
            "fingerprints": fingerprints.to_dict(),
            "duplicateCheck": {
                "status": "SUCCESS",
                "decision": "DUPLICATE",
                "checkedAt": _iso_utc(checked_at),
                "policyVersion": policy.policy_version,
                "matchedArticleId": matched_article_id,
                "matchedBy": [matched_by],
                "candidates": [
                    {"articleId": matched_article_id, "matchedBy": [matched_by]}
                ],
                "error": None,
            },
        }

    @staticmethod
    def _handoff(
        normalized: dict[str, Any],
        policy: ExactDuplicatePolicy,
        checked_at: datetime,
        fingerprints: Fingerprints,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "crawlRunId": normalized["crawlRunId"],
            "crawlItemId": normalized["crawlItemId"],
        }
        for name in ("source", "discovery", "urls", "article", "normalization"):
            if name in normalized:
                result[name] = deepcopy(normalized[name])
        result["fingerprints"] = fingerprints.to_dict()
        result["exactDuplicateCheck"] = {
            "status": "SUCCESS",
            "decision": "NO_EXACT_MATCH",
            "checkedAt": _iso_utc(checked_at),
            "policyVersion": policy.policy_version,
            "matchedArticleId": None,
            "matchedBy": [],
            "error": None,
        }
        return result

    @staticmethod
    def _failed(
        normalized: Any,
        checked_at: datetime,
        policy_version: Any,
        fingerprints: Fingerprints | None,
        code: str,
        message: str,
        *,
        retryable: bool,
    ) -> dict[str, Any]:
        payload = normalized if isinstance(normalized, dict) else {}
        return {
            "crawlRunId": payload.get("crawlRunId"),
            "crawlItemId": payload.get("crawlItemId"),
            "fingerprints": fingerprints.to_dict() if fingerprints else None,
            "exactDuplicateCheck": {
                "status": "FAILED",
                "decision": None,
                "checkedAt": _iso_utc(checked_at),
                "policyVersion": policy_version,
                "matchedArticleId": None,
                "matchedBy": [],
                "error": {"code": code, "message": message, "retryable": retryable},
            },
        }


def check_exact_duplicate(
    normalized: dict[str, Any],
    existing_articles: Iterable[dict[str, Any]],
    exact_policy: dict[str, Any],
    *,
    checked_at: datetime | None = None,
) -> dict[str, Any]:
    """Run URL and content-hash checks without a database adapter."""
    repository = InMemoryDuplicateArticleRepository.from_dicts(existing_articles)
    service = ExactDuplicateCheckService(repository, now=lambda: checked_at or _utc_now())
    return service.check(normalized, exact_policy)
