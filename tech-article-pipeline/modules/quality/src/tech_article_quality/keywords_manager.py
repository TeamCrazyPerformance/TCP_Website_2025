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
from pathlib import Path

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
    "excel", "string", "strings", "number", "numbers", "user", "users", "text", "texts"
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


def fetch_stackoverflow_popular_tags(limit: int = 150) -> set[str]:
    """Stack Overflow API에서 실시간 인기 기술 태그 수집"""
    url = f"https://api.stackexchange.com/2.3/tags?pagesize={limit}&order=desc&sort=popular&site=stackoverflow"
    extracted = set()
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
                extracted.update(norm)
    except Exception:
        pass
    return extracted


# Bundled seed is read-only; runtime updates must never modify tracked source files.
SEED_KEYWORD_PATH = Path(__file__).with_name("keywords.json")
CACHE_DIR = Path(os.environ.get(
    "QUALITY_KEYWORD_CACHE_DIR", str(Path.home() / ".cache" / "tech-article-quality")
))
KEYWORD_JSON_PATH = str(CACHE_DIR / "keywords.json")
KEYWORD_HISTORY_PATH = str(CACHE_DIR / "keywords_history.json")
logger = logging.getLogger(__name__)


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

CACHE_TTL_SECONDS = 86_400  # 24시간 (하루 1회 자정 동기화 주기)


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


def get_combined_developer_keywords(max_dynamic_capacity: int = 250) -> frozenset[str]:
    """Refresh at process start after 24h; keep the last valid dictionary on failure."""
    cached = load_keywords_from_json()
    fallback = cached or load_keywords_from_json(SEED_KEYWORD_PATH) or CORE_IMMUTABLE_KEYWORDS
    if cached:
        try:
            if 0 <= time.time() - os.path.getmtime(KEYWORD_JSON_PATH) < CACHE_TTL_SECONDS:
                return cached
        except OSError:
            pass

    dynamic_tags = fetch_stackoverflow_popular_tags(limit=150)
    if not dynamic_tags:
        logger.warning("Keyword refresh returned no tags; retaining the last valid dictionary")
        return fallback
    filtered = dynamic_tags - STOPWORDS - CORE_IMMUTABLE_KEYWORDS
    combined = CORE_IMMUTABLE_KEYWORDS | frozenset(sorted(filtered)[:max_dynamic_capacity])
    try:
        save_keywords_to_json(combined)
    except OSError:
        logger.warning("Keyword cache could not be saved; using refreshed keywords in memory")
    return combined
