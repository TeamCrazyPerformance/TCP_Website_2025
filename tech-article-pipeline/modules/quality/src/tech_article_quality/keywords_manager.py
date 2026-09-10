"""
2계층 동적 키워드 관리자 (2-Layer Keyword Manager)
Layer 1: 영구 보존 코어 사전 (Core Immutable Set - 프로그래밍 언어 & 주요 인프라)
Layer 2: 동적 트렌딩 키워드 (Dynamic Trending Set - Stack Overflow & GitHub 수집, 슬라이딩 윈도우 250개)
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.request
import zlib
from typing import Set

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


KEYWORD_JSON_PATH = os.path.join(os.path.dirname(__file__), "keywords.json")
KEYWORD_HISTORY_PATH = os.path.join(os.path.dirname(__file__), "keywords_history.json")
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
        except Exception:
            history_list = []

    history_list.insert(0, entry)

    with open(KEYWORD_HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump({"history": history_list}, f, ensure_ascii=False, indent=2)


def save_keywords_to_json(combined_keywords: frozenset[str] | set[str]) -> str:
    """모듈 디렉터리 내부 keywords.json 에 키워드 동적 영구 저장 및 히스토리 기록"""
    old_keywords = load_keywords_from_json() or set()
    new_keywords = set(combined_keywords)

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
    with open(KEYWORD_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # 히스토리 변경점 자동 기록
    record_keyword_history_diff(set(old_keywords), new_keywords)

    return KEYWORD_JSON_PATH


def load_keywords_from_json() -> frozenset[str] | None:
    """keywords.json 파일이 존재하면 읽어서 frozenset으로 반환"""
    if os.path.exists(KEYWORD_JSON_PATH):
        try:
            with open(KEYWORD_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                all_keywords = data.get("all_combined_keywords") or (
                    data.get("layer_1_core_immutable_keywords", [])
                    + data.get("layer_2_dynamic_trending_keywords", [])
                )
                if all_keywords:
                    return frozenset(all_keywords)
        except Exception:
            pass
    return None


def get_combined_developer_keywords(max_dynamic_capacity: int = 250) -> frozenset[str]:
    """
    Layer 1 (코어 영구 보존 키워드) + Layer 2 (동적 트렌딩 키워드) 결합
    - 하루 1회 (24시간) 동기화 주기 적용: keywords.json 이 24시간 이내면 즉시 캐시 사용
    - 24시간 초과 시 API 실시간 호출 후 keywords.json 자동 갱신
    """
    # 24시간 이내의 유효한 캐시가 있으면 외부 API 호출 없이 즉시 로드 (0ms 초고속)
    if os.path.exists(KEYWORD_JSON_PATH):
        file_age = time.time() - os.path.getmtime(KEYWORD_JSON_PATH)
        if file_age < CACHE_TTL_SECONDS:
            cached = load_keywords_from_json()
            if cached:
                return cached

    # 24시간이 넘었거나 파일이 없으면 API 실시간 수집 및 갱신
    dynamic_tags = fetch_stackoverflow_popular_tags(limit=150)
    
    # 불용어 제거 및 고정 크기 제한 (최대 250개)
    filtered_dynamic = {tag for tag in dynamic_tags if tag not in STOPWORDS and tag not in CORE_IMMUTABLE_KEYWORDS}
    sorted_dynamic = sorted(list(filtered_dynamic))[:max_dynamic_capacity]
    
    combined = set(CORE_IMMUTABLE_KEYWORDS).union(sorted_dynamic)
    frozenset_combined = frozenset(combined)
    
    # 모듈 상대 경로 내부 keywords.json 영구 보존 저장
    save_keywords_to_json(frozenset_combined)
    return frozenset_combined
