#!/usr/bin/env bash
set -euo pipefail

task_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_project="tcp-keyword-test-$$"
task_compose=(docker compose --env-file /dev/null -f "$task_dir/compose.keyword-test.yml" -p "$task_project")
trap '"${task_compose[@]}" down --remove-orphans >/dev/null' EXIT
"${task_compose[@]}" up -d --wait
cd "$task_dir"
env -u GEMINI_API_KEY -u LLM_API_KEY -u OPENAI_API_KEY -u GITHUB_KEYWORD_TOKEN \
  -u PIPELINE_MIGRATIONS_DIR \
  TECH_ARTICLE_MYSQL_HOST=127.0.0.1 \
  TECH_ARTICLE_MYSQL_PORT="${KEYWORD_TEST_MYSQL_PORT:-13384}" \
  TECH_ARTICLE_MYSQL_USER=keyword_test \
  TECH_ARTICLE_MYSQL_PASSWORD=keyword-test-only \
  TECH_ARTICLE_MYSQL_DATABASE=tcp_keyword_test \
  PIPELINE_TEST_MYSQL=1 RUN_LIVE_SOURCE_ADAPTERS=0 RUN_LIVE_CRAWL=0 \
  RUN_LIVE_SMOKE=0 RUN_LIVE_SDTIMES=0 RUN_DOCKER_SMOKE=0 \
  .venv/bin/python -m pytest tests/integration/test_mysql_runtime.py -v
