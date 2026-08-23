from __future__ import annotations

import argparse
import json
from pathlib import Path

from .contracts import CrawlOptions, CrawlRequest, CrawlSource, EntryPoint, SourceType, utc_now
from .http_client import InfoQHttpClient
from .ids import new_crawl_run_id
from .infoq import InfoQCollector
from .pipeline import InfoQPipeline
from .storage import InMemoryRawCrawlRepository


def build_request(
    feed: str,
    maximum_article_count: int,
    maximum_age_hours: int | None,
    *,
    source_type: SourceType = SourceType.WEB_CRAWL,
    maximum_page_count: int = 5,
) -> CrawlRequest:
    path = "/news/" if feed == "news" else "/articles/"
    section_key = "NEWS" if feed == "news" else "ENGINEERING"
    now = utc_now()
    return CrawlRequest(
        crawl_run_id=new_crawl_run_id(now),
        requested_at=now,
        source=CrawlSource(
            source_id="infoq",
            source_type=source_type,
            base_url="https://www.infoq.com",
            entry_point=EntryPoint(
                url=(
                    f"https://feed.infoq.com/{feed}/"
                    if source_type is SourceType.RSS
                    else f"https://www.infoq.com/{feed}/"
                ),
                path=path,
                section_key=section_key,
            ),
        ),
        crawl_options=CrawlOptions(
            maximum_article_count=maximum_article_count,
            maximum_age_hours=maximum_age_hours,
            follow_pagination=source_type is SourceType.WEB_CRAWL,
            maximum_page_count=maximum_page_count if source_type is SourceType.WEB_CRAWL else 1,
            request_timeout_ms=15_000,
        ),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Crawl and normalize InfoQ technical news.")
    parser.add_argument("--feed", choices=("news", "articles"), default="news")
    parser.add_argument("--maximum-article-count", type=int, default=10)
    parser.add_argument("--maximum-age-hours", type=int)
    parser.add_argument("--maximum-page-count", type=int, default=5)
    parser.add_argument("--source-type", choices=("web-crawl", "rss"), default="web-crawl")
    parser.add_argument("--request", type=Path, help="Read an exact CrawlRequest JSON contract from this file.")
    parser.add_argument("--output", type=Path, help="Write newline-delimited contract events to this file.")
    args = parser.parse_args(argv)

    if args.request:
        request = CrawlRequest.from_dict(json.loads(args.request.read_text(encoding="utf-8")))
    else:
        source_type = SourceType.WEB_CRAWL if args.source_type == "web-crawl" else SourceType.RSS
        request = build_request(
            args.feed,
            args.maximum_article_count,
            args.maximum_age_hours,
            source_type=source_type,
            maximum_page_count=args.maximum_page_count,
        )
    http = InfoQHttpClient(timeout_seconds=request.crawl_options.request_timeout_ms / 1000)
    result = InfoQPipeline(
        collector=InfoQCollector(http=http),
        repository=InMemoryRawCrawlRepository(),
    ).run(request)
    serialized = "\n".join(json.dumps(event.to_dict(), ensure_ascii=False) for event in result.events())
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized + "\n", encoding="utf-8")
    else:
        print(serialized)
    return 0 if result.crawl_run_completed.status.value != "FAILED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
