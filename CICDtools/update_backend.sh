#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"
# shellcheck source=utils/deployment_steps.sh
source "$SCRIPT_DIR/utils/deployment_steps.sh"
# shellcheck source=utils/git_utils.sh
source "$SCRIPT_DIR/utils/git_utils.sh"

setup_logging "update_backend"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  cicd_print_banner "⚙️" "NestJS API Update / API 단독 업데이트" \
    "📘 What is this? / 이건 무엇인가요?" \
    "   - 최신 코드를 fast-forward로 가져와 NestJS API 이미지와 PostgreSQL 스키마를 갱신합니다." \
    "   - 프론트엔드와 기술 아티클 파이프라인은 직접 교체하지 않습니다." \
    "" \
    "🕒 When to use? / 언제 사용하나요?" \
    "   - NestJS, API 로직, DTO, PostgreSQL migration 변경만 반영할 때 사용하세요." \
    "" \
    "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
    "   - 통합 백업 → 이미지 빌드 → DB 마이그레이션 → API 교체 → 연동·전체 점검 순서입니다." \
    "   - API 재생성 중 기존 DB 연결이 잠시 끊기고 짧은 중단이 발생할 수 있습니다." \
    "🛡️  마이그레이션이 성공하기 전에는 실행 중인 API를 교체하지 않습니다."
else
  cicd_print_section "🚀" "NestJS API deployment / API 배포 시작"
fi
cicd_require_commands docker git curl openssl
cicd_validate_env_files

cd "$CICD_PROJECT_ROOT"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  if ! cicd_confirm "Update only the NestJS API from the latest upstream revision?"; then
    log_warn "🚫 API update cancelled. / API 업데이트를 취소했습니다."
    exit 0
  fi
  check_git_status
  pull_latest_changes
  exec env CICD_DEPLOY_RESUMED=1 CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/update_backend.sh"
fi
cicd_print_step 1 4 "💾" "Create an integrated backup / 통합 백업"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/backup_db.sh" "pre-update-api"
cicd_print_step 2 4 "⚙️" "Build, migrate, and recreate API / API 빌드·마이그레이션·교체"
cicd_deploy_api
cicd_print_step 3 4 "🔗" "Verify API-to-pipeline integration / 파이프라인 연동 확인"
cicd_verify_api_pipeline_integration
cicd_print_step 4 4 "🩺" "Run full health checks / 전체 서비스 점검"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/check_health.sh"
log_success "🎉 API update completed. / API 업데이트를 완료했습니다."
