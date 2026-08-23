from __future__ import annotations

import json
import os
import sys

from developer_news_summarizer import DeveloperNewsSummarizer


def main() -> int:
    if not os.getenv("GEMINI_API_KEY"):
        print("GEMINI_API_KEY is required for the opt-in live smoke profile.", file=sys.stderr)
        return 2
    result = DeveloperNewsSummarizer(model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")).process(
        {
            "articleId": "manual-gemini-smoke",
            "article": {
                "title": "Python 3.12 service uses FastAPI and MySQL",
                "content": (
                    "The article explains a Python 3.12 FastAPI service that stores durable "
                    "jobs in MySQL and runs deterministic quality checks before AI enrichment."
                ),
                "language": "en",
            },
            "qualityEvaluation": {"decision": "PASS", "score": {"overall": 90}},
            "generationOptions": {
                "outputLanguage": "ko",
                "maximumSummaryLength": 300,
                "maximumOneLineSummaryLength": 100,
                "maximumTagCount": 3,
                "translateTitle": True,
                "translateContent": False,
            },
        }
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["generation"]["status"] == "SUCCESS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
