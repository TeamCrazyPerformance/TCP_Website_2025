# Technical article service operations

The deployed technical-article feature is a three-tier path:

```text
browser → reverse-proxy → web / NestJS API → FastAPI pipeline → pipeline MySQL
                                      └──── existing PostgreSQL (other domains)
```

`pipeline-mysql`, `pipeline-migrate`, and `tech-article-pipeline` remain isolated
behind the Compose `tech-articles` profile and the private Docker network. MySQL
and FastAPI have no host ports. NestJS has no pipeline MySQL or Gemini credential
and no startup `depends_on` edge to the pipeline. If the pipeline is unavailable,
only its facade endpoints return `503 TECH_ARTICLE_PIPELINE_UNAVAILABLE`.

Operational and development setup scripts always enable the profile even though
manual website-only Compose use may omit it. The canonical production deployment
is:

```bash
bash CICDtools/update_all.sh
```

For a pipeline-only deployment use `bash CICDtools/update_pipeline.sh`. It builds
without replacing the current service, waits for MySQL, runs the checksum-enforced
`pipeline-migrate` job, recreates FastAPI, and verifies `/health/ready` plus the
API-to-pipeline route. Exit code 0 from the one-shot migration container is the
expected healthy terminal state.

## Configuration ownership

Root `.env` owns Compose interpolation for:

- shared internal service token;
- pipeline MySQL database/user/application/root credentials;
- worker tuning;
- Gemini key/model;
- crawler public URL/contact.

`envs/api.env` owns only API configuration. Compose injects the internal pipeline
URL, shared token, and timeouts into NestJS. It never injects Gemini or MySQL
credentials there. Run `set_env.sh prod|dev` rather than copying placeholder
secrets. Production requires Gemini; readiness checks never invoke Gemini.

For routine changes, use:

```bash
bash CICDtools/update_tech_article_config.sh gemini-key
bash CICDtools/update_tech_article_config.sh gemini-model
bash CICDtools/update_tech_article_config.sh crawler-identity
bash CICDtools/update_tech_article_config.sh service-token
```

The command preserves all unrelated environment bytes and rolls back both the
file and affected service configuration if readiness fails.

## Data protection and recovery

Pipeline MySQL is part of the same immutable backup set as website PostgreSQL
and persistent files:

```bash
bash CICDtools/backup_db.sh scheduled
bash CICDtools/inspect_backup.sh
bash CICDtools/restore_db.sh <backup-set>
```

Never combine independently selected database dumps. Restore validates the
set-level SHA-256 manifest before stopping writers, restores both databases,
runs both migration systems, starts services, and executes end-to-end health.
`pipeline_mysql=NOT_PRESENT` is accepted only for sets created before the first
pipeline MySQL container existed.

Rotate MySQL credentials through
`bash CICDtools/rotate_db_password.sh pipeline`; it backs up first and rotates
both the application user and root credentials together.

## Health and incident checks

`bash CICDtools/check_health.sh` validates container health, migration exit 0,
API liveness, pipeline readiness, the public tag endpoint through Nginx, and the
`/tech-articles` SPA route. It intentionally performs no paid Gemini call. For
deeper pipeline diagnosis, inspect only bounded logs:

```bash
docker compose --profile tech-articles logs --tail=100 tech-article-pipeline
docker compose --profile tech-articles logs --tail=100 pipeline-migrate
```

Do not print `docker compose config` in shared logs because its rendered output
may contain injected secrets.
