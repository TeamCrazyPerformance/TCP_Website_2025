# syntax=docker/dockerfile:1.7
FROM python:3.12.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PIPELINE_MIGRATIONS_DIR=/app/migrations

RUN groupadd --system --gid 10001 pipeline \
    && useradd --system --uid 10001 --gid pipeline --home-dir /app pipeline \
    && pip install --no-cache-dir uv==0.11.14

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
COPY core ./core
COPY modules ./modules
COPY migrations ./migrations
RUN uv sync --frozen --no-dev \
    && chown -R pipeline:pipeline /app

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=2)"

STOPSIGNAL SIGTERM
CMD ["uvicorn", "tech_article_pipeline.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
