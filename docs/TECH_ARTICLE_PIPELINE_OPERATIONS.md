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

The Crawl Operations release changes the pipeline schema, NestJS facade, and
frontend together, so deploy it with `update_all.sh`; do not publish only the API
or frontend first. While migration `004` is being applied, do not start a manual
crawl. If automatic crawling is enabled, schedule the deployment outside its run
window or temporarily disable it so the old pipeline cannot write a scheduled run
with the compatibility default `MANUAL` between the provenance backfill and the
new pipeline process starting.

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
bash CICDtools/update_tech_article_config.sh auto-crawl
bash CICDtools/update_tech_article_config.sh service-token
```

The command preserves all unrelated environment bytes and rolls back both the
file and affected service configuration if readiness fails.

Automatic crawling is disabled by default. When enabled, the NestJS scheduler
checks the current KST calendar day every ten minutes and idempotently queues
five profiles: Cloudflare Blog RSS, InfoQ News RSS, InfoQ Articles RSS, SD Times
RSS, and GitHub Trending Daily web crawl.
The normal run starts at 00:00 KST. Each profile checks at most 10 articles from
the previous 48 hours unless the corresponding root environment tuning values
are changed. GitHub is the exception: it always selects exactly the daily Top
3, sends only count and timeout options, and uses
`auto-crawl:v1:{YYYYMMDD}T0000KST:github-trending-web-repositories-daily` as its
key. Repeated checks, API restarts, and multiple API replicas reuse the same
daily key instead of creating another crawl run. If the API is unavailable at
midnight, the next ten-minute check after recovery catches up for that KST day.
A profile that fails to enqueue is retried on a later check without repeating
profiles that already succeeded. Enabling the setting can create new articles
and, under the `IMMEDIATE` publication policy, expose eligible articles
publicly.

GitHub README requests are deliberately unauthenticated, so no token or new
secret is configured. Before enabling unattended crawling, operators must
confirm the current `https://github.com/robots.txt` guidance and that
`CRAWLER_PUBLIC_URL`/`CRAWLER_CONTACT` identify the deployment. For `403`/`429`,
inspect the stored rate-limit headers and let the retryable crawl job back off;
do not add a token as an incident workaround. A README `404` affects only that
rank, is non-retryable, and never causes rank 4 or lower to be fetched.

Daily rank and counters are operational crawl evidence only. They are not added
to normalized content, Gemini prompts, or public article responses. A repository
seen in another window is looked up by canonical URL, but canonical equality is
not an unconditional duplicate decision under the current admission policy;
unchanged content is rejected as an exact duplicate, while a substantially
changed README may be admitted as a new article. Inspect the crawl run and
admission result when investigating repeat repositories.

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

### Interrupted pipeline migration

Pipeline migrations contain MySQL DDL, which commits independently from the
migration-history insert. If `pipeline-migrate` fails, do not edit an applied SQL
file or repeatedly restart the migration job. First keep the automatic
`pre-update-*` backup, then inspect both the recorded version and the actual
schema:

```sql
SELECT version, filename, checksum_sha256
FROM pipeline_migration_history
ORDER BY version;

SHOW COLUMNS FROM crawl_runs LIKE 'trigger_type';
SHOW INDEX FROM crawl_runs;
SELECT CONSTRAINT_NAME
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'crawl_runs'
  AND CONSTRAINT_TYPE = 'CHECK';
```

If version `004` is recorded, its file is immutable and any correction must be a
new migration. If `004` is not recorded but one of its schema objects exists, the
safest recovery is to restore the pre-update backup and rerun the canonical
deployment. Only perform a manual schema reconciliation when restoring is not
possible and the exact partial state has been reviewed.

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
