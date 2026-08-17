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

setup_logging "update_frontend"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  cicd_print_banner "🎨" "Frontend Update / 프론트엔드 단독 업데이트" \
    "📘 What is this? / 이건 무엇인가요?" \
    "   - 최신 코드를 가져와 npm ci로 의존성을 재현하고 React 앱을 새로 빌드합니다." \
    "   - API와 파이프라인은 직접 교체하지 않고 프론트엔드 번들만 갱신합니다." \
    "" \
    "🕒 When to use? / 언제 사용하나요?" \
    "   - React, CSS, 이미지 등 화면 코드만 변경했을 때 사용하세요." \
    "" \
    "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
    "   - 비활성 dist.next에 빌드한 뒤 검증된 번들을 활성화합니다." \
    "   - 사용자는 새로고침하면 새 화면을 보며, 정상 배포에서는 중단이 예상되지 않습니다." \
    "🧯 점검 실패 시 기존 화면 번들을 자동으로 되돌립니다."
else
  cicd_print_section "🚀" "Frontend deployment / 프론트엔드 배포 시작"
fi
cicd_require_commands docker git curl npm
cicd_validate_env_files

cd "$CICD_PROJECT_ROOT"
if [[ "${CICD_DEPLOY_RESUMED:-0}" != "1" ]]; then
  if ! cicd_confirm "Update only the frontend bundle from the latest upstream revision?"; then
    log_warn "🚫 Frontend update cancelled. / 프론트엔드 업데이트를 취소했습니다."
    exit 0
  fi
  check_git_status
  pull_latest_changes
  exec env CICD_DEPLOY_RESUMED=1 CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/update_frontend.sh"
fi
cicd_print_step 1 3 "🎨" "Build an inactive frontend bundle / 비활성 번들 빌드"
cicd_stage_frontend
cicd_print_step 2 3 "🌐" "Activate the verified bundle / 검증된 번들 활성화"
cicd_activate_frontend
cicd_print_step 3 3 "🩺" "Run health checks / 전체 서비스 점검"
if ! CICD_ASSUME_YES=1 bash "$SCRIPT_DIR/check_health.sh"; then
  cicd_rollback_frontend || true
  exit 1
fi
cicd_commit_frontend
log_success "🎉 Frontend update completed. / 프론트엔드 업데이트를 완료했습니다."
