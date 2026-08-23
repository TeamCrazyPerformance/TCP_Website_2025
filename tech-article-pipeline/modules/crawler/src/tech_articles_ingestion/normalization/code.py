from __future__ import annotations

import re

from lxml import html

from tech_articles_ingestion.errors import IngestionError

from .text import remove_control_characters

_SAFE_LANGUAGE = re.compile(r"^[a-z0-9_+-]{1,32}$")


class CodeBlockNormalizer:
    def normalize(self, pre: html.HtmlElement) -> str:
        code_elements = pre.xpath("./code")
        code = code_elements[0] if code_elements else pre
        line_elements = code.xpath(
            ".//*[contains(concat(' ', normalize-space(@class), ' '), ' line ')]"
        )
        if line_elements:
            raw_code = "\n".join(element.text_content() for element in line_elements)
        else:
            raw_code = code.text_content()
        normalized_code = self._normalize_code_text(raw_code)
        if normalized_code == "":
            raise IngestionError(
                code="CODE_BLOCK_EXTRACTION_FAILED",
                message="A code block did not contain extractable text.",
                stage="CODE_BLOCK",
            )
        maximum_backtick_run = max(
            (len(run) for run in re.findall(r"`+", normalized_code)),
            default=0,
        )
        fence = "`" * max(3, maximum_backtick_run + 1)
        language = self._language_identifier(pre, code)
        result = f"{fence}{language}\n{normalized_code}\n{fence}"
        if not result.startswith(fence) or not result.endswith(fence):
            raise IngestionError(
                code="CODE_FENCE_GENERATION_FAILED",
                message="A safe code fence could not be generated.",
                stage="CODE_BLOCK",
            )
        return result

    def normalize_inline(self, code: html.HtmlElement) -> str:
        value = remove_control_characters(
            code.text_content().replace("\r\n", "\n").replace("\r", "\n"),
            keep_newlines=False,
            keep_tabs=True,
        ).replace("\n", " ")
        maximum_backtick_run = max(
            (len(run) for run in re.findall(r"`+", value)),
            default=0,
        )
        delimiter = "`" * max(1, maximum_backtick_run + 1)
        if value.startswith((" ", "`")) or value.endswith((" ", "`")):
            value = f" {value} "
        return f"{delimiter}{value}{delimiter}"

    @staticmethod
    def _normalize_code_text(value: str) -> str:
        normalized = value.replace("\r\n", "\n").replace("\r", "\n")
        normalized = remove_control_characters(normalized, keep_newlines=True, keep_tabs=True)
        lines = [line.expandtabs(4).rstrip(" ") for line in normalized.split("\n")]
        while lines and lines[0] == "":
            lines.pop(0)
        while lines and lines[-1] == "":
            lines.pop()
        return "\n".join(lines)

    @staticmethod
    def _language_identifier(pre: html.HtmlElement, code: html.HtmlElement) -> str:
        candidates: list[str] = []
        for element in (code, pre):
            for attribute in ("data-language", "data-lang"):
                if element.get(attribute):
                    candidates.append(element.get(attribute))
            for class_name in (element.get("class") or "").split():
                if class_name.startswith("language-"):
                    candidates.append(class_name.removeprefix("language-"))
                elif class_name.startswith("lang-"):
                    candidates.append(class_name.removeprefix("lang-"))
        for candidate in candidates:
            normalized = candidate.strip().casefold()
            if _SAFE_LANGUAGE.fullmatch(normalized):
                return normalized
        return "text"
