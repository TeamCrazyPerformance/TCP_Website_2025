from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from tech_article_pipeline.catalog import language_projection, source_projection

# score.axes가 없는 과거 평가 결과의 표시용 매핑입니다.
_LEGACY_V1_AXES = (
    {"key": "relevance", "label": "개발 관련성", "weight": 0.45},
    {"key": "timeliness", "label": "시의성", "weight": 0.30},
    {"key": "sourceReliability", "label": "출처 신뢰도", "weight": 0.25},
)
_LEGACY_V2_AXES = (
    {"key": "relevance", "label": "개발 관련성", "weight": 0.35},
    {"key": "technicalDepth", "label": "기술적 깊이", "weight": 0.30},
    {"key": "timeliness", "label": "최신성", "weight": 0.25},
    {"key": "articleQuality", "label": "기사 품질", "weight": 0.10},
)


def _finite_number(value: Any) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value if math.isfinite(value) else None


def _public_source(article: Mapping[str, Any]) -> dict[str, Any]:
    return source_projection(
        article.get("sourceId"),
        None,
        article.get("canonicalUrl"),
    )


def _scale(score: Mapping[str, Any]) -> dict[str, int | float]:
    raw = score.get("scale")
    supplied = raw if isinstance(raw, Mapping) else {}
    minimum = _finite_number(supplied.get("min"))
    maximum = _finite_number(supplied.get("max"))
    minimum = minimum if minimum is not None else 0
    maximum = maximum if maximum is not None else 100
    return {"min": minimum, "max": maximum} if maximum > minimum else {"min": 0, "max": 100}


def _supplied_breakdown(score: Mapping[str, Any]) -> list[dict[str, Any]]:
    axes = score.get("axes")
    if not isinstance(axes, list):
        return []
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in axes[:20]:
        if not isinstance(candidate, Mapping):
            continue
        key = candidate.get("key")
        label = candidate.get("label")
        value = _finite_number(candidate.get("value"))
        if not isinstance(key, str) or not key.strip() or key in seen:
            continue
        if not isinstance(label, str) or not label.strip() or len(label.strip()) > 100:
            continue
        if value is None:
            continue
        seen.add(key)
        contribution = _finite_number(candidate.get("contribution"))
        if contribution is None:
            weight = _finite_number(candidate.get("weight"))
            if weight is not None and 0 <= weight <= 1:
                contribution = round(value * weight, 2)
        result.append({"label": label.strip(), "contribution": contribution})
    return result


def _legacy_breakdown(score: Mapping[str, Any]) -> list[dict[str, Any]]:
    dimensions = score.get("dimensions")
    if not isinstance(dimensions, Mapping):
        return []
    definitions = (
        _LEGACY_V2_AXES
        if _finite_number(dimensions.get("technicalDepth")) is not None
        or _finite_number(dimensions.get("articleQuality")) is not None
        else _LEGACY_V1_AXES
    )
    result = []
    for definition in definitions:
        value = _finite_number(dimensions.get(definition["key"]))
        if value is None:
            continue
        result.append(
            {
                "label": definition["label"],
                "contribution": round(value * definition["weight"], 2),
            }
        )
    return result


def public_value_score_read(article: Mapping[str, Any]) -> dict[str, Any] | None:
    raw_score = article.get("score")
    score = raw_score if isinstance(raw_score, Mapping) else {}
    overall = _finite_number(score.get("overall"))
    if overall is None:
        overall = _finite_number(article.get("qualityScore"))
    breakdown = _supplied_breakdown(score) or _legacy_breakdown(score)
    if overall is None and not breakdown:
        return None
    return {
        "overall": overall,
        "scale": _scale(score),
        "breakdown": breakdown,
    }


def public_list_article_read(article: Mapping[str, Any]) -> dict[str, Any]:
    source = _public_source(article)
    return {
        "articleId": article.get("articleId"),
        "title": article.get("title"),
        "localizedTitle": article.get("localizedTitle"),
        "oneLineSummary": article.get("oneLineSummary"),
        "tags": list(article.get("tags") or []),
        "source": {"name": source.get("name"), "domain": source.get("domain")},
        "originalPublishedAt": article.get("originalPublishedAt"),
        "isNew": bool(article.get("isNew")),
    }


def public_detail_article_read(article: Mapping[str, Any]) -> dict[str, Any]:
    source = _public_source(article)
    return {
        "articleId": article.get("articleId"),
        "title": article.get("title"),
        "localizedTitle": article.get("localizedTitle"),
        "oneLineSummary": article.get("oneLineSummary"),
        "summaryMarkdown": article.get("summaryMarkdown"),
        "tags": list(article.get("tags") or []),
        "source": {
            "name": source.get("name"),
            "domain": source.get("domain"),
            "path": source.get("path"),
            "articleUrl": source.get("articleUrl"),
        },
        "originalLanguage": language_projection(article.get("language")),
        "originalPublishedAt": article.get("originalPublishedAt"),
        "collectedAt": article.get("collectedAt"),
        "valueScore": public_value_score_read(article),
    }
