from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Protocol


class NormalizedArticleSink(Protocol):
    async def emit(self, payload: dict[str, Any]) -> None: ...


class JsonLinesSink:
    def __init__(self, output_path: str | None = None) -> None:
        self._output_path = Path(output_path).expanduser().resolve() if output_path else None
        self._lock = asyncio.Lock()

    async def emit(self, payload: dict[str, Any]) -> None:
        line = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        async with self._lock:
            if self._output_path is None:
                print(line, file=sys.stdout, flush=True)
                return
            await asyncio.to_thread(self._append_line, line)

    def _append_line(self, line: str) -> None:
        assert self._output_path is not None
        self._output_path.parent.mkdir(parents=True, exist_ok=True)
        with self._output_path.open("a", encoding="utf-8", newline="\n") as output:
            output.write(line)
            output.write("\n")
