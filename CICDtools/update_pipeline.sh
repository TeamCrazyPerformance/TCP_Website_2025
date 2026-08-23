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

setup_logging "update_pipeline"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  cicd_print_banner "📰" "Technical-Article Pipeline Update / 기술 아티클 파이프라인 업데이트" \
    "📘 What is this? / 이건 무엇인가요?" \
    "   - 수집·정규화·AI 보강 파이프라인 이미지와 pipeline MySQL 스키마를 갱신합니다." \
    "" \
    "🕒 When to use? / 언제 사용하나요?" \
    "   - API와 프론트엔드는 유지하고 파이프라인 코드나 MySQL migration만 반영할 때 사용하세요." \
    "" \
    "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
    "   - 통합 백업 → 이미지 빌드 → MySQL 마이그레이션 → 파이프라인 교체 → API 연동·전체 점검 순서입니다." \
    "   - 실행 중인 파이프라인은 새 이미지와 마이그레이션이 준비된 뒤 교체합니다." \
    "💡 일반 헬스체크에서는 실제 Gemini 요청을 보내지 않습니다."
else
  cicd_print_section "🚀" "Pipeline deployment / 파이프라인 배포 시작"
fi
cicd_require_commands docker git curl openssl
cicd_validate_env_files

cd "$CICD_PROJECT_ROOT"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  if ! cicd_confirm "Update only the technical-article pipeline from the latest upstream revision?"; then
    log_warn "🚫 Pipeline update cancelled. / 파이프라인 업데이트를 취소했습니다."
    exit 0
  fi
  check_git_status
  pull_latest_changes
  exec env CICD_DEPLOY_RESUMED=1 CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/update_pipeline.sh"
fi
cicd_print_step 1 4 "💾" "Create an integrated backup / 통합 백업"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/backup_db.sh" "pre-update-pipeline"
cicd_print_step 2 4 "📰" "Build, migrate, and recreate pipeline / 파이프라인 빌드·마이그레이션·교체"
cicd_deploy_pipeline
cicd_print_step 3 4 "🔗" "Verify API-to-pipeline integration / API 연동 확인"
cicd_verify_api_pipeline_integration
cicd_print_step 4 4 "🩺" "Run full health checks / 전체 서비스 점검"
CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/check_health.sh"
log_success "🎉 Technical-article pipeline update completed. / 기술 아티클 파이프라인 업데이트를 완료했습니다."
