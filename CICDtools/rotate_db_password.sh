#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"

setup_logging "rotate_db_password"
cicd_require_commands docker openssl
cicd_validate_env_files

target="${1:-postgres}"
[[ "$target" == "postgres" || "$target" == "pipeline" ]] || {
  log_error "Usage: $0 [postgres|pipeline]"
  exit 2
}

if [[ "$target" == "postgres" ]]; then
  target_description="NestJS API PostgreSQL 사용자 비밀번호"
  affected_services="API 컨테이너"
else
  target_description="pipeline MySQL 애플리케이션·root 비밀번호"
  affected_services="pipeline-mysql, pipeline-migrate, tech-article-pipeline"
fi
cicd_print_banner "🔐" "Database Credential Rotation / DB 비밀번호 교체" \
  "📘 Target / 교체 대상: $target_description" \
  "🔄 Affected services / 재생성 서비스: $affected_services" \
  "💾 변경 전에 PostgreSQL·MySQL·파일 통합 백업을 생성합니다." \
  "🙈 새 비밀번호는 안전하게 자동 생성하며 화면과 로그에 출력하지 않습니다." \
  "⚠️  운영 DB 자격 증명을 변경하므로 정확히 ROTATE를 입력해야 실행됩니다."

if [[ "${CICD_ASSUME_YES:-0}" != "1" ]]; then
  cicd_read_prompt confirmation "❓ Type ROTATE to rotate $target credentials / 실행하려면 ROTATE 입력:"
  [[ "$confirmation" == "ROTATE" ]] || { log_warn "🚫 Rotation cancelled. / 비밀번호 교체를 취소했습니다."; exit 0; }
fi

cicd_print_step 1 3 "💾" "Create a verified pre-rotation backup / 교체 전 통합 백업"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/backup_db.sh" "pre-rotate-$target"

if [[ "$target" == "postgres" ]]; then
  db_env="$CICD_PROJECT_ROOT/envs/db_prod.env"
  [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]] && db_env="$CICD_PROJECT_ROOT/envs/db_dev.env"
  db_user="$(cicd_env_get "$db_env" POSTGRES_USER)"
  db_name="$(cicd_env_get "$db_env" POSTGRES_DB)"
  old_password="$(cicd_env_get "$db_env" POSTGRES_PASSWORD)"
  [[ "$db_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { log_error "Unsafe PostgreSQL role name."; exit 1; }
  new_password="$(cicd_generate_hex 32)"

  cicd_print_step 2 3 "🐘" "Rotate PostgreSQL credentials atomically / PostgreSQL 자격 증명 교체"
  printf 'ALTER ROLE "%s" WITH PASSWORD '\''%s'\'';\n' "$db_user" "$new_password" \
    | cicd_compose exec -T db psql --set ON_ERROR_STOP=on -U "$db_user" -d "$db_name" >/dev/null

  cicd_env_set "$db_env" POSTGRES_PASSWORD "$new_password"
  cicd_env_set "$db_env" DB_PASSWORD "$new_password"
  if ! cicd_compose up -d --no-deps --force-recreate api \
    || ! cicd_wait_service api healthy 180 \
    || ! cicd_compose exec -T api node -e \
      "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    escaped_old="${old_password//\'/\'\'}"
    printf 'ALTER ROLE "%s" WITH PASSWORD '\''%s'\'';\n' "$db_user" "$escaped_old" \
      | cicd_compose exec -T db psql --set ON_ERROR_STOP=on -U "$db_user" -d "$db_name" >/dev/null || true
    cicd_env_set "$db_env" POSTGRES_PASSWORD "$old_password"
    cicd_env_set "$db_env" DB_PASSWORD "$old_password"
    cicd_compose up -d --no-deps --force-recreate api || true
    log_error "PostgreSQL rotation failed; previous environment values were restored. / 이전 설정으로 자동 복구했습니다."
    exit 1
  fi
  cicd_print_step 3 3 "🩺" "API readiness confirmed / API 준비 상태 확인 완료"
  log_success "🎉 PostgreSQL credentials rotated; the value was not printed or logged. / PostgreSQL 비밀번호 교체를 완료했습니다."
  exit 0
fi

root_env="$CICD_PROJECT_ROOT/.env"
mysql_user="$(cicd_env_get "$root_env" TECH_ARTICLE_MYSQL_USER)"
[[ "$mysql_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { log_error "Unsafe MySQL user name."; exit 1; }
new_app_password="$(cicd_generate_hex 32)"
new_root_password="$(cicd_generate_hex 32)"

cicd_print_step 2 3 "🐬" "Rotate pipeline MySQL application and root credentials / MySQL 자격 증명 교체"
printf "ALTER USER '%s'@'%%' IDENTIFIED BY '%s'; ALTER USER 'root'@'localhost' IDENTIFIED BY '%s'; FLUSH PRIVILEGES;\n" \
  "$mysql_user" "$new_app_password" "$new_root_password" \
  | cicd_compose exec -T pipeline-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot' >/dev/null

cicd_env_set "$root_env" TECH_ARTICLE_MYSQL_PASSWORD "$new_app_password"
cicd_env_set "$root_env" TECH_ARTICLE_MYSQL_ROOT_PASSWORD "$new_root_password"
if ! {
  cicd_compose up -d --force-recreate pipeline-mysql \
    && cicd_wait_service pipeline-mysql healthy 180 \
    && cicd_compose exec -T pipeline-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -e "SELECT 1"' >/dev/null \
    && cicd_compose up --no-deps --force-recreate pipeline-migrate \
    && cicd_wait_service pipeline-migrate exited 180 \
    && cicd_compose up -d --no-deps --force-recreate tech-article-pipeline \
    && cicd_wait_service tech-article-pipeline healthy 180
}; then
  log_error "Pipeline rotation did not complete after the live credentials changed."
  log_error "The root .env intentionally retains the new live credentials. / 실제 DB와 일치하도록 .env에는 새 값을 유지했습니다."
  log_error "Retry the recreate steps or restore the pre-rotate-pipeline backup set; do not replace .env with old credentials alone. / 재생성을 재시도하거나 사전 백업으로 복구하세요. .env만 예전 값으로 되돌리면 안 됩니다."
  exit 1
fi
cicd_print_step 3 3 "🩺" "MySQL migration and pipeline readiness confirmed / 마이그레이션·파이프라인 상태 확인 완료"
log_success "🎉 Pipeline MySQL application and root credentials rotated; values were not printed or logged. / MySQL 비밀번호 교체를 완료했습니다."
