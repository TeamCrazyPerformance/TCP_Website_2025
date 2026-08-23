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

setup_logging "update_all"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  cicd_print_banner "🌍" "Full Stack Update / 전체 서비스 업데이트" \
    "📘 What is this? / 이건 무엇인가요?" \
    "   - 기술 아티클 파이프라인, NestJS API, 프론트엔드를 한 번에 배포합니다." \
    "   - 현재 서비스와 화면은 새 버전의 준비·검증이 끝날 때까지 유지됩니다." \
    "" \
    "🕒 When to use? / 언제 사용하나요?" \
    "   - 일반 운영 배포나 전체 릴리스에는 이 스크립트를 사용하세요." \
    "" \
    "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
    "   1. 🔍 Git fast-forward 확인 및 통합 백업 1회" \
    "   2. 🎨 비활성 디렉터리에 프론트엔드 선행 빌드" \
    "   3. 📰 Pipeline/MySQL 마이그레이션 및 readiness 확인" \
    "   4. ⚙️  API/PostgreSQL 마이그레이션 및 readiness 확인" \
    "   5. 🔗 연동 확인 후 프론트엔드 활성화와 전체 헬스체크" \
    "   - 마지막 점검이 실패하면 이전 프론트엔드 화면을 자동 복구합니다."
else
  cicd_print_section "🚀" "Verified revision deployment / 확인된 소스 배포 시작"
fi
cicd_require_commands docker git curl npm openssl
cicd_validate_env_files
cicd_require_production_ssl

cd "$CICD_PROJECT_ROOT"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  if ! cicd_confirm "Deploy pipeline, API, and frontend from the latest upstream revision?"; then
    log_warn "🚫 Deployment cancelled. No service was changed. / 배포를 취소했습니다. 서비스는 변경되지 않았습니다."
    exit 0
  fi
  check_git_status
  pull_latest_changes
  exec env CICD_DEPLOY_RESUMED=1 CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/update_all.sh"
fi

cicd_print_step 1 6 "💾" "Create one consistent backup set / 전체 서비스 백업"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/backup_db.sh" "pre-update-all"

# Keep the active frontend untouched until both backend services are ready.
cicd_print_step 2 6 "🎨" "Build the inactive frontend bundle / 프론트엔드 선행 빌드"
cicd_stage_frontend
cicd_print_step 3 6 "📰" "Deploy pipeline and MySQL migrations / 파이프라인 배포"
cicd_deploy_pipeline
cicd_print_step 4 6 "⚙️" "Deploy API and PostgreSQL migrations / API 배포"
cicd_deploy_api
cicd_verify_api_pipeline_integration
cicd_print_step 5 6 "🌐" "Activate the verified frontend / 프론트엔드 활성화"
cicd_activate_frontend
cicd_print_step 6 6 "🩺" "Run end-to-end health checks / 전체 서비스 점검"
if ! CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/check_health.sh"; then
  cicd_rollback_frontend || true
  exit 1
fi
cicd_commit_frontend
log_success "🎉 Pipeline, API, and frontend deployment completed. / 전체 서비스 배포를 완료했습니다."
