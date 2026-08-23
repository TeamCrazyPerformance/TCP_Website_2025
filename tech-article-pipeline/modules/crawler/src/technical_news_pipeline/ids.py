from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4


def new_crawl_run_id(now: datetime | None = None) -> str:
    moment = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return f"crawl-run-{moment:%Y%m%d}-{uuid4().hex[:16]}"


def crawl_item_id(crawl_run_id: str, index: int) -> str:
    if index < 1:
        raise ValueError("crawl item index must be at least 1")
    suffix = crawl_run_id.removeprefix("crawl-run-")
    return f"crawl-item-{suffix}-{index:03d}"
