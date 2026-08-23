from __future__ import annotations

from collections.abc import Callable

from lxml import html

from tech_articles_ingestion.errors import IngestionError

from .text import normalize_general_text


class TableNormalizer:
    def normalize(
        self,
        table: html.HtmlElement,
        render_cell: Callable[[html.HtmlElement], str],
    ) -> str:
        if table.xpath(".//table"):
            raise IngestionError(
                code="NESTED_TABLE_UNSUPPORTED",
                message="Nested tables are not supported in the MVP normalizer.",
                stage="TABLE",
            )
        rows: list[str] = []
        for row in table.xpath(".//tr"):
            cells = row.xpath("./th | ./td")
            if not cells:
                continue
            values = [self._normalize_cell(render_cell(cell)) for cell in cells]
            if not any(values):
                continue
            rows.append(" | ".join(values))
        if not rows:
            raise IngestionError(
                code="TABLE_EXTRACTION_FAILED",
                message="A table did not contain extractable rows and cells.",
                stage="TABLE",
            )
        return "\n".join(rows)

    @staticmethod
    def _normalize_cell(value: str) -> str:
        normalized = normalize_general_text(value)
        lines = [line for line in normalized.splitlines() if line]
        return " / ".join(lines).replace("|", r"\|")
