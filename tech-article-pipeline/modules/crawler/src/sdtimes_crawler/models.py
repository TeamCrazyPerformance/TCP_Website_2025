from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class CommonError(BaseModel):
    code: str
    message: str
    retryable: bool = False
    details: Optional[Dict[str, Any]] = None


class EntryPoint(BaseModel):
    url: str
    path: str
    sectionKey: str


class SourceInfo(BaseModel):
    sourceId: str = "sdtimes"
    sourceType: str = "WEB_CRAWL"  # WEB_CRAWL, RSS, API
    baseUrl: Optional[str] = "https://sdtimes.com"
    entryPoint: Optional[EntryPoint] = None


class DiscoveryInfo(BaseModel):
    entryPointUrl: str
    discoveredFromUrl: str
    sourcePath: str
    sectionKey: str = "NEWS"


class UrlsInfo(BaseModel):
    discoveredUrl: str
    finalUrl: Optional[str] = None
    canonicalUrl: Optional[str] = None


class CrawlStatus(BaseModel):
    status: str = "SUCCESS"  # SUCCESS, FAILED, PARTIAL_SUCCESS, SKIPPED
    crawledAt: str
    crawlerVersion: str = "1.0.0"
    httpStatusCode: Optional[int] = 200
    attempt: int = 1
    error: Optional[CommonError] = None


class RawArticle(BaseModel):
    title: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    publishedAtRaw: Optional[str] = None
    contentHtml: Optional[str] = None
    contentText: Optional[str] = None
    languageHint: Optional[str] = "en"


class CrawlItemProduced(BaseModel):
    schemaVersion: str = "1.0"
    crawlRunId: str
    crawlItemId: str
    source: SourceInfo
    discovery: DiscoveryInfo
    urls: UrlsInfo
    crawl: CrawlStatus
    rawArticle: Optional[RawArticle] = None


class CrawlOptions(BaseModel):
    maximumArticleCount: int = 30
    maximumAgeHours: Optional[int] = None
    followPagination: bool = False
    maximumPageCount: int = 1
    requestTimeoutMs: int = 10000


class CrawlRequest(BaseModel):
    schemaVersion: str = "1.0"
    crawlRunId: str
    requestedAt: str
    source: SourceInfo
    crawlOptions: CrawlOptions = Field(default_factory=CrawlOptions)


class CrawlRunStatistics(BaseModel):
    pagesVisited: int = 0
    articlesDiscovered: int = 0
    articlesExcludedByAge: int = 0
    articlesAttempted: int = 0
    articlesSucceeded: int = 0
    articlesFailed: int = 0


class CrawlRunCompleted(BaseModel):
    crawlRunId: str
    status: str = "COMPLETED"  # COMPLETED, PARTIALLY_COMPLETED, FAILED, CANCELLED
    startedAt: str
    completedAt: str
    statistics: CrawlRunStatistics
    error: Optional[CommonError] = None


class NormalizationOptions(BaseModel):
    defaultTimeZone: str = "UTC"
    removeBoilerplate: bool = True
    normalizeWhitespace: bool = True
    resolveCanonicalUrl: bool = True
    detectLanguage: bool = True


class ArticleNormalized(BaseModel):
    title: str
    authors: List[str] = Field(default_factory=list)
    originalPublishedAt: Optional[str] = None
    content: str
    language: str = "en"


class NormalizationResult(BaseModel):
    status: str = "SUCCESS"  # SUCCESS, FAILED
    normalizedAt: str
    normalizerVersion: str = "1.0.0"
    warnings: List[str] = Field(default_factory=list)
    error: Optional[CommonError] = None


class NormalizedDocument(BaseModel):
    crawlRunId: str
    crawlItemId: str
    source: SourceInfo
    discovery: DiscoveryInfo
    urls: UrlsInfo
    article: ArticleNormalized
    normalization: NormalizationResult
