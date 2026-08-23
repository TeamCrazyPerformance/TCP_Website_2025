from __future__ import annotations

from typing import Any, Protocol


class AdmissionPort(Protocol):
    def admit(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    def resolve_review(self, payload: dict[str, Any]) -> dict[str, Any]: ...


class QualityPort(Protocol):
    def evaluate(self, input_data: dict[str, Any]) -> dict[str, Any]: ...


class SummarizerPort(Protocol):
    def process(self, input_data: dict[str, Any]) -> dict[str, Any]: ...
