from __future__ import annotations

import re

from langdetect import DetectorFactory, LangDetectException, detect_langs

from tech_articles_ingestion.errors import IngestionError

DetectorFactory.seed = 0

_FENCE_START = re.compile(r"^(`{3,})(?:[a-z0-9_+-]{1,32})?$")
_LANGUAGE_ALIASES = {
    "zh-cn": "zh",
    "zh-tw": "zh",
}


class LanguageNormalizer:
    def __init__(self, confidence_threshold: float) -> None:
        self._confidence_threshold = confidence_threshold

    def detect(self, content: str) -> tuple[str, bool]:
        detection_text = self._without_code_blocks(content)
        if not detection_text.strip():
            raise IngestionError(
                code="LANGUAGE_DETECTION_FAILED",
                message="No natural-language text remained for language detection.",
                stage="LANGUAGE",
            )
        try:
            candidates = detect_langs(detection_text)
        except LangDetectException as exc:
            raise IngestionError(
                code="LANGUAGE_DETECTION_FAILED",
                message="The article language could not be determined.",
                stage="LANGUAGE",
            ) from exc
        if not candidates:
            raise IngestionError(
                code="LANGUAGE_DETECTION_FAILED",
                message="The article language could not be determined.",
                stage="LANGUAGE",
            )
        top = candidates[0]
        language = _LANGUAGE_ALIASES.get(top.lang.casefold(), top.lang.casefold())
        if not re.fullmatch(r"[a-z]{2}", language):
            raise IngestionError(
                code="LANGUAGE_DETECTION_FAILED",
                message="The detected language is not an ISO 639-1 code.",
                stage="LANGUAGE",
            )
        return language, top.prob < self._confidence_threshold

    @staticmethod
    def _without_code_blocks(content: str) -> str:
        output: list[str] = []
        active_fence: str | None = None
        for line in content.splitlines():
            if active_fence is None:
                match = _FENCE_START.fullmatch(line)
                if match:
                    active_fence = match.group(1)
                else:
                    output.append(line)
            elif line == active_fence:
                active_fence = None
        return "\n".join(output)
