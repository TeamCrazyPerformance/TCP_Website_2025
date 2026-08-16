from __future__ import annotations

from .application import ArticleAdmissionService
from .config import MySQLSettings
from .persistence import MemoryAdmissionRepository, MySQLAdmissionRepository, MySQLConnectionPool


def create_mysql_admission_service(
    settings: MySQLSettings, *, hard_delete_enabled: bool = False
) -> ArticleAdmissionService:
    pool = MySQLConnectionPool(settings)
    repository = MySQLAdmissionRepository(pool)
    return ArticleAdmissionService(
        repository, hard_delete_enabled=hard_delete_enabled
    )


def create_mysql_admission_service_from_pool(
    pool: MySQLConnectionPool, *, hard_delete_enabled: bool = False
) -> ArticleAdmissionService:
    """Build the admission service from an application-owned shared pool."""
    return ArticleAdmissionService(
        MySQLAdmissionRepository(pool), hard_delete_enabled=hard_delete_enabled
    )


def create_memory_admission_service(
    *, hard_delete_enabled: bool = False
) -> ArticleAdmissionService:
    return ArticleAdmissionService(
        MemoryAdmissionRepository(), hard_delete_enabled=hard_delete_enabled
    )


__all__ = [
    "ArticleAdmissionService",
    "create_memory_admission_service",
    "create_mysql_admission_service",
    "create_mysql_admission_service_from_pool",
]
