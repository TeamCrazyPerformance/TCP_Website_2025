"""GitHub Trending crawling and README normalization."""

from .contracts import (
    ArticleNormalized,
    CrawlItemProduced,
    CrawlOptions,
    CrawlRequest,
    CrawlRunCompleted,
    GitHubTrendingPipelineResult,
)
from .pipeline import GitHubTrendingPipeline

__all__ = [
    "ArticleNormalized",
    "CrawlItemProduced",
    "CrawlOptions",
    "CrawlRequest",
    "CrawlRunCompleted",
    "GitHubTrendingPipeline",
    "GitHubTrendingPipelineResult",
]

__version__ = "1.0.0"
