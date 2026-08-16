from __future__ import annotations

import os
from dataclasses import dataclass

from .errors import AdmissionError


@dataclass(frozen=True, slots=True)
class MySQLSettings:
    host: str
    port: int
    user: str
    password: str
    database: str
    pool_name: str = "tcp_article_admission"
    pool_size: int = 5
    connect_timeout_seconds: int = 10

    @classmethod
    def from_env(cls, prefix: str = "TECH_ARTICLE_MYSQL_") -> MySQLSettings:
        def required(name: str) -> str:
            value = os.getenv(f"{prefix}{name}")
            if value is None or not value.strip():
                raise AdmissionError(
                    code="CONFIGURATION_ERROR",
                    message=f"Missing required environment variable {prefix}{name}.",
                )
            return value

        try:
            port = int(os.getenv(f"{prefix}PORT", "3306"))
            pool_size = int(os.getenv(f"{prefix}POOL_SIZE", "5"))
            timeout = int(os.getenv(f"{prefix}CONNECT_TIMEOUT_SECONDS", "10"))
        except ValueError as exc:
            raise AdmissionError(
                code="CONFIGURATION_ERROR",
                message="MySQL numeric configuration is invalid.",
            ) from exc
        value = cls(
            host=required("HOST"),
            port=port,
            user=required("USER"),
            password=required("PASSWORD"),
            database=required("DATABASE"),
            pool_name=os.getenv(f"{prefix}POOL_NAME", "tcp_article_admission"),
            pool_size=pool_size,
            connect_timeout_seconds=timeout,
        )
        value.validate()
        return value

    def validate(self) -> None:
        if not 1 <= self.port <= 65_535:
            raise AdmissionError("CONFIGURATION_ERROR", "MySQL port is invalid.")
        if not 1 <= self.pool_size <= 32:
            raise AdmissionError("CONFIGURATION_ERROR", "MySQL pool size must be 1 through 32.")
        if not 1 <= self.connect_timeout_seconds <= 120:
            raise AdmissionError("CONFIGURATION_ERROR", "MySQL connect timeout is invalid.")
        for name, value in (
            ("host", self.host),
            ("user", self.user),
            ("database", self.database),
        ):
            if not value.strip():
                raise AdmissionError(
                    "CONFIGURATION_ERROR", f"MySQL {name} must not be blank."
                )
