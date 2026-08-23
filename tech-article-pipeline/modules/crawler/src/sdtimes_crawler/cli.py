import argparse
import json
import os
import sys
from datetime import datetime, timezone

from .models import CrawlRequest, SourceInfo, CrawlOptions, EntryPoint
from .crawler import SDTimesCrawler
from .normalizer import SDTimesNormalizer


def main():
    parser = argparse.ArgumentParser(description="SD Times Crawler & Normalizer Module CLI")
    parser.add_argument("--source-type", choices=["WEB_CRAWL", "API", "RSS"], default="WEB_CRAWL",
                        help="Extraction method (WEB_CRAWL, API, RSS)")
    parser.add_argument("--max-count", type=int, default=5, help="Maximum articles to crawl")
    parser.add_argument("--output-dir", type=str, default="./output", help="Directory to save JSON output")
    
    args = parser.parse_args()

    now_str = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    crawl_run_id = f"crawl-run-{now_str}"

    request = CrawlRequest(
        schemaVersion="1.0",
        crawlRunId=crawl_run_id,
        requestedAt=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        source=SourceInfo(
            sourceId="sdtimes",
            sourceType=args.source_type,
            baseUrl="https://sdtimes.com",
            entryPoint=EntryPoint(
                url="https://sdtimes.com",
                path="/",
                sectionKey="NEWS"
            )
        ),
        crawlOptions=CrawlOptions(
            maximumArticleCount=args.max_count,
            requestTimeoutMs=10000
        )
    )

    print(f"[*] Starting Crawl Run: {crawl_run_id} (Source Type: {args.source_type}, Max: {args.max_count})")
    crawler = SDTimesCrawler()
    raw_items, run_summary = crawler.run_crawl(request)

    print(f"[+] Crawl Completed. Succeeded: {run_summary.statistics.articlesSucceeded}, Failed: {run_summary.statistics.articlesFailed}")

    normalizer = SDTimesNormalizer()
    normalized_docs = [normalizer.normalize(item) for item in raw_items]

    os.makedirs(args.output_dir, exist_ok=True)
    
    # Save Run Summary
    summary_path = os.path.join(args.output_dir, f"{crawl_run_id}_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(run_summary.model_dump(), f, indent=2, ensure_ascii=False)

    # Save Normalized Articles
    docs_path = os.path.join(args.output_dir, f"{crawl_run_id}_normalized_docs.json")
    with open(docs_path, "w", encoding="utf-8") as f:
        json.dump([doc.model_dump() for doc in normalized_docs], f, indent=2, ensure_ascii=False)

    print(f"[+] Saved output files to {args.output_dir}:")
    print(f"    - Summary: {summary_path}")
    print(f"    - Normalized Docs: {docs_path}")


if __name__ == "__main__":
    main()
