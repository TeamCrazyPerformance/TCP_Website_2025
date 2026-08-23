from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from ..domain.models import PreparedAdmission
from ..errors import AdmissionError
from ..fingerprints import lsh_buckets
from ..persistence.base import AdmissionRepository


class ArticleStore:
    def __init__(self, repository: AdmissionRepository) -> None:
        self._repository = repository

    def store_unique(
        self,
        tx: Any,
        *,
        article_id: str,
        origin_check_id: str,
        origin_resolution_request_id: str | None,
        prepared: PreparedAdmission,
        created_at: datetime,
    ) -> None:
        fingerprint = prepared.fingerprint
        normalized_hash = hashlib.sha256(
            fingerprint.normalized_content.encode("utf-8")
        ).digest()
        if (
            normalized_hash != fingerprint.content_sha256
            or lsh_buckets(fingerprint.signature, fingerprint.version) != fingerprint.buckets
        ):
            raise AdmissionError(
                code="FINGERPRINT_ARTIFACT_INVALID",
                message="The fingerprint artifact does not match the article content.",
            )
        self._repository.insert_article(
            tx,
            article_id=article_id,
            origin_check_id=origin_check_id,
            origin_resolution_request_id=origin_resolution_request_id,
            prepared=prepared,
            created_at=created_at,
        )
        self._repository.insert_fingerprint(
            tx,
            article_id=article_id,
            prepared=prepared,
            created_at=created_at,
        )
        self._repository.insert_buckets(
            tx,
            article_id=article_id,
            prepared=prepared,
            created_at=created_at,
        )
