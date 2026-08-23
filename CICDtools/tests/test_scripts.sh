#!/usr/bin/env bash
set -Eeuo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TEST_DIR
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
readonly PROJECT_ROOT
SET_ENV_SCRIPT="$PROJECT_ROOT/CICDtools/ServerSetupRemove/set_env.sh"

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_equal() { [[ "$1" == "$2" ]] || fail "$3"; }

test_root="$(mktemp -d)"
cleanup() { rm -rf -- "$test_root"; }
trap cleanup EXIT
mkdir -p "$test_root/envs" "$test_root/reverse-proxy/certs"

prompt_fixture="$test_root/prompt-fixture"
mkdir -p "$prompt_fixture/CICDtools/utils"
cp "$PROJECT_ROOT/CICDtools/utils/common_logging.sh" "$prompt_fixture/CICDtools/utils/common_logging.sh"
cp "$PROJECT_ROOT/CICDtools/utils/runtime.sh" "$prompt_fixture/CICDtools/utils/runtime.sh"
prompt_output="$test_root/prompt-output.log"
printf 'visible-answer\nnever-log-this-secret\n' \
  | CICD_PROJECT_ROOT_OVERRIDE="$prompt_fixture" bash -c '
      source "$1/CICDtools/utils/runtime.sh"
      setup_logging prompt-regression-test
      cicd_read_prompt plain "PROMPT_PLAIN"
      cicd_read_secret_prompt secret "PROMPT_SECRET"
      printf "PLAIN=%s SECRET_LENGTH=%s\n" "$plain" "${#secret}"
    ' _ "$prompt_fixture" >"$prompt_output" 2>&1
grep -Eq '^[[:space:]]*PROMPT_PLAIN$' "$prompt_output" || fail "plain prompt was delayed by logging"
grep -Eq '^[[:space:]]*PROMPT_SECRET$' "$prompt_output" || fail "secret prompt was delayed by logging"
grep -Eq '^[[:space:]]*PLAIN=visible-answer SECRET_LENGTH=21$' "$prompt_output" || fail "prompt input was not preserved"
! grep -R -Fq -- 'never-log-this-secret' "$prompt_output" "$prompt_fixture/CICDtools/logs" \
  || fail "secret prompt value leaked to output or logs"

first_output="$test_root/first-output.log"
printf '\n\n\nadmin-user\nadmin@example.com\nhidden-admin-password\n' \
  | CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_NO_SUDO=1 bash "$SET_ENV_SCRIPT" dev \
    >"$first_output" 2>&1

jwt_before="$(awk -F= '$1=="JWT_SECRET" {print substr($0,index($0,"=")+1)}' "$test_root/envs/api.env")"
pg_before="$(awk -F= '$1=="POSTGRES_PASSWORD" {print substr($0,index($0,"=")+1)}' "$test_root/envs/db_dev.env")"
token_before="$(awk -F= '$1=="PIPELINE_SERVICE_TOKEN" {print substr($0,index($0,"=")+1)}' "$test_root/.env")"
mysql_before="$(awk -F= '$1=="TECH_ARTICLE_MYSQL_PASSWORD" {print substr($0,index($0,"=")+1)}' "$test_root/.env")"

for secret in "$jwt_before" "$pg_before" "$token_before" "$mysql_before" hidden-admin-password; do
  [[ -n "$secret" ]] || fail "expected generated secret"
  ! grep -Fq -- "$secret" "$first_output" || fail "secret leaked to setup output"
done

CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_NO_SUDO=1 bash "$SET_ENV_SCRIPT" dev \
  </dev/null >"$test_root/second-output.log" 2>&1
assert_equal "$jwt_before" "$(awk -F= '$1=="JWT_SECRET" {print substr($0,index($0,"=")+1)}' "$test_root/envs/api.env")" "JWT changed on rerun"
assert_equal "$pg_before" "$(awk -F= '$1=="POSTGRES_PASSWORD" {print substr($0,index($0,"=")+1)}' "$test_root/envs/db_dev.env")" "PostgreSQL password changed on rerun"
assert_equal "$token_before" "$(awk -F= '$1=="PIPELINE_SERVICE_TOKEN" {print substr($0,index($0,"=")+1)}' "$test_root/.env")" "service token changed on rerun"
assert_equal "$mysql_before" "$(awk -F= '$1=="TECH_ARTICLE_MYSQL_PASSWORD" {print substr($0,index($0,"=")+1)}' "$test_root/.env")" "MySQL password changed on rerun"

mock_bin="$test_root/mock-bin"
mkdir -p "$mock_bin"
mock_docker="$mock_bin/docker"
apply_mock_patch_target="$mock_docker"
cat >"$apply_mock_patch_target" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$MOCK_DOCKER_TRACE"
if [[ " $* " == *" inspect "* ]]; then
  printf 'healthy\n'
elif [[ " $* " == *" ps -a -q "* ]]; then
  printf 'mock-container-id\n'
fi
MOCK
chmod +x "$mock_docker"

cat >"$mock_bin/npm" <<'MOCK'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >>"$MOCK_BUILD_TRACE"
MOCK
cat >"$mock_bin/npx" <<'MOCK'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >>"$MOCK_BUILD_TRACE"
mkdir -p "$CICD_PROJECT_ROOT_OVERRIDE/web/dist.next"
printf '<!doctype html>' >"$CICD_PROJECT_ROOT_OVERRIDE/web/dist.next/index.html"
MOCK
chmod +x "$mock_bin/npm" "$mock_bin/npx"
mkdir -p "$test_root/web"
PATH="$mock_bin:$PATH" MOCK_BUILD_TRACE="$test_root/build.trace" \
  CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_NO_SUDO=1 \
  bash -c 'source "$1/CICDtools/utils/deployment_steps.sh"; cicd_stage_frontend' _ "$PROJECT_ROOT" \
  >"$test_root/stage-output.log"
