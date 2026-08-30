"""Pydantic models for the section 10 input and output contracts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# 소스가 늘어나도 공통 검색 필터로 사용할 수 있도록 상위 주제를 사용한다.
ALLOWED_TAGS = (
    "AI",
    "애플리케이션 개발",
    "모바일",
    "프로그래밍 언어",
    "데이터",
    "클라우드",
    "DevOps",
    "보안",
    "네트워크",
    "소프트웨어 아키텍처",
    "개발자 도구",
    "소프트웨어 품질",
    "오픈소스",
    "개발 조직",
    "산업 동향",
)


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class Article(ContractModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    language: str | None = None


class QualityScore(ContractModel):
    overall: int | float


class QualityEvaluation(ContractModel):
    decision: Literal["PASS", "REJECT", "REVIEW_REQUIRED"]
    score: QualityScore | None = None


class GenerationOptions(ContractModel):
    output_language: str = Field(alias="outputLanguage", pattern=r"^[A-Za-z]{2}$")
    maximum_summary_length: int = Field(alias="maximumSummaryLength", ge=1)
    maximum_one_line_summary_length: int = Field(
        alias="maximumOneLineSummaryLength", ge=1
    )
    maximum_tag_count: int = Field(alias="maximumTagCount", ge=0)
    translate_title: bool = Field(alias="translateTitle")
    translate_content: bool = Field(alias="translateContent")

    @field_validator("output_language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        return value.lower()


class DeveloperNewsInput(ContractModel):
    article_id: str = Field(alias="articleId", min_length=1)
    article: Article
    quality_evaluation: QualityEvaluation | None = Field(
        alias="qualityEvaluation", default=None
    )
    generation_options: GenerationOptions = Field(alias="generationOptions")


class GeneratedEnrichmentPayload(ContractModel):
    """Structured Gemini response before it is rendered to public Markdown."""

    localized_title: str | None = Field(alias="localizedTitle")
    tags: list[str]
    one_line_summary: str = Field(alias="oneLineSummary")
    key_points: list[str] = Field(alias="keyPoints")
    check_points: list[str] = Field(alias="checkPoints")
    localized_content: str | None = Field(alias="localizedContent")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        invalid = sorted(set(values) - set(ALLOWED_TAGS))
        if invalid:
            raise ValueError(f"허용되지 않은 태그: {invalid}")
        if len(values) != len(set(values)):
            raise ValueError("태그는 중복될 수 없습니다.")
        return values


class EnrichmentPayload(ContractModel):
    localized_title: str | None = Field(alias="localizedTitle")
    tags: list[str]
    one_line_summary: str = Field(alias="oneLineSummary")
    summary: str
    localized_content: str | None = Field(alias="localizedContent")

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        invalid = sorted(set(values) - set(ALLOWED_TAGS))
        if invalid:
            raise ValueError(f"허용되지 않은 태그: {invalid}")
        if len(values) != len(set(values)):
            raise ValueError("태그는 중복될 수 없습니다.")
        return values


class ErrorPayload(ContractModel):
    code: str
    message: str
    retryable: bool
    details: dict[str, Any] = Field(default_factory=dict)


class GenerationResult(ContractModel):
    status: Literal["SUCCESS", "FAILED"]
    generated_at: str = Field(alias="generatedAt")
    model: str
    prompt_version: str = Field(alias="promptVersion")
    input_token_count: int = Field(alias="inputTokenCount", ge=0)
    output_token_count: int = Field(alias="outputTokenCount", ge=0)
    error: ErrorPayload | None


class EnrichmentResult(ContractModel):
    article_id: str = Field(alias="articleId")
    enrichment: dict[str, Any] | None
    generation: GenerationResult
