from __future__ import annotations

import copy
import json
import re
from datetime import datetime
from typing import Any
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

from tech_articles_ingestion.errors import ContractValidationError

from .schemas import (
    CRAWL_ITEM_PRODUCED_SCHEMA,
    CRAWL_ITEM_SCHEMA_ID,
    CRAWL_RUN_COMPLETED_SCHEMA,
    CRAWL_RUN_SCHEMA_ID,
    NORMALIZATION_INPUT_SCHEMA,
    NORMALIZATION_INPUT_SCHEMA_ID,
    NORMALIZATION_OUTPUT_SCHEMA,
    NORMALIZATION_OUTPUT_SCHEMA_ID,
)

_SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
_RUN_ID = re.compile(r"^crawl-run-[A-Za-z0-9][A-Za-z0-9._-]{0,117}$")
_ITEM_ID = re.compile(r"^crawl-item-[A-Za-z0-9][A-Za-z0-9._-]{0,148}$")
_FORBIDDEN_PATH_PREFIXES = ("/_emdash/admin", "/preview/", "/fragments/")
_ERROR_BY_SCHEMA = {
    CRAWL_ITEM_SCHEMA_ID: ("CRAWL_OUTPUT_CONTRACT_VIOLATION", "CRAWL_OUTPUT_VALIDATION"),
    CRAWL_RUN_SCHEMA_ID: (
        "CRAWL_RUN_OUTPUT_CONTRACT_VIOLATION",
        "CRAWL_RUN_OUTPUT_VALIDATION",
    ),
    NORMALIZATION_INPUT_SCHEMA_ID: (
        "NORMALIZATION_INPUT_INVALID",
        "NORMALIZATION_INPUT_VALIDATION",
    ),
    NORMALIZATION_OUTPUT_SCHEMA_ID: (
        "NORMALIZED_OUTPUT_CONTRACT_VIOLATION",
        "NORMALIZATION_OUTPUT_VALIDATION",
    ),
}


def _is_cloudflare_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme != "https" or parsed.hostname != "blog.cloudflare.com":
        return False
    if parsed.username or parsed.password or port not in (None, 443) or parsed.fragment:
        return False
    path = parsed.path or "/"
    return not any(path.startswith(prefix) for prefix in _FORBIDDEN_PATH_PREFIXES)


def _is_utc_datetime(value: object) -> bool:
    if not isinstance(value, str) or not value.endswith("Z"):
        return False
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        return False
    return True


def _is_semver(value: object) -> bool:
    return isinstance(value, str) and _SEMVER.fullmatch(value) is not None


def _is_run_id(value: object) -> bool:
    return isinstance(value, str) and _RUN_ID.fullmatch(value) is not None


def _is_item_id(value: object) -> bool:
    return isinstance(value, str) and _ITEM_ID.fullmatch(value) is not None


