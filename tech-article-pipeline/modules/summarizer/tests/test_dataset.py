from __future__ import annotations

from pathlib import Path

from developer_news_summarizer.models import DeveloperNewsInput

DATASET = (
    Path(__file__).parents[1]
    / "datasets"
    / "infoq_cloudflare_cdnjs_input.json"
)


def test_infoq_dataset_matches_input_contract():
    request = DeveloperNewsInput.model_validate_json(DATASET.read_text(encoding="utf-8"))

    assert request.article_id == "infoq-20260814-cloudflare-cdnjs-migration"
    assert request.article.language == "en"
    assert request.quality_evaluation is not None
    assert request.quality_evaluation.decision == "PASS"
    assert request.generation_options.output_language == "ko"
    assert request.generation_options.maximum_tag_count == 3
    assert request.generation_options.translate_title is True
    assert request.generation_options.translate_content is False
