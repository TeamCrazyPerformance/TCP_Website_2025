"""Persistence interfaces used by the in-memory pipeline integration.

The copied standalone project also contains a PostgreSQL adapter in ``postgres.py``.
It is intentionally not imported here: the canonical pipeline keeps source-local
state in memory and owns durable state in its MySQL repository.
"""

from .memory import InMemoryIngestionRepository
from .repository import IngestionRepository

__all__ = ["InMemoryIngestionRepository", "IngestionRepository"]
