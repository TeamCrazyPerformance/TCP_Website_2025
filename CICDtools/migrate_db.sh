#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"

setup_logging "migrate_db"
cicd_print_banner "🧬" "Database Migration Tool / 데이터베이스 마이그레이션" \
  "📘 What is this? / 이건 무엇인가요?" \
  "   - NestJS PostgreSQL과 기술 아티클 pipeline MySQL 스키마를 모두 최신 상태로 만듭니다." \
  "🕒 When to use? / 언제 사용하나요?" \
  "   - DB 구조 변경만 별도로 적용하거나 복구 후 스키마를 맞출 때 사용하세요." \
  "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
  "   1. 💾 두 DB와 파일을 하나의 세트로 먼저 백업합니다." \
  "   2. 🐘 PostgreSQL TypeORM 마이그레이션을 실행합니다." \
  "   3. 🐬 checksum 검증된 pipeline MySQL 마이그레이션을 실행합니다." \
  "⚠️  스키마를 변경하는 작업이므로 입력을 세 번 확인합니다."
cicd_require_commands docker openssl
cicd_validate_env_files

if ! cicd_confirm_dangerous_action "MIGRATE" \
  "This operation modifies both database schemas after creating a backup." \
  "백업을 만든 뒤 PostgreSQL과 pipeline MySQL 스키마를 변경합니다."; then
  log_warn "🚫 Migration cancelled. No schema was changed. / 마이그레이션을 취소했습니다."
  exit 0
fi

cicd_print_step 1 4 "💾" "Create and verify the integrated backup / 통합 백업 생성·검증"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/backup_db.sh" "pre-migrate"
cicd_print_step 2 4 "🗄️" "Start and verify both databases / 두 데이터베이스 준비"
cicd_compose up -d db pipeline-mysql
cicd_wait_service db healthy 180
cicd_wait_service pipeline-mysql healthy 180

cicd_print_step 3 4 "🐘" "Run PostgreSQL TypeORM migrations / PostgreSQL 마이그레이션"
if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
  cicd_compose run --rm --no-deps api npm run migration:run
else
  cicd_compose run --rm --no-deps api npx typeorm migration:run -d dist/data-source.js
fi

cicd_print_step 4 4 "🐬" "Run checksum-verified pipeline MySQL migrations / MySQL 마이그레이션"
cicd_compose up --no-deps --force-recreate pipeline-migrate
cicd_wait_service pipeline-migrate exited 180
log_success "🎉 Both database migration sets completed. / 두 데이터베이스 마이그레이션을 완료했습니다."
