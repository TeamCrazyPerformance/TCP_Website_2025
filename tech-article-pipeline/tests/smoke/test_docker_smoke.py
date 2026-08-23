from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest
import yaml

pytestmark = pytest.mark.docker_smoke
ROOT = Path(__file__).parents[2]
COMPOSE = ROOT / "compose.local.yml"


def run_compose(*arguments: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE), *arguments],
        cwd=ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def wait_ready(environment: dict[str, str], *, timeout_seconds: int = 90) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            run_compose(
                "exec",
                "-T",
                "tech-article-pipeline",
                "python",
                "-c",
                "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready')",
                env=environment,
            )
            return
        except subprocess.CalledProcessError:
            time.sleep(2)
    raise AssertionError("pipeline readiness timed out")


def test_compose_migration_restart_persistence_and_secret_free_image():
    if os.getenv("RUN_DOCKER_SMOKE") != "1" or shutil.which("docker") is None:
        pytest.skip("set RUN_DOCKER_SMOKE=1 on a Docker host")
    environment = os.environ.copy()
    environment.update(
        {
            "PIPELINE_SERVICE_TOKEN": "docker-smoke-service-token-not-for-production",
            "TECH_ARTICLE_MYSQL_PASSWORD": "docker-smoke-database-password",
            "TECH_ARTICLE_MYSQL_ROOT_PASSWORD": "docker-smoke-root-password",
        }
    )
    run_compose("up", "-d", "--build", env=environment)
    try:
        wait_ready(environment)
        run_compose("restart", "pipeline-mysql", "tech-article-pipeline", env=environment)
        wait_ready(environment)
        image_id = run_compose("images", "-q", "tech-article-pipeline", env=environment).stdout.strip()
        inspected = subprocess.run(
            ["docker", "image", "inspect", image_id],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        assert environment["PIPELINE_SERVICE_TOKEN"] not in inspected
        assert environment["TECH_ARTICLE_MYSQL_PASSWORD"] not in inspected
    finally:
        run_compose("down", env=environment)


def test_compose_yaml_is_structurally_valid_without_docker():
    document = yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))
    assert set(document["services"]) >= {
        "pipeline-mysql",
        "pipeline-migrate",
        "tech-article-pipeline",
        "pipeline-gemini-smoke",
    }
    assert document["services"]["tech-article-pipeline"].get("ports") is None
