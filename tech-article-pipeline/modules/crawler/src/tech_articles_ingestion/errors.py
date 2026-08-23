from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class IngestionError(Exception):
    code: str
    message: str
    retryable: bool = False
    stage: str | None = None
    http_status_code: int | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"

    def to_internal_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
            "details": dict(self.details),
        }
        if self.stage is not None:
            payload["stage"] = self.stage
        if self.http_status_code is not None:
            payload["httpStatusCode"] = self.http_status_code
        return payload

    def to_contract_dict(self) -> dict[str, Any]:
        allowed_detail_keys = {
            "maximumAttempts",
            "retryAfterSeconds",
            "retryAfterRaw",
            "failureStage",
            "validationIssues",
        }
        details = {key: value for key, value in self.details.items() if key in allowed_detail_keys}
        if self.stage is not None:
            details.setdefault("failureStage", self.stage)
        return {
            "code": self.code,
            "message": self.message[:1000],
            "retryable": self.retryable,
            "details": details,
        }


class ContractValidationError(IngestionError):
    pass


class PersistenceError(IngestionError):
    pass
