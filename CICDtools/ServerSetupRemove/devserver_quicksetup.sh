#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=../utils/runtime.sh
source "$SCRIPT_DIR/../utils/runtime.sh"
# shellcheck source=../utils/deployment_steps.sh
source "$SCRIPT_DIR/../utils/deployment_steps.sh"

setup_logging "devserver_quicksetup"
export CICD_ENVIRONMENT=dev
cicd_print_banner "🧰" "Development Server Quick Setup / 개발 서버 빠른 구축" \
  "📘 What is this? / 이건 무엇인가요?" \
  "   - docker-compose.dev.yml을 포함해 로컬·개발용 전체 서비스 환경을 처음부터 구성합니다." \
  "" \
  "🕒 When to use? / 언제 사용하나요?" \
  "   - 새 개발 환경을 만들거나 전체 서비스 변경을 로컬에서 함께 검증할 때 사용하세요." \
  "" \
  "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
  "   - PostgreSQL, ELK, pipeline MySQL, 기술 아티클 파이프라인, API, frontend를 순서대로 구축합니다." \
  "🔐 내부 시크릿은 자동 생성하며 Gemini API 키는 개발 환경에서 생략할 수 있습니다." \
  "🌐 공개 경로 점검은 기본적으로 http://127.0.0.1을 사용합니다." \
  "💥 Docker 볼륨과 DB 스키마를 생성하므로 입력을 세 번 확인합니다."
cicd_require_commands docker curl npm openssl git

if ! cicd_confirm_dangerous_action "SETUP" \
  "This initializes the complete development stack and both database volumes." \
  "전체 개발 서비스와 PostgreSQL·pipeline MySQL 볼륨을 초기화합니다."; then
  log_warn "🚫 Setup cancelled. / 개발 서버 구축을 취소했습니다."
  exit 0
fi

cicd_print_step 1 7 "🔐" "Configure development environment / 개발 환경값 설정"
bash "$SCRIPT_DIR/set_env.sh" dev
cicd_print_step 2 7 "🎨" "Build inactive frontend bundle / 프론트엔드 선행 빌드"
cicd_stage_frontend
cicd_print_step 3 7 "🗄️" "Start PostgreSQL and observability services / DB·ELK 기동"
cicd_compose up -d db elasticsearch logstash kibana filebeat
cicd_print_step 4 7 "📰" "Deploy pipeline and MySQL migrations / 파이프라인 구축"
cicd_deploy_pipeline
cicd_print_step 5 7 "⚙️" "Deploy API and seed administrator / API 구축·관리자 생성"
cicd_deploy_api
cicd_seed_admin
cicd_verify_api_pipeline_integration
cicd_print_step 6 7 "🌐" "Activate frontend and remaining services / 프론트엔드·나머지 서비스 기동"
cicd_activate_frontend
cicd_compose up -d
cicd_print_step 7 7 "🩺" "Run end-to-end health checks / 전체 서비스 점검"
if ! CICD_PUBLIC_BASE_URL="${CICD_PUBLIC_BASE_URL:-http://127.0.0.1}" \
  CICD_ASSUME_YES=1 bash "$CICD_PROJECT_ROOT/CICDtools/check_health.sh"; then
  cicd_rollback_frontend || true
  exit 1
fi
cicd_commit_frontend
log_success "🎉 Fresh development setup completed with both databases and the technical-article service. / 개발 서버 구축을 완료했습니다."
