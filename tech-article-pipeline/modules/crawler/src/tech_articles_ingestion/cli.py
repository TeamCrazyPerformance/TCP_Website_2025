from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time

from tech_articles_ingestion.config import IngestionConfig
from tech_articles_ingestion.orchestrator import CloudflareIngestionOrchestrator
from tech_articles_ingestion.persistence import InMemoryIngestionRepository
from tech_articles_ingestion.sink import JsonLinesSink


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tcp-tech-ingestion",
        description="Cloudflare Blog crawler and article normalizer",
    )
    parser.add_argument(
        "command",
        choices=("run-once", "run-scheduled"),
    )
    return parser


async def _run(command: str) -> int:
    config = IngestionConfig.from_env()
    repository = InMemoryIngestionRepository()
    await repository.open()
    try:
        sink = JsonLinesSink(config.output_path)
        orchestrator = CloudflareIngestionOrchestrator(
            config,
            repository,
            sink=sink,
        )
        if command == "run-once":
            result = await orchestrator.run_once()
            print(
                json.dumps(result.crawl_run_completed, ensure_ascii=False),
                file=sys.stderr,
                flush=True,
            )
            return 0 if result.crawl_run_completed["status"] != "FAILED" else 1
        while True:
            cycle_started = time.monotonic()
            result = await orchestrator.run_once()
            print(
                json.dumps(result.crawl_run_completed, ensure_ascii=False),
                file=sys.stderr,
                flush=True,
            )
            elapsed = time.monotonic() - cycle_started
            await asyncio.sleep(max(0.0, config.scheduled_interval_seconds - elapsed))
    finally:
        await repository.close()


def main() -> None:
    args = build_parser().parse_args()
    try:
        exit_code = asyncio.run(_run(args.command))
    except KeyboardInterrupt:
        exit_code = 130
    except (ValueError, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        exit_code = 2
    raise SystemExit(exit_code)
