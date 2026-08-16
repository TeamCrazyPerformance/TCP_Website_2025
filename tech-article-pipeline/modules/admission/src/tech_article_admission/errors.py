from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AdmissionError(Exception):
    code: str
    message: str
    retryable: bool = False
    details: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        Exception.__init__(self, self.message)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
        }
        if self.details:
            payload["details"] = self.details
        return payload


class ResourceLimitExceeded(AdmissionError):
    def __init__(self, resource: str, limit: int) -> None:
        super().__init__(
            code="RESOURCE_LIMIT_EXCEEDED",
            message="The duplicate check exceeded a deterministic resource limit.",
            details={"resource": resource, "limit": limit},
        )
