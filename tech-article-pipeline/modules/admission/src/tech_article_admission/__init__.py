"""TCP technical article admission package."""

from .config import MySQLSettings
from .errors import AdmissionError
from .facade import (
    ArticleAdmissionService,
    create_memory_admission_service,
    create_mysql_admission_service,
    create_mysql_admission_service_from_pool,
)

__all__ = [
    "AdmissionError",
    "ArticleAdmissionService",
    "MySQLSettings",
    "create_memory_admission_service",
    "create_mysql_admission_service",
    "create_mysql_admission_service_from_pool",
]

__version__ = "0.1.0"
