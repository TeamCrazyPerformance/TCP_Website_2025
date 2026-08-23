#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"
# shellcheck source=utils/backup_utils.sh
source "$SCRIPT_DIR/utils/backup_utils.sh"

setup_logging "inspect_backup"
cicd_print_banner "🔍" "Backup Inspector / 백업 검사 도구" \
  "📘 백업 파일을 복구하지 않고 checksum·압축·DB 구조·파일 목록만 안전하게 검사합니다." \
  "🕒 복구 전이나 정기 백업 점검 시 사용하세요." \
  "🔐 데이터 본문과 시크릿은 출력하지 않습니다. 인자 생략 시 최신 통합 백업을 검사합니다." \
  "🗃️  예전 PostgreSQL 단일 백업은 --legacy 옵션으로 검사할 수 있습니다."
cicd_require_commands gzip tar sha256sum awk

if [[ "${1:-}" == "--legacy" ]]; then
  legacy_file="$(cicd_resolve_legacy_postgres_backup "${2:-}")" || {
    log_error "No matching legacy PostgreSQL backup was found."
    exit 1
  }
  gzip -t "$legacy_file"
  cicd_print_step 1 2 "🧪" "Validate legacy compression / 레거시 압축 검증"
  log_info "📁 Legacy backup: $(basename "$legacy_file")"
  cicd_print_step 2 2 "🐘" "List PostgreSQL schema objects / PostgreSQL 구조 확인"
  gzip -cd "$legacy_file" | awk '/^CREATE (UNLOGGED )?TABLE / {gsub(/\(/, "", $3); print "  - " $3}' | sort -u
  log_success "🎉 Legacy PostgreSQL backup compression and schema structure are valid. / 레거시 백업이 정상입니다."
  exit 0
fi

set_dir="$(cicd_resolve_backup_set "${1:-}")" || {
  log_error "No matching backup set was found."
  exit 1
}
cicd_verify_backup_set "$set_dir"

cicd_print_step 1 4 "🔏" "Verify checksums and compression / 체크섬·압축 검증"
log_info "📁 Backup set: $(basename "$set_dir")"
while IFS= read -r metadata_line; do log_info "  $metadata_line"; done <"$set_dir/metadata"

cicd_print_step 2 4 "🐘" "List PostgreSQL schema objects / PostgreSQL 구조 확인"
gzip -cd "$set_dir/postgres.sql.gz" | awk '/^CREATE (UNLOGGED )?TABLE / {field=($2=="UNLOGGED" ? $4 : $3); gsub(/\(/, "", field); print "  - " field}' | sort -u

if [[ -f "$set_dir/pipeline-mysql.sql.gz" ]]; then
  cicd_print_step 3 4 "🐬" "List pipeline MySQL schema objects / MySQL 구조 확인"
  gzip -cd "$set_dir/pipeline-mysql.sql.gz" | awk '/^CREATE TABLE / {gsub(/`/, "", $3); gsub(/\(/, "", $3); print "  - " $3}' | sort -u
fi

cicd_print_step 4 4 "📦" "List archived file paths / 보관 파일 경로 확인"
tar -tzf "$set_dir/files.tar.gz" | sed 's/^/  - /'
log_success "🎉 Checksums, compression streams, database schemas, and file archive are valid. / 통합 백업이 정상입니다."
