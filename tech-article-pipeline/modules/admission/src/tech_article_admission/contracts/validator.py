from __future__ import annotations

import copy
import json
import math
from collections.abc import Iterable
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

from ..constants import EXTERNAL_POLICY_VERSION, MAX_CONTENT_BYTES
from ..errors import AdmissionError
from .schemas import (
    ARTICLE_ADMISSION_REQUEST_SCHEMA,
    HARD_DELETE_REQUEST_SCHEMA,
    RESOLUTION_REQUEST_SCHEMA,
)


def _is_utc_datetime(value: object) -> bool:
    if not isinstance(value, str) or not value.endswith("Z"):
        return False
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        return False
    return parsed.utcoffset() is not None and parsed.utcoffset().total_seconds() == 0


class ContractValidator:
    def __init__(self) -> None:
        checker = FormatChecker()
        checker.checks("utc-date-time")(_is_utc_datetime)
        self._admission = Draft202012Validator(
            ARTICLE_ADMISSION_REQUEST_SCHEMA,
            format_checker=checker,
        )
        self._resolution = Draft202012Validator(
            RESOLUTION_REQUEST_SCHEMA,
            format_checker=checker,
        )
        self._hard_delete = Draft202012Validator(HARD_DELETE_REQUEST_SCHEMA)

    def validate_admission(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = copy.deepcopy(payload)
        self._reject_invalid_object_keys(value)
        policy = value.get("duplicatePolicy") if isinstance(value, dict) else None
        policy_version = policy.get("policyVersion") if isinstance(policy, dict) else None
        if isinstance(policy_version, str) and policy_version != EXTERNAL_POLICY_VERSION:
            raise AdmissionError(
                code="POLICY_VERSION_UNSUPPORTED",
                message="The duplicate policy version is not supported.",
                details={"policyVersion": policy_version},
            )
        self._schema_validate(self._admission, value)
        self._reject_non_json_values(value)
        self._reject_surrogates(value)

        urls = value["urls"]
        for name in ("discoveredUrl", "finalUrl", "canonicalUrl"):
            raw = urls.get(name)
            if raw is None:
                continue
            self._validate_http_url(raw, f"/urls/{name}")
            if len(raw.encode("utf-8")) > 65_535:
                self._fail(f"/urls/{name}", "maxUtf8Bytes")

        article = value["article"]
        if len(article["content"].encode("utf-8")) > MAX_CONTENT_BYTES:
            raise AdmissionError(
                code="CONTENT_LIMIT_EXCEEDED",
                message="Article content exceeds the five MiB UTF-8 limit.",
            )
        if not article["title"].strip():
            self._fail("/article/title", "nonBlank")
        if not value["source"]["sourceId"].strip():
            self._fail("/source/sourceId", "nonBlank")

        policy = value["duplicatePolicy"]
        if policy["possibleDuplicateThreshold"] > policy["duplicateTitleThreshold"]:
            self._fail("/duplicatePolicy/possibleDuplicateThreshold", "thresholdOrder")
        policy.setdefault("maximumCandidateCount", 100)

        return self._json_round_trip(value)

    def validate_resolution(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = copy.deepcopy(payload)
        self._reject_invalid_object_keys(value)
        self._schema_validate(self._resolution, value)
        self._reject_non_json_values(value)
        self._reject_surrogates(value)
        action = value["action"]
        matched = value["matchedArticleId"]
        if action == "APPROVE_UNIQUE" and matched is not None:
            self._fail("/matchedArticleId", "actionCombination")
        if action == "CONFIRM_DUPLICATE" and matched is None:
            self._fail("/matchedArticleId", "actionCombination")
        return self._json_round_trip(value)

    def validate_hard_delete(self, payload: dict[str, Any]) -> dict[str, Any]:
        value = copy.deepcopy(payload)
        self._reject_invalid_object_keys(value)
        self._schema_validate(self._hard_delete, value)
        self._reject_non_json_values(value)
        self._reject_surrogates(value)
        return self._json_round_trip(value)

    def _schema_validate(self, validator: Draft202012Validator, value: Any) -> None:
        errors = sorted(validator.iter_errors(value), key=lambda error: list(error.absolute_path))
        if not errors:
            return
        issues = [
            {
                "instancePath": self._json_pointer(error.absolute_path),
                "keyword": str(error.validator),
            }
            for error in errors[:100]
        ]
        raise AdmissionError(
            code="INVALID_INPUT",
            message="The request does not satisfy the article admission contract.",
            details={"validationIssues": issues},
        )

    def _reject_non_json_values(self, value: Any, path: str = "") -> None:
        if isinstance(value, float) and not math.isfinite(value):
            self._fail(path, "finite")
        if isinstance(value, dict):
            for key, child in value.items():
                self._reject_non_json_values(child, f"{path}/{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                self._reject_non_json_values(child, f"{path}/{index}")

    def _reject_invalid_object_keys(self, value: Any, path: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if not isinstance(key, str):
                    self._fail(path, "stringObjectKey")
                if any(0xD800 <= ord(char) <= 0xDFFF for char in key):
                    self._fail(path, "unicodeScalarObjectKey")
                self._reject_invalid_object_keys(child, f"{path}/{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                self._reject_invalid_object_keys(child, f"{path}/{index}")

    def _reject_surrogates(self, value: Any, path: str = "") -> None:
        if isinstance(value, str):
            if any(0xD800 <= ord(char) <= 0xDFFF for char in value):
                self._fail(path, "unicodeScalarValue")
        elif isinstance(value, dict):
            for key, child in value.items():
                self._reject_surrogates(child, f"{path}/{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                self._reject_surrogates(child, f"{path}/{index}")

    def _validate_http_url(self, value: str, path: str) -> None:
        try:
            parsed = urlsplit(value)
            port = parsed.port
        except ValueError:
            self._fail(path, "absoluteHttpUrl")
            return
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or (port is not None and not 1 <= port <= 65_535)
        ):
            self._fail(path, "absoluteHttpUrl")

    def _fail(self, path: str, keyword: str) -> None:
        raise AdmissionError(
            code="INVALID_INPUT",
            message="The request does not satisfy the article admission contract.",
            details={"validationIssues": [{"instancePath": path, "keyword": keyword}]},
        )

    @staticmethod
    def _json_pointer(path: Iterable[Any]) -> str:
        values = [str(part).replace("~", "~0").replace("/", "~1") for part in path]
        return "" if not values else "/" + "/".join(values)

    @staticmethod
    def _json_round_trip(value: dict[str, Any]) -> dict[str, Any]:
        try:
            return json.loads(
                json.dumps(
                    value,
                    ensure_ascii=False,
                    allow_nan=False,
                    separators=(",", ":"),
                )
            )
        except (TypeError, ValueError) as exc:
            raise AdmissionError(
                code="INVALID_INPUT",
                message="The request must contain only JSON-compatible values.",
            ) from exc
