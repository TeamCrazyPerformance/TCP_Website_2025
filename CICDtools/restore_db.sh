#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"
# shellcheck source=utils/backup_utils.sh
source "$SCRIPT_DIR/utils/backup_utils.sh"

setup_logging "restore_db"
cicd_require_commands docker gzip tar sha256sum openssl
cicd_validate_env_files

legacy_mode=0
requested="${1:-}"
if [[ "$requested" == "--legacy" ]]; then
  legacy_mode=1
  requested="${2:-}"
fi

if (( legacy_mode )); then
  backup_target="$(cicd_resolve_legacy_postgres_backup "$requested")" || {
    log_error "No matching legacy PostgreSQL backup was found."
    exit 1
  }
  gzip -t "$backup_target"
  target_label="legacy PostgreSQL backup $(basename "$backup_target")"
else
  backup_target="$(cicd_resolve_backup_set "$requested")" || {
    log_error "No matching backup set was found."
    exit 1
  }
  cicd_verify_backup_set "$backup_target"
  target_label="backup set $(basename "$backup_target")"
fi

cicd_print_banner "🚨" "Database Restore / 데이터 복구" \
  "📘 What is this? / 이건 무엇인가요?" \
  "   - 선택한 백업 시점으로 서비스 데이터를 되돌리는 비상 복구 도구입니다." \
  "🎯 Restore target / 복구 대상: $target_label" \
  "💥 Current data impact / 현재 데이터 영향" \
  "   - 통합 백업: PostgreSQL, pipeline MySQL(포함된 경우), 업로드·생성 파일을 덮어씁니다." \
  "   - legacy 모드: PostgreSQL만 복구하며 pipeline 데이터와 파일은 변경하지 않습니다." \
  "🛡️  checksum과 압축 무결성을 먼저 검증하고, writer를 중지한 뒤 복구합니다." \
  "⚠️  현재 데이터를 덮어쓰므로 입력을 세 번 확인합니다."
if ! cicd_confirm_dangerous_action "RESTORE" \
  "This operation overwrites current service data with $target_label." \
  "현재 서비스 데이터를 $target_label 시점으로 덮어씁니다."; then
  log_warn "🚫 Restore cancelled. Current data was not changed. / 복구를 취소했습니다."
  exit 0
fi

db_env="$CICD_PROJECT_ROOT/envs/db_prod.env"
[[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]] && db_env="$CICD_PROJECT_ROOT/envs/db_dev.env"
db_user="$(cicd_env_get "$db_env" POSTGRES_USER)"
db_name="$(cicd_env_get "$db_env" POSTGRES_DB)"
[[ "$db_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { log_error "Unsafe PostgreSQL role name."; exit 1; }
[[ "$db_name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { log_error "Unsafe PostgreSQL database name."; exit 1; }

cicd_print_step 1 6 "⏸️" "Stop API and pipeline writers / 데이터 쓰기 서비스 중지"
cicd_compose stop api tech-article-pipeline || true
cicd_compose up -d db
cicd_wait_service db healthy 180

postgres_dump="$backup_target"
(( legacy_mode == 0 )) && postgres_dump="$backup_target/postgres.sql.gz"
cicd_print_step 2 6 "🐘" "Restore PostgreSQL / PostgreSQL 복구"
printf 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION "%s"; GRANT ALL ON SCHEMA public TO public;\n' "$db_user" \
  | cicd_compose exec -T db psql --set ON_ERROR_STOP=on -U "$db_user" -d "$db_name" >/dev/null
gzip -cd "$postgres_dump" | cicd_compose exec -T db psql --set ON_ERROR_STOP=on -U "$db_user" -d "$db_name"

if (( legacy_mode == 0 )); then
  cicd_compose up -d pipeline-mysql
  cicd_wait_service pipeline-mysql healthy 180
  if grep -q '^pipeline_mysql=OK$' "$backup_target/metadata"; then
    cicd_print_step 3 6 "🐬" "Restore pipeline MySQL / pipeline MySQL 복구"
    mysql_database="$(cicd_env_get "$CICD_PROJECT_ROOT/.env" TECH_ARTICLE_MYSQL_DATABASE)"
    [[ "$mysql_database" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { log_error "Unsafe MySQL database name."; exit 1; }
    printf 'DROP DATABASE IF EXISTS `%s`; CREATE DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n' "$mysql_database" "$mysql_database" \
      | cicd_compose exec -T pipeline-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' >/dev/null
    gzip -cd "$backup_target/pipeline-mysql.sql.gz" | cicd_compose exec -T pipeline-mysql sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"'
  else
    cicd_print_step 3 6 "🐬" "Keep current MySQL data (backup recorded NOT_PRESENT) / 기존 MySQL 유지"
    log_warn "This first-bootstrap backup has no MySQL component; current pipeline data is unchanged. / 백업에 MySQL이 없어 기존 데이터를 유지합니다."
  fi

  cicd_print_step 4 6 "📦" "Restore uploaded and generated files / 업로드·생성 파일 복구"
  cicd_as_root tar -xzf "$backup_target/files.tar.gz" -C "$CICD_PROJECT_ROOT"
else
  cicd_print_step 3 6 "🐬" "Skip pipeline MySQL in legacy mode / legacy 모드 MySQL 유지"
  cicd_print_step 4 6 "📦" "Skip files in legacy mode / legacy 모드 파일 유지"
fi

cicd_print_step 5 6 "🧬" "Run migrations after restore / 복구 후 마이그레이션"
if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
  cicd_compose run --rm --no-deps api npm run migration:run
else
  cicd_compose run --rm --no-deps api npx typeorm migration:run -d dist/data-source.js
fi
if (( legacy_mode == 0 )); then
  cicd_compose up --no-deps --force-recreate pipeline-migrate
  cicd_wait_service pipeline-migrate exited 180
fi

cicd_print_step 6 6 "🩺" "Restart services and run full health checks / 서비스 재기동·전체 점검"
cicd_compose up -d api tech-article-pipeline web reverse-proxy
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/check_health.sh"
log_success "🎉 Restore completed from one verified backup target. / 검증된 단일 백업으로 복구를 완료했습니다."
