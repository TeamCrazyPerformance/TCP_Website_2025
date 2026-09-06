"""Developer news AI enrichment module."""

from .service import (
    MODEL_NAME,
    PROMPT_VERSION,
    SUMMARIZER_VERSION,
    DeveloperNewsSummarizer,
    process_developer_news,
    processDeveloperNews,
)

__all__ = [
    "MODEL_NAME",
    "PROMPT_VERSION",
    "SUMMARIZER_VERSION",
    "DeveloperNewsSummarizer",
    "processDeveloperNews",
    "process_developer_news",
]

__version__ = SUMMARIZER_VERSION