grep -q '^npm ci$' "$test_root/build.trace" || fail "frontend staging did not use npm ci"
grep -q '^npx --no-install cross-env BUILD_PATH=dist.next react-scripts build$' "$test_root/build.trace" \
  || fail "frontend staging did not target dist.next"

cp "$test_root/.env" "$test_root/before-config.env"
printf 'gemini-model-test\n' \
  | PATH="$mock_bin:$PATH" MOCK_DOCKER_TRACE="$test_root/docker.trace" \
    CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_ENVIRONMENT=dev CICD_NO_SUDO=1 \
    bash "$PROJECT_ROOT/CICDtools/update_tech_article_config.sh" gemini-model \
    >"$test_root/config-output.log" 2>&1
grep -v '^GEMINI_MODEL=' "$test_root/before-config.env" >"$test_root/before-unselected"
grep -v '^GEMINI_MODEL=' "$test_root/.env" >"$test_root/after-unselected"
cmp -s "$test_root/before-unselected" "$test_root/after-unselected" || fail "unselected config bytes changed"
grep -q '^GEMINI_MODEL=gemini-model-test$' "$test_root/.env" || fail "selected config key was not changed"
grep -Eq 'compose .*--profile tech-articles up -d --no-deps --force-recreate tech-article-pipeline' "$test_root/docker.trace" \
  || fail "pipeline was not selectively recreated"

cp "$test_root/.env" "$test_root/before-auto-crawl.env"
: >"$test_root/docker.trace"
printf 'true\n' \
  | PATH="$mock_bin:$PATH" MOCK_DOCKER_TRACE="$test_root/docker.trace" \
    CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_ENVIRONMENT=dev CICD_NO_SUDO=1 \
    bash "$PROJECT_ROOT/CICDtools/update_tech_article_config.sh" auto-crawl \
    >"$test_root/auto-crawl-output.log" 2>&1
grep -v '^TECH_ARTICLE_AUTO_CRAWL_ENABLED=' "$test_root/before-auto-crawl.env" >"$test_root/before-auto-crawl-unselected"
grep -v '^TECH_ARTICLE_AUTO_CRAWL_ENABLED=' "$test_root/.env" >"$test_root/after-auto-crawl-unselected"
cmp -s "$test_root/before-auto-crawl-unselected" "$test_root/after-auto-crawl-unselected" \
  || fail "auto-crawl changed unrelated config bytes"
grep -q '^TECH_ARTICLE_AUTO_CRAWL_ENABLED=true$' "$test_root/.env" \
  || fail "auto-crawl setting was not enabled"
grep -Eq 'compose .*--profile tech-articles up -d --no-deps --force-recreate api' "$test_root/docker.trace" \
  || fail "auto-crawl did not selectively recreate api"
! grep -Eq 'force-recreate .*tech-article-pipeline' "$test_root/docker.trace" \
  || fail "auto-crawl unexpectedly recreated the pipeline"

update_script="$PROJECT_ROOT/CICDtools/update_all.sh"
stage_line="$(grep -n '^cicd_stage_frontend$' "$update_script" | cut -d: -f1)"
pipeline_line="$(grep -n '^cicd_deploy_pipeline$' "$update_script" | cut -d: -f1)"
api_line="$(grep -n '^cicd_deploy_api$' "$update_script" | cut -d: -f1)"
activate_line="$(grep -n '^cicd_activate_frontend$' "$update_script" | cut -d: -f1)"
health_line="$(grep -n 'check_health.sh' "$update_script" | tail -n 1 | cut -d: -f1)"
(( stage_line < pipeline_line && pipeline_line < api_line && api_line < activate_line && activate_line < health_line )) \
  || fail "update_all deployment order changed"

backup_root="$test_root/backups"
set_dir="$backup_root/20260817_000000_test"
mkdir -p "$set_dir" "$test_root/archive/api/uploads" "$test_root/archive/api/json" "$test_root/archive/logs"
printf 'CREATE TABLE public.example (id integer);\n' | gzip >"$set_dir/postgres.sql.gz"
printf 'CREATE TABLE `article` (id bigint);\n' | gzip >"$set_dir/pipeline-mysql.sql.gz"
tar -czf "$set_dir/files.tar.gz" -C "$test_root/archive" api/uploads api/json logs
printf 'format_version=2\ncreated_at=2026-08-17T00:00:00Z\nlabel=test\npostgres=OK\npipeline_mysql=OK\nfiles=OK\n' >"$set_dir/metadata"
(cd "$set_dir" && sha256sum metadata postgres.sql.gz pipeline-mysql.sql.gz files.tar.gz >SHA256SUMS)

CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_BACKUP_ROOT_OVERRIDE="$backup_root" CICD_NO_SUDO=1 \
  bash -c 'source "$1/CICDtools/utils/backup_utils.sh"; cicd_verify_backup_set "$2"' _ "$PROJECT_ROOT" "$set_dir" \
  >"$test_root/backup-output.log"
cp "$set_dir/postgres.sql.gz" "$backup_root/db_backup_legacy.sql.gz"
legacy_found="$(CICD_PROJECT_ROOT_OVERRIDE="$test_root" CICD_BACKUP_ROOT_OVERRIDE="$backup_root" CICD_NO_SUDO=1 \
  bash -c 'source "$1/CICDtools/utils/backup_utils.sh"; cicd_resolve_legacy_postgres_backup' _ "$PROJECT_ROOT")"
[[ "$legacy_found" == "$backup_root/db_backup_legacy.sql.gz" ]] || fail "legacy backup discovery failed"

printf 'PASS: CICDtools environment, secrecy, selective config, order, and backup contracts\n'
