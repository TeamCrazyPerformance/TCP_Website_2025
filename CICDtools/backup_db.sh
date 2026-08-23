#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"
# shellcheck source=utils/backup_utils.sh
source "$SCRIPT_DIR/utils/backup_utils.sh"

setup_logging "backup_db"
cicd_require_commands docker gzip tar sha256sum mktemp openssl

label="${1:-manual}"
if [[ ! "$label" =~ ^[A-Za-z0-9._-]+$ ]]; then
  log_error "Backup label may contain only letters, numbers, dot, underscore, and dash."
  exit 2
fi

cicd_print_banner "💾" "Integrated Backup / 통합 백업" \
  "📘 PostgreSQL, pipeline MySQL, 업로드·JSON·로그 파일을 같은 시점의 한 세트로 저장합니다." \
  "🏷️  Backup label / 백업 라벨: $label" \
  "🛡️  임시 디렉터리에서 압축과 SHA-256 검증이 끝난 뒤에만 최종 백업으로 활성화합니다." \
  "ℹ️  최초 도입으로 pipeline MySQL이 아직 없을 때만 NOT_PRESENT로 기록합니다." \
  "🔐 데이터 본문과 시크릿 값은 화면이나 로그에 출력하지 않습니다."

mkdir -p "$CICD_BACKUP_ROOT"
chmod 700 "$CICD_BACKUP_ROOT"
timestamp="$(date -u +'%Y%m%d_%H%M%S')"
set_name="${timestamp}_${label}"
final_dir="$CICD_BACKUP_ROOT/$set_name"
[[ ! -e "$final_dir" ]] || { log_error "Backup set already exists: $set_name"; exit 1; }
temp_dir="$(mktemp -d "$CICD_BACKUP_ROOT/.tmp.${set_name}.XXXXXX")"
cleanup() { [[ -d "$temp_dir" ]] && rm -rf -- "$temp_dir"; }
trap cleanup EXIT

db_env="$CICD_PROJECT_ROOT/envs/db_prod.env"
[[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]] && db_env="$CICD_PROJECT_ROOT/envs/db_dev.env"
db_user="$(cicd_env_get "$db_env" POSTGRES_USER)"
db_name="$(cicd_env_get "$db_env" POSTGRES_DB)"

db_container="$(cicd_service_container_id db)"
[[ -n "$db_container" ]] || { log_error "PostgreSQL container is not present."; exit 1; }
db_state="$(cicd_docker inspect --format '{{.State.Status}}' "$db_container")"
[[ "$db_state" == "running" ]] || { log_error "PostgreSQL container is not running."; exit 1; }

cicd_print_step 1 5 "🐘" "Dump and validate PostgreSQL / PostgreSQL 덤프·검증"
cicd_compose exec -T db pg_dump -U "$db_user" -d "$db_name" --clean --if-exists --no-owner --no-privileges \
  | gzip -9 >"$temp_dir/postgres.sql.gz"
gzip -t "$temp_dir/postgres.sql.gz"

pipeline_state="NOT_PRESENT"
pipeline_container="$(cicd_service_container_id pipeline-mysql)"
if [[ -n "$pipeline_container" ]]; then
  mysql_state="$(cicd_docker inspect --format '{{.State.Status}}' "$pipeline_container")"
  [[ "$mysql_state" == "running" ]] || {
    log_error "pipeline-mysql exists but is not running; refusing a partial backup."
    exit 1
  }
  cicd_print_step 2 5 "🐬" "Dump and validate pipeline MySQL / pipeline MySQL 덤프·검증"
  cicd_compose exec -T pipeline-mysql sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --add-drop-table --set-gtid-purged=OFF "$MYSQL_DATABASE"' \
    | gzip -9 >"$temp_dir/pipeline-mysql.sql.gz"
  gzip -t "$temp_dir/pipeline-mysql.sql.gz"
  pipeline_state="OK"
else
  cicd_print_step 2 5 "🐬" "Record the first-bootstrap MySQL state / 최초 MySQL 미존재 기록"
  log_warn "pipeline-mysql is not present; recording first-bootstrap NOT_PRESENT state. / 최초 구축 상태로 기록합니다."
fi

mkdir -p "$CICD_PROJECT_ROOT/api/uploads" "$CICD_PROJECT_ROOT/api/json" "$CICD_PROJECT_ROOT/logs"
cicd_print_step 3 5 "📦" "Archive uploads, JSON assets, and logs / 파일 묶음 생성"
cicd_as_root tar -czf "$temp_dir/files.tar.gz" -C "$CICD_PROJECT_ROOT" api/uploads api/json logs
cicd_as_root chown "${SUDO_USER:-$(id -un)}" "$temp_dir/files.tar.gz" 2>/dev/null || true
tar -tzf "$temp_dir/files.tar.gz" >/dev/null

cicd_print_step 4 5 "🔏" "Create metadata and SHA-256 manifest / 메타데이터·체크섬 생성"
cat >"$temp_dir/metadata" <<EOF
format_version=2
created_at=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
label=$label
postgres=OK
pipeline_mysql=$pipeline_state
files=OK
EOF

(
  cd "$temp_dir"
  checksum_files=(metadata postgres.sql.gz files.tar.gz)
  [[ "$pipeline_state" == "OK" ]] && checksum_files+=(pipeline-mysql.sql.gz)
  sha256sum "${checksum_files[@]}" >SHA256SUMS
  sha256sum --check --strict SHA256SUMS >/dev/null
)
chmod 600 "$temp_dir"/*
mv "$temp_dir" "$final_dir"
trap - EXIT

# Keep at least ten sets; only remove sets older than 31 days when there are more.
cicd_print_step 5 5 "🧹" "Apply safe retention policy / 안전한 보존 정책 적용"
mapfile -t backup_sets < <(find "$CICD_BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '.tmp.*' -printf '%p\n' | sort)
if (( ${#backup_sets[@]} > 10 )); then
  removable_count=$(( ${#backup_sets[@]} - 10 ))
  for (( index=0; index<removable_count; index++ )); do
    old_set="${backup_sets[$index]}"
    if [[ -n "$(find "$old_set" -maxdepth 0 -mtime +31 -print -quit)" ]]; then
      rm -rf -- "$old_set"
    fi
  done
fi

log_success "🎉 Backup set created and verified: $set_name / 통합 백업 생성과 검증을 완료했습니다."
