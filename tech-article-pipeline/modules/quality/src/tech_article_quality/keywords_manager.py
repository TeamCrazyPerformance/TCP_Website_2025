"""
2계층 동적 키워드 관리자 (2-Layer Keyword Manager)
Layer 1: 영구 보존 코어 사전 (Core Immutable Set - 프로그래밍 언어 & 주요 인프라)
Layer 2: 동적 트렌딩 키워드 (Dynamic Trending Set - Stack Overflow & GitHub 수집, 슬라이딩 윈도우 250개)
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import tempfile
import urllib.request
import zlib
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Protocol

# =====================================================================
# Layer 1: 절대로 삭제되지 않는 영구 보존 코어 사전 (Core Immutable Set)
# =====================================================================
CORE_IMMUTABLE_KEYWORDS: frozenset[str] = frozenset({
    # 1. 프로그래밍 언어
    "python", "java", "c", "cpp", "csharp", "rust", "golang", "typescript", "javascript",
    "swift", "kotlin", "php", "ruby", "scala", "dart", "elixir", "zig", "lua", "haskell",
    "clojure", "shell", "bash", "assembly", "fortran", "r", "julia",

    # 2. 필수 프레임워크 & 런타임
    "react", "vue", "angular", "nextjs", "nuxt", "svelte", "express", "django", "fastapi",
    "flask", "spring", "spring-boot", "nestjs", "rails", "laravel", "dotnet", "aspnet",
    "flutter", "react-native", "pytorch", "tensorflow", "keras", "huggingface", "langchain",

    # 3. 인프라, 클라우드, 데이터베이스 & DevOps
    "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform", "ansible", "linux",
    "unix", "nginx", "apache", "sql", "postgresql", "mysql", "redis", "mongodb", "elasticsearch",
    "kafka", "rabbitmq", "sqlite", "graphql", "grpc", "rest-api", "ci-cd", "jenkins",

    # 4. 로우레벨 시스템 / 네트워크 / 성능 최적화 핵심어
    "dns", "cache", "memory", "optimization", "socket", "bpf", "ebpf", "kernel", "buffer",
    "allocation", "latency", "throughput", "tcp", "udp", "packet", "network", "process",
    "thread", "struct", "algorithm", "hash-table", "lru", "trie", "system", "benchmark",
    "profiling", "garbage-collection", "cpu", "concurrency", "async", "io", "non-blocking",
    "event-loop", "epoll", "kqueue", "microservices", "architecture"
})

# 일반 글에서도 흔히 등장하는 무분별한 단어 차단 불용어 리스트
STOPWORDS: frozenset[str] = frozenset({
    "app", "apps", "test", "tests", "demo", "sample", "example", "doc", "docs", "log",
    "logs", "common", "config", "args", "arg", "file", "files", "item", "items", "data",
    "info", "value", "values", "main", "core", "base", "util", "utils", "helper", "helpers",
    "node", "nodes", "project", "projects", "code", "codes", "array", "arrays", "object",
    "excel", "string", "strings", "number", "numbers", "user", "users", "text", "texts",
    "news", "latest", "update", "updates", "guide", "guides", "tutorial", "tutorials",
    "best", "free", "tool", "tools", "library", "libraries", "framework", "frameworks",
    "software", "development", "developer", "developers", "engineering", "technology",
    "technologies", "tech", "ai"
})

# Repository topics are user supplied.  These broad product/platform/event
# labels do not establish that an article is technically about development, so
# they must not enter the dynamic relevance dictionary.
DYNAMIC_KEYWORD_STOPWORDS: frozenset[str] = STOPWORDS | frozenset({
    "agent", "agents", "apple", "hacktoberfest", "lume", "manus", "operator", "operators",
    "skill", "skills",
})


def normalize_keyword(raw_term: str) -> set[str]:
    """
    수집된 복잡한 키워드를 정규화하는 함수:
    - 특수문자, 조직 스코프(@.../), 패키지 접미사 제거
    - 띄어쓰기가 포함된 구문 키워드(github actions 등)는 하이픈 연결(github-actions) 및 개별 단어로 정제
    """
    term = raw_term.lower().strip()
    
    # 1. 조직 스코프 제거 (@boost/cli -> cli)
    if term.startswith("@") and "/" in term:
        term = term.split("/", 1)[1]
        
    # 2. 띄어쓰기 정규화 ("github actions" -> "github-actions")
    term_hyphenated = re.sub(r"\s+", "-", term)
    
    # 3. 단어 추출
    tokens = set(re.findall(r"[a-z0-9\-\.\#\+]+", term_hyphenated))
    
    results = set()
    for token in tokens:
        # 특수 기호 정리
        cleaned = token.strip(".-_")
        if len(cleaned) >= 2 and cleaned not in STOPWORDS:
            results.add(cleaned)
            
    if len(term_hyphenated) >= 3 and term_hyphenated not in STOPWORDS:
        results.add(term_hyphenated)
        
    return results


STACKEXCHANGE_MAX_PAGE_SIZE = 100
GITHUB_TRENDING_REPOSITORY_LIMIT = 3
# The dictionary retains up to 250 dynamic keywords.  Daily collection is
# limited to half of that capacity so one day's source fluctuation cannot
# replace the whole retained dictionary at once. Stack Overflow has a direct
# tag-popularity signal; GitHub topics do not, so their daily intake is smaller.
MAX_DYNAMIC_KEYWORDS = 250
DAILY_DYNAMIC_COLLECTION_LIMIT = 125
STACKOVERFLOW_DYNAMIC_ALLOCATION = 100
GITHUB_TRENDING_DYNAMIC_ALLOCATION = 25
assert (
    STACKOVERFLOW_DYNAMIC_ALLOCATION + GITHUB_TRENDING_DYNAMIC_ALLOCATION
    == DAILY_DYNAMIC_COLLECTION_LIMIT
), "daily source allocations must match the daily collection limit"


class _GitHubTrendingRepositoryParser(HTMLParser):
    """Extract repository paths from GitHub Trending without a third-party parser."""

    def __init__(self) -> None:
        super().__init__()
        self._inside_heading = False
        self.repositories: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "h2":
            self._inside_heading = True
            return
        if tag != "a" or not self._inside_heading:
            return
        href = dict(attrs).get("href", "")
        parts = href.strip("/").split("/")
        if len(parts) == 2 and all(parts):
            repository = (parts[0], parts[1])
            if repository not in self.repositories:
                self.repositories.append(repository)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h2":
            self._inside_heading = False


def fetch_stackoverflow_popular_tags(limit: int = STACKEXCHANGE_MAX_PAGE_SIZE) -> list[str]:
    """Stack Overflow API에서 실시간 인기 기술 태그 수집.

    Stack Exchange는 ``pagesize``를 최대 100으로 제한한다. 호출자가 더 큰
    값을 전달하더라도 요청 자체가 400으로 실패하지 않도록 여기서 제한한다.
    """
    page_size = max(1, min(limit, STACKEXCHANGE_MAX_PAGE_SIZE))
    url = (
        "https://api.stackexchange.com/2.3/tags?"
        f"pagesize={page_size}&order=desc&sort=popular&site=stackoverflow"
    )
    extracted: list[str] = []
    seen: set[str] = set()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data_bytes = resp.read()
            try:
                data_text = zlib.decompress(data_bytes, 15 + 32).decode("utf-8")
            except Exception:
                data_text = data_bytes.decode("utf-8")
            data = json.loads(data_text)
            for item in data.get("items", []):
                tag_name = item.get("name", "")
                norm = normalize_keyword(tag_name)
                for keyword in sorted(norm):
                    if keyword not in seen:
                        seen.add(keyword)
                        extracted.append(keyword)
    except Exception:
        # Do not let an external-source failure break article evaluation, but
        # retain the traceback so an empty dictionary is diagnosable.
        logger.warning("Stack Overflow keyword collection failed", exc_info=True)
    return extracted


def fetch_github_trending_keywords(limit: int = GITHUB_TRENDING_REPOSITORY_LIMIT) -> list[str]:
    """Collect explicit topics from the daily GitHub Trending repositories.

    GitHub Trending itself is an HTML ranking, but the terms used here come from
    the public repository-topics REST endpoint.  Repository names and free-form
    descriptions are deliberately excluded: both add product-name noise to a
    relevance dictionary.  Public resources work without a token; an optional
    ``GITHUB_KEYWORD_TOKEN`` only increases the available API rate limit.
    """
    repository_limit = max(1, min(limit, GITHUB_TRENDING_REPOSITORY_LIMIT))
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "tech-article-quality-keyword-collector",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_KEYWORD_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        trending_request = urllib.request.Request(
            "https://github.com/trending?since=daily", headers=headers
        )
        with urllib.request.urlopen(trending_request, timeout=6) as response:
            page = response.read().decode("utf-8", errors="replace")
        parser = _GitHubTrendingRepositoryParser()
        parser.feed(page)
        repositories = parser.repositories[:repository_limit]
        if not repositories:
            logger.warning("GitHub Trending returned no repositories")
            return []

        extracted: list[str] = []
        seen: set[str] = set()
        for owner, repository in repositories:
            topic_request = urllib.request.Request(
                f"https://api.github.com/repos/{owner}/{repository}/topics", headers=headers
            )
            with urllib.request.urlopen(topic_request, timeout=6) as response:
                payload = json.loads(response.read().decode("utf-8"))
            for topic in payload.get("names", []):
                if isinstance(topic, str):
                    for keyword in sorted(normalize_keyword(topic)):
                        if keyword not in seen:
                            seen.add(keyword)
                            extracted.append(keyword)
        return extracted
    except Exception:
        # The Stack Overflow source remains usable when GitHub is unavailable.
        logger.warning("GitHub Trending keyword collection failed", exc_info=True)
        return []


# Bundled seed is read-only; runtime updates must never modify tracked source files.
SEED_KEYWORD_PATH = Path(__file__).with_name("keywords.json")
CACHE_DIR = Path(os.environ.get(
    "QUALITY_KEYWORD_CACHE_DIR", str(Path.home() / ".cache" / "tech-article-quality")
))
KEYWORD_JSON_PATH = str(CACHE_DIR / "keywords.json")
KEYWORD_HISTORY_PATH = str(CACHE_DIR / "keywords_history.json")
logger = logging.getLogger(__name__)


class KeywordDictionaryStore(Protocol):
    """Persistence boundary owned by the pipeline, not by this library."""

    def load_active_keyword_dictionary(self) -> dict[str, Any] | None: ...

    def save_keyword_dictionary(
        self, *, keywords: set[str], source: str, previous_keywords: set[str]
    ) -> dict[str, Any]: ...

    def record_keyword_update_failure(self, *, source: str, error_message: str) -> None: ...

    def upsert_keyword_observations(self, *, observations: list[dict[str, str]]) -> None: ...

    def load_keyword_observations(self, *, limit: int) -> list[dict[str, str]]: ...


KEYWORD_STORE: KeywordDictionaryStore | None = None


def configure_keyword_store(store: KeywordDictionaryStore | None) -> None:
    """Configure durable storage from the pipeline runtime."""
    global KEYWORD_STORE
    KEYWORD_STORE = store


def _atomic_write_json(path: str, payload: dict) -> None:
    target = Path(path)
    if target.resolve() in {
        SEED_KEYWORD_PATH.resolve(), SEED_KEYWORD_PATH.with_name("keywords_history.json").resolve()
    }:
        raise OSError("Keyword cache must not overwrite bundled source data")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent,
                                         delete=False) as handle:
            temporary = handle.name
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        os.replace(temporary, target)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)

CACHE_TTL_SECONDS = 86_400  # 마지막 성공 저장 시점부터 24시간


def record_keyword_history_diff(old_keywords: set[str], new_keywords: set[str]) -> None:
    """키워드 사전 갱신 시 변경점(추가된 키워드, 제거된 키워드, 수집 날짜)을 keywords_history.json에 자동 기록"""
    old_dynamic = set(old_keywords) - CORE_IMMUTABLE_KEYWORDS
    new_dynamic = set(new_keywords) - CORE_IMMUTABLE_KEYWORDS

    added = sorted(list(new_dynamic - old_dynamic))
    removed = sorted(list(old_dynamic - new_dynamic))

    now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    entry = {
        "timestamp": now_str,
        "total_count": len(new_keywords),
        "added_count": len(added),
        "removed_count": len(removed),
        "added_keywords": added,
        "removed_keywords": removed,
        "summary": f"추가된 키워드: {len(added)}개 | 제거된 키워드: {len(removed)}개",
    }

    history_list = []
    if os.path.exists(KEYWORD_HISTORY_PATH):
        try:
            with open(KEYWORD_HISTORY_PATH, "r", encoding="utf-8") as f:
                history_list = json.load(f).get("history", [])
                if not isinstance(history_list, list):
                    history_list = []
        except Exception:
            history_list = []

    history_list.insert(0, entry)

    _atomic_write_json(KEYWORD_HISTORY_PATH, {"history": history_list})


def save_keywords_to_json(combined_keywords: frozenset[str] | set[str]) -> str:
    """별도 런타임 캐시에 사전 및 변경 이력을 저장합니다."""
    old_keywords = load_keywords_from_json() or set()
    new_keywords = set(combined_keywords) | CORE_IMMUTABLE_KEYWORDS

    core_list = sorted(list(CORE_IMMUTABLE_KEYWORDS))
    dynamic_list = sorted(list(new_keywords - CORE_IMMUTABLE_KEYWORDS))
    all_combined = sorted(list(new_keywords))

    payload = {
        "metadata": {
            "total_count": len(all_combined),
            "core_count": len(core_list),
            "dynamic_count": len(dynamic_list),
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
        },
        "layer_1_core_immutable_keywords": core_list,
        "layer_2_dynamic_trending_keywords": dynamic_list,
        "all_combined_keywords": all_combined,
    }
    _atomic_write_json(KEYWORD_JSON_PATH, payload)

    # 히스토리 변경점 자동 기록
    record_keyword_history_diff(set(old_keywords), new_keywords)

    return KEYWORD_JSON_PATH


def load_keywords_from_json(path: str | Path | None = None) -> frozenset[str] | None:
    """Read a valid dictionary; malformed caches are ignored without blocking startup."""
    try:
        with open(path if path is not None else KEYWORD_JSON_PATH, encoding="utf-8") as handle:
            data = json.load(handle)
        keywords = data.get("all_combined_keywords")
        if keywords is None:
            keywords = (data.get("layer_1_core_immutable_keywords", [])
                        + data.get("layer_2_dynamic_trending_keywords", []))
        if not isinstance(keywords, list) or not keywords:
            return None
        if not all(isinstance(word, str) and word.strip() == word and word for word in keywords):
            return None
        return frozenset(keywords) | CORE_IMMUTABLE_KEYWORDS
    except (OSError, ValueError, TypeError, AttributeError):
        return None


def _snapshot_keywords(snapshot: dict[str, Any] | None) -> frozenset[str] | None:
    if not isinstance(snapshot, dict):
        return None
    keywords = snapshot.get("keywords")
    if not isinstance(keywords, list) or not keywords:
        return None
    if not all(isinstance(keyword, str) and keyword.strip() == keyword for keyword in keywords):
        return None
    return frozenset(keywords) | CORE_IMMUTABLE_KEYWORDS


def _snapshot_is_fresh(snapshot: dict[str, Any]) -> bool:
    updated_at = snapshot.get("updatedAt")
    if not isinstance(updated_at, str):
        return False
    try:
        parsed = datetime.fromisoformat(updated_at.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return False
    return 0 <= (datetime.now(UTC) - parsed).total_seconds() < CACHE_TTL_SECONDS


def _record_failure(error_message: str, *, source: str) -> None:
    if KEYWORD_STORE is None:
        return
    try:
        KEYWORD_STORE.record_keyword_update_failure(source=source, error_message=error_message)
    except Exception:
        logger.warning("Keyword update failure could not be recorded in durable storage")


def _filter_ordered_candidates(candidates: object, *, limit: int) -> list[str]:
    """Keep source order while applying exact-string de-duplication and filters."""
    if not isinstance(candidates, (list, tuple, set, frozenset)):
        return []
    filtered: list[str] = []
    seen: set[str] = set()
    for keyword in candidates:
        if not isinstance(keyword, str):
            continue
        normalized = keyword.strip().lower()
        if (
            not normalized
            or normalized in seen
            or normalized in DYNAMIC_KEYWORD_STOPWORDS
            or normalized in CORE_IMMUTABLE_KEYWORDS
        ):
            continue
        seen.add(normalized)
        filtered.append(normalized)
        if len(filtered) >= limit:
            break
    return filtered


def _merge_daily_candidates(stackoverflow_tags: object, github_tags: object) -> list[dict[str, str]]:
    """Union source quotas in collection order, retaining the first source on overlap."""
    merged: list[dict[str, str]] = []
    seen: set[str] = set()
    for source, candidates, limit in (
        ("stack-overflow", stackoverflow_tags, STACKOVERFLOW_DYNAMIC_ALLOCATION),
        ("github-trending", github_tags, GITHUB_TRENDING_DYNAMIC_ALLOCATION),
    ):
        for keyword in _filter_ordered_candidates(candidates, limit=limit):
            if keyword not in seen:
                seen.add(keyword)
                merged.append({"keyword": keyword, "source": source})
    return merged


def get_combined_developer_keywords(
    max_dynamic_capacity: int = 250, *, force_refresh: bool = False
) -> frozenset[str]:
    """Load the active DB dictionary, refreshing an expired version when necessary.

    File cache remains only as a compatibility fallback when the runtime has not
    configured a durable store (for standalone library use and older deployments).
    """
    snapshot: dict[str, Any] | None = None
    if KEYWORD_STORE is not None:
        try:
            snapshot = KEYWORD_STORE.load_active_keyword_dictionary()
        except Exception:
            logger.warning("Keyword dictionary could not be read from durable storage")
    cached = _snapshot_keywords(snapshot)
    if KEYWORD_STORE is None:
        cached = load_keywords_from_json()
    fallback = cached or load_keywords_from_json(SEED_KEYWORD_PATH) or CORE_IMMUTABLE_KEYWORDS
    if cached and not force_refresh:
        if snapshot is not None and _snapshot_is_fresh(snapshot):
            return cached
        if KEYWORD_STORE is None:
            try:
                if 0 <= time.time() - os.path.getmtime(KEYWORD_JSON_PATH) < CACHE_TTL_SECONDS:
                    return cached
            except OSError:
                pass

    daily_candidates = _merge_daily_candidates(
        fetch_stackoverflow_popular_tags(), fetch_github_trending_keywords()
    )
    if not daily_candidates:
        logger.warning("Keyword refresh returned no tags; retaining the last valid dictionary")
        _record_failure(
            "Stack Overflow and GitHub Trending returned no usable tags",
            source="stack-overflow+github-trending",
        )
        return fallback
    dynamic_capacity = min(max_dynamic_capacity, MAX_DYNAMIC_KEYWORDS)
    dynamic_keywords = [item["keyword"] for item in daily_candidates]
    if KEYWORD_STORE is not None:
        try:
            KEYWORD_STORE.upsert_keyword_observations(observations=daily_candidates)
            observed = KEYWORD_STORE.load_keyword_observations(limit=dynamic_capacity)
            dynamic_keywords = [
                item["keyword"] for item in observed
                if isinstance(item, dict) and isinstance(item.get("keyword"), str)
            ][:dynamic_capacity]
        except Exception:
            logger.warning("Keyword observations could not be updated; using today's candidates")
    combined = CORE_IMMUTABLE_KEYWORDS | frozenset(dynamic_keywords)
    if KEYWORD_STORE is not None:
        try:
            KEYWORD_STORE.save_keyword_dictionary(
                keywords=set(combined),
                source="stack-overflow+github-trending",
                previous_keywords=set(cached or ()),
            )
        except Exception:
            logger.warning("Keyword dictionary could not be saved to durable storage")
            _record_failure("Durable storage write failed", source="stack-overflow+github-trending")
    else:
        try:
            save_keywords_to_json(combined)
        except OSError:
            logger.warning("Keyword cache could not be saved; using refreshed keywords in memory")
    return combined
