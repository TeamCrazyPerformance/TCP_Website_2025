# Technical article pipeline operations

The technical article pipeline is deployed as three services that are isolated
from the existing website runtime:

- `pipeline-mysql`: MySQL 8.4 and the pipeline's only durable state store.
- `pipeline-migrate`: a one-shot, checksum-verified schema migration job.
- `tech-article-pipeline`: FastAPI plus the in-process durable worker.

All three services use only the existing `internal` Docker network. Neither the
FastAPI port (`8080`) nor MySQL (`3306`) is published to the host. The current
`api`, `web`, `db`, reverse proxy, and ELK service definitions are unchanged, and
the website API deliberately has no `depends_on` relationship to this pipeline.
Pipeline failure therefore cannot block the existing website from starting.
The services are also gated by the `tech-articles` Compose profile, so ordinary
website-only `docker compose up` commands do not start or require the pipeline.

## Deployment configuration

Start from `envs/tech-article-pipeline.env.example` and inject populated values
through the deployment secret system or the root `.env` read by Docker Compose.
Do not put the service token or either MySQL password in Compose source, the
Dockerfile, or an image layer.

Before production crawling, set `CRAWLER_PUBLIC_URL` to the public crawler
information page and `CRAWLER_CONTACT` to a monitored operational address.
Cloudflare ingestion rejects runs when these identity values are absent or are
placeholders. Set `GEMINI_API_KEY` before processing real articles; otherwise
enrichment jobs will retry and eventually become dead jobs.

The NestJS facade uses the following internal-only values:

```text
TECH_ARTICLE_PIPELINE_BASE_URL=http://tech-article-pipeline:8080
PIPELINE_SERVICE_TOKEN=<the same secret injected into the pipeline>
TECH_ARTICLE_PIPELINE_READ_TIMEOUT_MS=2000
TECH_ARTICLE_PIPELINE_WRITE_TIMEOUT_MS=5000
```

Do not give NestJS MySQL credentials and do not publish the pipeline directly
through Nginx. Browser requests pass through the website's normal authentication
and authorization boundary under `/api/v1/tech-articles`. The website API has no
startup dependency on the optional profile; while the profile is stopped, only
technical-article endpoints return `503 TECH_ARTICLE_PIPELINE_UNAVAILABLE`.

## Start and verify

Build and start the isolated services. MySQL must become healthy and the migration
job must complete successfully before the application starts:

```bash
docker compose --profile tech-articles up -d --build pipeline-mysql pipeline-migrate tech-article-pipeline
docker compose --profile tech-articles ps pipeline-mysql pipeline-migrate tech-article-pipeline
```

The service has no host port. Run its readiness probe inside the container:

```bash
docker compose --profile tech-articles exec -T tech-article-pipeline python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=2).read().decode())"
```

`pipeline-migrate` exiting with code 0 is expected. The migration runner records
the filename and SHA-256 checksum for migrations `001` through `003` and refuses
to run if an already-applied migration has changed.

## Independent backup

Back up the MySQL data independently of the website's PostgreSQL backup. The dump
contains migration history, article/admission fingerprints and LSH buckets,
pending and retry jobs, review cases, settings, crawl state, and publication
events.

```bash
mkdir -p backups/tech-article-pipeline
docker compose --profile tech-articles exec -T pipeline-mysql sh -c 'exec mysqldump --single-transaction --routines --triggers -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backups/tech-article-pipeline/pipeline.sql
```

Store the resulting dump in the same protected, off-host backup system used for
other service data, but retain and restore it as an independent artifact.

## Restore drill

Use a verified dump and keep the pipeline application stopped while restoring.
This does not stop or modify the website PostgreSQL service.

```bash
docker compose --profile tech-articles stop tech-article-pipeline
docker compose --profile tech-articles up -d pipeline-mysql
docker compose --profile tech-articles exec -T pipeline-mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backups/tech-article-pipeline/pipeline.sql
docker compose --profile tech-articles run --rm pipeline-migrate
docker compose --profile tech-articles up -d tech-article-pipeline
```

After readiness succeeds, verify at minimum that migration versions `001`-`003`,
admission fingerprints/buckets, nonterminal jobs, review cases, publication
policy, crawl runs/items, and publication events are present. A production restore
should be rehearsed on a disposable MySQL volume before it is needed for recovery.
