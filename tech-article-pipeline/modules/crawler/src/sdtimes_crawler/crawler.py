import datetime
import json
import re
import time
from typing import List, Tuple
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import feedparser
import requests
from bs4 import BeautifulSoup

from .models import (
    CrawlRequest, CrawlItemProduced, CrawlRunCompleted, CrawlRunStatistics,
    SourceInfo, DiscoveryInfo, UrlsInfo, CrawlStatus, RawArticle, CommonError
)
from .url_normalizer import normalize_url_pipeline, make_absolute_url
from .text_normalizer import parse_to_iso8601_utc


class SDTimesCrawler:
    """
    Crawler implementation for sdtimes.com supporting:
    - WEB_CRAWL: HTML scraping of home/section pages and article details
    - API: Official WordPress REST API (https://sdtimes.com/wp-json/wp/v2/posts)
    - RSS: Official RSS 2.0 Feed (https://sdtimes.com/feed/)
    """

    DEFAULT_BASE_URL = "https://sdtimes.com"
    WP_API_ENDPOINT = "https://sdtimes.com/wp-json/wp/v2/posts"
    RSS_FEED_ENDPOINT = "https://sdtimes.com/feed/"

    ALLOWED_HOSTS = {"sdtimes.com", "www.sdtimes.com"}
    REDIRECT_CODES = {301, 302, 303, 307, 308}

    def __init__(
        self,
        crawler_version: str = "1.1.0",
        *,
        user_agent: str | None = None,
        minimum_request_interval_seconds: float = 1.0,
        maximum_response_bytes: int = 2 * 1024 * 1024,
    ):
        self.crawler_version = crawler_version
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent or "TCP-Tech-Article-Pipeline/0.2"
        })
        self.minimum_request_interval_seconds = max(0.0, minimum_request_interval_seconds)
        self.maximum_response_bytes = maximum_response_bytes
        self._last_request_at: float | None = None

    @classmethod
    def _validate_url(cls, url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in cls.ALLOWED_HOSTS:
            raise ValueError("SD Times crawler rejected a non-HTTPS or off-domain URL")
        if parsed.username or parsed.password or parsed.port not in {None, 443}:
            raise ValueError("SD Times crawler rejected URL credentials or a non-standard port")
        return url

    def _safe_get(self, url: str, *, timeout: float) -> requests.Response:
        current = self._validate_url(url)
        for _ in range(4):
            if self._last_request_at is not None:
                remaining = self.minimum_request_interval_seconds - (
                    time.monotonic() - self._last_request_at
                )
                if remaining > 0:
                    time.sleep(remaining)
            self._last_request_at = time.monotonic()
            response = self.session.get(
                current, timeout=timeout, allow_redirects=False, stream=True
            )
            if response.status_code not in self.REDIRECT_CODES:
                self._validate_url(response.url)
                response.raise_for_status()
                declared = response.headers.get("Content-Length")
                if declared and int(declared) > self.maximum_response_bytes:
                    response.close()
                    raise ValueError("SD Times response exceeded the configured size limit")
                content = bytearray()
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    content.extend(chunk)
                    if len(content) > self.maximum_response_bytes:
                        response.close()
                        raise ValueError("SD Times response exceeded the configured size limit")
                response._content = bytes(content)
                response._content_consumed = True
                return response
            location = response.headers.get("Location")
            if not location:
                response.raise_for_status()
            current = self._validate_url(urljoin(current, location))
        raise ValueError("SD Times response exceeded three redirects")

    def _robots(self, timeout: float) -> RobotFileParser:
        url = f"{self.DEFAULT_BASE_URL}/robots.txt"
        response = self._safe_get(url, timeout=timeout)
        parser = RobotFileParser(url)
        parser.parse(response.text.splitlines())
        return parser

    @staticmethod
    def _excluded_by_age(request: CrawlRequest, published_raw: str | None) -> bool:
        maximum_age = request.crawlOptions.maximumAgeHours
        if maximum_age is None:
            return False
        published_at = parse_to_iso8601_utc(published_raw)
        if published_at is None:
            return False
        parsed = datetime.datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        return datetime.datetime.now(datetime.timezone.utc) - parsed > datetime.timedelta(
            hours=maximum_age
        )

    def run_crawl(self, request: CrawlRequest) -> Tuple[List[CrawlItemProduced], CrawlRunCompleted]:
        started_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        source_type = request.source.sourceType.upper()
        
        items: List[CrawlItemProduced] = []
        stats = CrawlRunStatistics()
        run_error = None
        
        try:
            timeout_sec = request.crawlOptions.requestTimeoutMs / 1000.0
            robots = self._robots(timeout_sec)
            entry_url = {
                "API": self.WP_API_ENDPOINT,
                "RSS": self.RSS_FEED_ENDPOINT,
                "WEB_CRAWL": (
                    request.source.entryPoint.url
                    if request.source.entryPoint
                    else self.DEFAULT_BASE_URL
                ),
            }.get(source_type, self.DEFAULT_BASE_URL)
            if not robots.can_fetch(self.session.headers["User-Agent"], entry_url):
                raise PermissionError("robots.txt disallows the selected entry point")
            if source_type == "API":
                items, stats = self._crawl_api(request)
            elif source_type == "RSS":
                items, stats = self._crawl_rss(request)
            else:
                items, stats = self._crawl_web(request, robots)
            
            run_status = "COMPLETED" if stats.articlesFailed == 0 else "PARTIALLY_COMPLETED"
        except Exception as exc:
            run_status = "FAILED"
            run_error = CommonError(
                code="CRAWL_RUN_FAILED",
                message=str(exc),
                retryable=isinstance(exc, requests.RequestException),
                details={"exceptionType": type(exc).__name__},
            )
            
        completed_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        summary = CrawlRunCompleted(
            crawlRunId=request.crawlRunId,
            status=run_status,
            startedAt=started_at,
            completedAt=completed_at,
            statistics=stats,
            error=run_error,
        )
        return items, summary

    def _crawl_web(
        self, request: CrawlRequest, robots: RobotFileParser
    ) -> Tuple[List[CrawlItemProduced], CrawlRunCompleted]:
        stats = CrawlRunStatistics()
        items: List[CrawlItemProduced] = []
        
        entry_url = request.source.entryPoint.url if request.source.entryPoint else self.DEFAULT_BASE_URL
        section_key = request.source.entryPoint.sectionKey if request.source.entryPoint else "NEWS"
        source_path = request.source.entryPoint.path if request.source.entryPoint else "/"
        max_articles = request.crawlOptions.maximumArticleCount
        timeout_sec = request.crawlOptions.requestTimeoutMs / 1000.0

        # Fetch Entry Point Page
        stats.pagesVisited += 1
        resp = self._safe_get(entry_url, timeout=timeout_sec)

        soup = BeautifulSoup(resp.text, "html.parser")
        discovered_urls: List[str] = []

        # Find article links
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"].strip()
            abs_url = make_absolute_url(href, self.DEFAULT_BASE_URL)
            parsed = urlparse(abs_url)
            
            if parsed.scheme == "https" and parsed.hostname in self.ALLOWED_HOSTS:
                # Filter out tag/category/author/pagination index pages
                if not re.search(r"/(category|author|tag|page|comments|feed)/", parsed.path, re.I) and len(parsed.path) > 5:
                    if abs_url not in discovered_urls and abs_url != entry_url:
                        discovered_urls.append(abs_url)

        stats.articlesDiscovered = len(discovered_urls)
        target_urls = discovered_urls[:max_articles]
        
        item_counter = 1
        for url in target_urls:
            stats.articlesAttempted += 1
            crawl_item_id = f"crawl-item-{request.crawlRunId.replace('crawl-run-', '')}-{item_counter:03d}"
            crawled_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            try:
                if not robots.can_fetch(self.session.headers["User-Agent"], url):
                    raise PermissionError("robots.txt disallows this article URL")
                art_resp = self._safe_get(url, timeout=timeout_sec)
                final_url = art_resp.url
                status_code = art_resp.status_code

                html_body = art_resp.text
                art_soup = BeautifulSoup(html_body, "html.parser")

                # Extract Yoast JSON-LD Schema if present
                title = None
                authors = []
                published_raw = None

                json_ld = art_soup.find("script", class_="yoast-schema-graph")
                if json_ld and json_ld.string:
                    try:
                        data = json.loads(json_ld.string)
                        graph = data.get("@graph", [])
                        for item in graph:
                            if item.get("@type") in ["Article", "NewsArticle"]:
                                title = item.get("headline") or title
                                published_raw = item.get("datePublished") or published_raw
                    except Exception:
                        pass

                if not title and art_soup.title:
                    title = art_soup.title.get_text()

                # Extract OpenGraph / Meta published time / author fallback
                if not published_raw:
                    meta_time = art_soup.find("meta", attrs={"property": "article:published_time"})
                    if meta_time and meta_time.get("content"):
                        published_raw = meta_time["content"]

                if not authors:
                    meta_author = art_soup.find("meta", attrs={"name": "author"})
                    if meta_author and meta_author.get("content"):
                        authors = [meta_author["content"].strip()]
                    else:
                        byline = art_soup.find(class_=lambda c: c and "author" in c.lower())
                        if byline:
                            authors = [byline.get_text().strip()]

                if self._excluded_by_age(request, published_raw):
                    stats.articlesExcludedByAge += 1
                    continue

                disc_url, fin_url, canon_url = normalize_url_pipeline(
                    discovered_url=url,
                    final_url=final_url,
                    html_content=html_body,
                    base_url=self.DEFAULT_BASE_URL
                )

                item = CrawlItemProduced(
                    schemaVersion="1.0",
                    crawlRunId=request.crawlRunId,
                    crawlItemId=crawl_item_id,
                    source=SourceInfo(sourceId="sdtimes", sourceType="WEB_CRAWL"),
                    discovery=DiscoveryInfo(
                        entryPointUrl=entry_url,
                        discoveredFromUrl=entry_url,
                        sourcePath=source_path,
                        sectionKey=section_key
                    ),
                    urls=UrlsInfo(discoveredUrl=disc_url, finalUrl=fin_url, canonicalUrl=canon_url),
                    crawl=CrawlStatus(
                        status="SUCCESS",
                        crawledAt=crawled_at,
                        crawlerVersion=self.crawler_version,
                        httpStatusCode=status_code,
                        attempt=1
                    ),
                    rawArticle=RawArticle(
                        title=title,
                        authors=authors,
                        publishedAtRaw=published_raw,
                        contentHtml=html_body,
                        contentText=art_soup.get_text(),
                        languageHint="en"
                    )
                )
                items.append(item)
                stats.articlesSucceeded += 1
            except Exception as ex:
                stats.articlesFailed += 1
                items.append(CrawlItemProduced(
                    schemaVersion="1.0",
                    crawlRunId=request.crawlRunId,
                    crawlItemId=crawl_item_id,
                    source=SourceInfo(sourceId="sdtimes", sourceType="WEB_CRAWL"),
                    discovery=DiscoveryInfo(
                        entryPointUrl=entry_url,
                        discoveredFromUrl=entry_url,
                        sourcePath=source_path,
                        sectionKey=section_key
                    ),
                    urls=UrlsInfo(discoveredUrl=url, finalUrl=None, canonicalUrl=None),
                    crawl=CrawlStatus(
                        status="FAILED",
                        crawledAt=crawled_at,
                        crawlerVersion=self.crawler_version,
                        httpStatusCode=getattr(ex.response, 'status_code', None) if hasattr(ex, 'response') else None,
                        attempt=1,
                        error=CommonError(
                            code=(
                                "ROBOTS_DISALLOWED"
                                if isinstance(ex, PermissionError)
                                else "CRAWL_ITEM_FAILED"
                            ),
                            message=str(ex),
                            retryable=isinstance(ex, requests.RequestException),
                        )
                    )
                ))
            item_counter += 1

        return items, stats

    def _crawl_api(self, request: CrawlRequest) -> Tuple[List[CrawlItemProduced], CrawlRunCompleted]:
        stats = CrawlRunStatistics()
        items: List[CrawlItemProduced] = []
        max_articles = request.crawlOptions.maximumArticleCount
        timeout_sec = request.crawlOptions.requestTimeoutMs / 1000.0

        stats.pagesVisited += 1
        resp = self._safe_get(
            f"{self.WP_API_ENDPOINT}?per_page={max_articles}", timeout=timeout_sec
        )

        posts_data = resp.json()
        stats.articlesDiscovered = len(posts_data)

        item_counter = 1
        for post in posts_data:
            crawl_item_id = f"crawl-item-{request.crawlRunId.replace('crawl-run-', '')}-{item_counter:03d}"
            crawled_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            link = post.get("link")
            title = post.get("title", {}).get("rendered")
            content_html = post.get("content", {}).get("rendered")
            date_gmt = post.get("date_gmt") or post.get("date")

            if self._excluded_by_age(request, date_gmt):
                stats.articlesExcludedByAge += 1
                item_counter += 1
                continue
            stats.articlesAttempted += 1

            disc_url, fin_url, canon_url = normalize_url_pipeline(
                discovered_url=link,
                final_url=link,
                html_content=content_html,
                base_url=self.DEFAULT_BASE_URL
            )

            item = CrawlItemProduced(
                schemaVersion="1.0",
                crawlRunId=request.crawlRunId,
                crawlItemId=crawl_item_id,
                source=SourceInfo(sourceId="sdtimes", sourceType="API"),
                discovery=DiscoveryInfo(
                    entryPointUrl=self.WP_API_ENDPOINT,
                    discoveredFromUrl=self.WP_API_ENDPOINT,
                    sourcePath="/wp-json/wp/v2/posts",
                    sectionKey="NEWS"
                ),
                urls=UrlsInfo(discoveredUrl=disc_url, finalUrl=fin_url, canonicalUrl=canon_url),
                crawl=CrawlStatus(
                    status="SUCCESS",
                    crawledAt=crawled_at,
                    crawlerVersion=self.crawler_version,
                    httpStatusCode=200,
                    attempt=1
                ),
                rawArticle=RawArticle(
                    title=title,
                    authors=[],
                    publishedAtRaw=date_gmt,
                    contentHtml=content_html,
                    contentText=BeautifulSoup(content_html or "", "html.parser").get_text(),
                    languageHint="en"
                )
            )
            items.append(item)
            stats.articlesSucceeded += 1
            item_counter += 1

        return items, stats

    def _crawl_rss(self, request: CrawlRequest) -> Tuple[List[CrawlItemProduced], CrawlRunCompleted]:
        stats = CrawlRunStatistics()
        items: List[CrawlItemProduced] = []
        max_articles = request.crawlOptions.maximumArticleCount
        timeout_sec = request.crawlOptions.requestTimeoutMs / 1000.0

        stats.pagesVisited += 1
        response = self._safe_get(self.RSS_FEED_ENDPOINT, timeout=timeout_sec)
        feed = feedparser.parse(response.content)
        entries = feed.entries[:max_articles]
        stats.articlesDiscovered = len(entries)

        item_counter = 1
        for entry in entries:
            crawl_item_id = f"crawl-item-{request.crawlRunId.replace('crawl-run-', '')}-{item_counter:03d}"
            crawled_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            link = entry.get("link")
            title = entry.get("title")
            published_raw = entry.get("published") or entry.get("updated")
            author = entry.get("author")
            content_html = entry.get("content", [{}])[0].get("value") if entry.get("content") else entry.get("summary")

            if self._excluded_by_age(request, published_raw):
                stats.articlesExcludedByAge += 1
                item_counter += 1
                continue
            stats.articlesAttempted += 1

            disc_url, fin_url, canon_url = normalize_url_pipeline(
                discovered_url=link,
                final_url=link,
                html_content=content_html,
                base_url=self.DEFAULT_BASE_URL
            )

            item = CrawlItemProduced(
                schemaVersion="1.0",
                crawlRunId=request.crawlRunId,
                crawlItemId=crawl_item_id,
                source=SourceInfo(sourceId="sdtimes", sourceType="RSS"),
                discovery=DiscoveryInfo(
                    entryPointUrl=self.RSS_FEED_ENDPOINT,
                    discoveredFromUrl=self.RSS_FEED_ENDPOINT,
                    sourcePath="/feed/",
                    sectionKey="NEWS"
                ),
                urls=UrlsInfo(discoveredUrl=disc_url, finalUrl=fin_url, canonicalUrl=canon_url),
                crawl=CrawlStatus(
                    status="SUCCESS",
                    crawledAt=crawled_at,
                    crawlerVersion=self.crawler_version,
                    httpStatusCode=200,
                    attempt=1
                ),
                rawArticle=RawArticle(
                    title=title,
                    authors=[author] if author else [],
                    publishedAtRaw=published_raw,
                    contentHtml=content_html,
                    contentText=BeautifulSoup(content_html or "", "html.parser").get_text(),
                    languageHint="en"
                )
            )
            items.append(item)
            stats.articlesSucceeded += 1
            item_counter += 1

        return items, stats