class ContractValidator:
    def __init__(self) -> None:
        checker = FormatChecker()
        checker.checks("cloudflare-blog-https-url")(_is_cloudflare_url)
        checker.checks("utc-date-time")(_is_utc_datetime)
        checker.checks("semver")(_is_semver)
        checker.checks("crawl-run-id")(_is_run_id)
        checker.checks("crawl-item-id")(_is_item_id)
        self._validators = {
            CRAWL_ITEM_SCHEMA_ID: Draft202012Validator(
                CRAWL_ITEM_PRODUCED_SCHEMA, format_checker=checker
            ),
            CRAWL_RUN_SCHEMA_ID: Draft202012Validator(
                CRAWL_RUN_COMPLETED_SCHEMA, format_checker=checker
            ),
            NORMALIZATION_INPUT_SCHEMA_ID: Draft202012Validator(
                NORMALIZATION_INPUT_SCHEMA, format_checker=checker
            ),
            NORMALIZATION_OUTPUT_SCHEMA_ID: Draft202012Validator(
                NORMALIZATION_OUTPUT_SCHEMA, format_checker=checker
            ),
        }
        for schema in (
            CRAWL_ITEM_PRODUCED_SCHEMA,
            CRAWL_RUN_COMPLETED_SCHEMA,
            NORMALIZATION_INPUT_SCHEMA,
            NORMALIZATION_OUTPUT_SCHEMA,
        ):
            Draft202012Validator.check_schema(schema)

    def validate_crawl_item(
        self,
        payload: dict[str, Any],
        *,
        expected_run_id: str | None = None,
        expected_item_id: str | None = None,
        round_trip: bool = True,
    ) -> dict[str, Any]:
        validated = self._validate(payload, CRAWL_ITEM_SCHEMA_ID, round_trip=round_trip)
        if expected_run_id is not None and validated["crawlRunId"] != expected_run_id:
            self._semantic_failure(CRAWL_ITEM_SCHEMA_ID, "/crawlRunId", "context")
        if expected_item_id is not None and validated["crawlItemId"] != expected_item_id:
            self._semantic_failure(CRAWL_ITEM_SCHEMA_ID, "/crawlItemId", "context")
        if validated["crawl"]["status"] == "SUCCESS":
            raw = validated["rawArticle"]
            if not raw["title"].strip():
                self._semantic_failure(
                    CRAWL_ITEM_SCHEMA_ID, "/rawArticle/title", "minTrimmedLength"
                )
            if not raw["contentHtml"].strip():
                self._semantic_failure(
                    CRAWL_ITEM_SCHEMA_ID, "/rawArticle/contentHtml", "minTrimmedLength"
                )
            if not raw["contentText"].strip():
                self._semantic_failure(
                    CRAWL_ITEM_SCHEMA_ID, "/rawArticle/contentText", "minTrimmedLength"
                )
        return validated

    def validate_crawl_run(
        self,
        payload: dict[str, Any],
        *,
        expected_run_id: str | None = None,
        round_trip: bool = True,
    ) -> dict[str, Any]:
        validated = self._validate(payload, CRAWL_RUN_SCHEMA_ID, round_trip=round_trip)
        if expected_run_id is not None and validated["crawlRunId"] != expected_run_id:
            self._semantic_failure(CRAWL_RUN_SCHEMA_ID, "/crawlRunId", "context")
        started = self._parse_utc(validated["startedAt"])
        completed = self._parse_utc(validated["completedAt"])
        if completed < started:
            self._semantic_failure(CRAWL_RUN_SCHEMA_ID, "/completedAt", "chronology")
        stats = validated["statistics"]
        if stats["articlesExcludedByAge"] > stats["articlesDiscovered"]:
            self._semantic_failure(
                CRAWL_RUN_SCHEMA_ID, "/statistics/articlesExcludedByAge", "maximum"
            )
        if stats["articlesSucceeded"] + stats["articlesFailed"] != stats["articlesAttempted"]:
            self._semantic_failure(
                CRAWL_RUN_SCHEMA_ID, "/statistics/articlesAttempted", "arithmetic"
            )
        if validated["status"] == "COMPLETED" and stats["articlesFailed"] != 0:
            self._semantic_failure(CRAWL_RUN_SCHEMA_ID, "/status", "statusConsistency")
        if validated["status"] == "PARTIALLY_COMPLETED" and stats["articlesFailed"] < 1:
            self._semantic_failure(CRAWL_RUN_SCHEMA_ID, "/status", "statusConsistency")
        return validated

    def validate_normalization_input(
        self, payload: dict[str, Any], *, round_trip: bool = False
    ) -> dict[str, Any]:
        validated = self._validate(payload, NORMALIZATION_INPUT_SCHEMA_ID, round_trip=round_trip)
        raw = validated["rawArticle"]
        if (
            not (raw.get("contentHtml") or "").strip()
            and not (raw.get("contentText") or "").strip()
        ):
            self._semantic_failure(NORMALIZATION_INPUT_SCHEMA_ID, "/rawArticle", "minimumContent")
        return validated

    def validate_normalization_output(
        self,
        payload: dict[str, Any],
        *,
        expected_input: dict[str, Any] | None = None,
        round_trip: bool = True,
    ) -> dict[str, Any]:
        validated = self._validate(payload, NORMALIZATION_OUTPUT_SCHEMA_ID, round_trip=round_trip)
        if expected_input is not None:
            for key in ("crawlRunId", "crawlItemId", "source", "discovery"):
                if validated[key] != expected_input[key]:
                    self._semantic_failure(NORMALIZATION_OUTPUT_SCHEMA_ID, f"/{key}", "context")
        article = validated["article"]
        warnings = validated["normalization"]["warnings"]
        if not article["title"].strip():
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/article/title", "minTrimmedLength"
            )
        if not article["content"].strip():
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/article/content", "minTrimmedLength"
            )
        if not article["authors"] and "AUTHOR_MISSING" not in warnings:
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/normalization/warnings", "warningLinkage"
            )
        if article["originalPublishedAt"] is None and "PUBLISHED_AT_MISSING" not in warnings:
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/normalization/warnings", "warningLinkage"
            )
        if self._has_unsupported_placeholder(article["content"]):
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/article/content", "unsupportedPlaceholder"
            )
        self._validate_code_fences(article["content"])
        return validated

    def _validate(
        self, payload: dict[str, Any], schema_id: str, *, round_trip: bool
    ) -> dict[str, Any]:
        candidate = copy.deepcopy(payload)
        self._raise_schema_errors(candidate, schema_id)
        if not round_trip:
            return candidate
        try:
            serialized = json.dumps(
                candidate,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            )
            decoded = json.loads(serialized)
        except (TypeError, ValueError) as exc:
            code, stage = _ERROR_BY_SCHEMA[schema_id]
            raise ContractValidationError(
                code=code,
                message="The output is not a valid JSON value.",
                stage=stage,
                details={
                    "validationIssues": [{"instancePath": "", "keyword": "jsonSerialization"}]
                },
            ) from exc
        self._raise_schema_errors(decoded, schema_id)
        return decoded

    def _raise_schema_errors(self, payload: dict[str, Any], schema_id: str) -> None:
        errors = sorted(
            self._validators[schema_id].iter_errors(payload),
            key=lambda error: list(error.absolute_path),
        )
        if not errors:
            return
        issues = [
            {
                "instancePath": self._json_pointer(error.absolute_path),
                "keyword": str(error.validator),
            }
            for error in errors[:100]
        ]
        code, stage = _ERROR_BY_SCHEMA[schema_id]
        raise ContractValidationError(
            code=code,
            message="The payload does not satisfy its runtime contract.",
            stage=stage,
            details={"validationIssues": issues},
        )

    def _semantic_failure(self, schema_id: str, path: str, keyword: str) -> None:
        code, stage = _ERROR_BY_SCHEMA[schema_id]
        raise ContractValidationError(
            code=code,
            message=f"The payload violates semantic rules for {schema_id}.",
            stage=stage,
            details={"validationIssues": [{"instancePath": path, "keyword": keyword}]},
        )

    def _validate_code_fences(self, content: str) -> None:
        open_fence: tuple[str, int] | None = None
        code_lines: list[str] = []
        for line_number, line in enumerate(content.splitlines(), start=1):
            match = re.match(r"^(`{3,})([a-z0-9_+-]{1,32})?$", line)
            if open_fence is None:
                if match:
                    open_fence = (match.group(1), line_number)
                    code_lines = []
                continue
            fence, _ = open_fence
            if line == fence:
                maximum_run = max(
                    (len(run) for run in re.findall(r"`+", "\n".join(code_lines))),
                    default=0,
                )
                if len(fence) <= maximum_run:
                    self._semantic_failure(
                        NORMALIZATION_OUTPUT_SCHEMA_ID,
                        "/article/content",
                        "codeFenceLength",
                    )
                open_fence = None
                code_lines = []
            else:
                code_lines.append(line)
        if open_fence is not None:
            self._semantic_failure(
                NORMALIZATION_OUTPUT_SCHEMA_ID, "/article/content", "codeFenceClosure"
            )

    @staticmethod
    def _has_unsupported_placeholder(content: str) -> bool:
        lowered = content.casefold()
        return any(
            marker in lowered
            for marker in (
                "unsupported block: code",
                "unsupported block: table",
                "unsupported block: htmlblock",
            )
        )

    @staticmethod
    def _parse_utc(value: str) -> datetime:
        return datetime.fromisoformat(value[:-1] + "+00:00")

    @staticmethod
    def _json_pointer(path: Any) -> str:
        parts = [str(part).replace("~", "~0").replace("/", "~1") for part in path]
        return "" if not parts else "/" + "/".join(parts)
