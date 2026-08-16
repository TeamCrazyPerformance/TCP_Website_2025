from pathlib import Path

import yaml

WEBSITE_ROOT = Path(__file__).parents[2]
COMPOSE = WEBSITE_ROOT / "docker-compose.yml"
PROFILE = ["tech-articles"]


def _compose() -> dict:
    return yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))


def test_pipeline_services_are_internal_and_profile_isolated():
    services = _compose()["services"]

    for name in ("pipeline-mysql", "pipeline-migrate", "tech-article-pipeline"):
        service = services[name]
        assert service["profiles"] == PROFILE
        assert service["networks"] == ["internal"]
        assert "ports" not in service


def test_pipeline_startup_does_not_gate_the_existing_api():
    services = _compose()["services"]
    api_dependencies = services["api"].get("depends_on", {})

    assert "pipeline-mysql" not in api_dependencies
    assert "pipeline-migrate" not in api_dependencies
    assert "tech-article-pipeline" not in api_dependencies


def test_pipeline_waits_for_mysql_and_checksum_verified_migrations():
    services = _compose()["services"]
    dependencies = services["tech-article-pipeline"]["depends_on"]

    assert dependencies["pipeline-mysql"]["condition"] == "service_healthy"
    assert dependencies["pipeline-migrate"]["condition"] == "service_completed_successfully"
    assert services["pipeline-migrate"]["command"] == [
        "python",
        "-m",
        "tech_article_pipeline.persistence.migrate",
    ]
    assert "pipeline-mysql-data" in _compose()["volumes"]
