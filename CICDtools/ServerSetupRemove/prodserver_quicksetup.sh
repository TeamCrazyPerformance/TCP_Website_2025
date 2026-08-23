#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=../utils/runtime.sh
source "$SCRIPT_DIR/../utils/runtime.sh"
# shellcheck source=../utils/deployment_steps.sh
source "$SCRIPT_DIR/../utils/deployment_steps.sh"

setup_logging "prodserver_quicksetup"
export CICD_ENVIRONMENT=prod
cicd_print_banner "🏗️" "Production Server Quick Setup / 운영 서버 빠른 구축" \
  "📘 What is this? / 이건 무엇인가요?" \
  "   - 빈 운영 서버에 TCP 웹사이트의 전체 서비스를 처음부터 구성합니다." \
  "" \
  "🕒 When to use? / 언제 사용하나요?" \
  "   - 새 운영 서버를 처음 설정하거나 완전히 비어 있는 환경을 구축할 때 사용하세요." \
  "" \
  "💥 What happens next? / 실행하면 무슨 일이 일어나나요?" \
  "   - 환경값·권한 → frontend 선행 빌드 → 두 DB migration → 관리자 seed → 서비스·연동 점검 순서입니다." \
  "   - PostgreSQL, ELK, pipeline MySQL, 기술 아티클 파이프라인, NestJS API, React frontend를 포함합니다." \
  "🔐 내부 시크릿은 자동 생성하고, 관리자·Gemini·크롤러 정보는 필요한 경우 입력받습니다." \
  "🔒 SSL origin.crt/origin.key는 외부 서버 설정이 먼저 주입해야 하며 여기서는 존재만 확인합니다." \
  "💥 Docker 볼륨·DB 스키마·관리자 계정을 생성하므로 입력을 세 번 확인합니다."
cicd_require_commands docker curl npm openssl git

if ! cicd_confirm_dangerous_action "SETUP" \
  "This initializes every production service and both database volumes." \
  "전체 운영 서비스와 PostgreSQL·pipeline MySQL 볼륨을 초기화합니다."; then
  log_warn "🚫 Setup cancelled. / 운영 서버 구축을 취소했습니다."
  exit 0
fi

cicd_print_step 1 8 "🔐" "Configure environment and secrets / 환경값·시크릿 설정"
bash "$SCRIPT_DIR/set_env.sh" prod
cicd_require_production_ssl
cicd_print_step 2 8 "🎨" "Build inactive frontend bundle / 프론트엔드 선행 빌드"
cicd_stage_frontend

cicd_print_step 3 8 "🖥️" "Apply Elasticsearch and Filebeat host settings / 호스트 설정 적용"
cicd_as_root sysctl -w vm.max_map_count=262144 >/dev/null
cicd_as_root chown root:root "$CICD_PROJECT_ROOT/elk/filebeat/filebeat.yml"
cicd_as_root chmod 600 "$CICD_PROJECT_ROOT/elk/filebeat/filebeat.yml"

cicd_print_step 4 8 "🗄️" "Start PostgreSQL and observability services / DB·ELK 기동"
cicd_compose up -d db elasticsearch logstash kibana filebeat
cicd_print_step 5 8 "📰" "Deploy pipeline and MySQL migrations / 파이프라인 구축"
cicd_deploy_pipeline
cicd_print_step 6 8 "⚙️" "Deploy API and PostgreSQL migrations / API 구축"
cicd_deploy_api
cicd_seed_admin
cicd_verify_api_pipeline_integration
cicd_print_step 7 8 "🌐" "Activate frontend and start remaining services / 프론트엔드·나머지 서비스 기동"
cicd_activate_frontend
cicd_compose up -d
cicd_print_step 8 8 "🩺" "Run end-to-end health checks / 전체 서비스 점검"
if ! CICD_ASSUME_YES=1 bash "$CICD_PROJECT_ROOT/CICDtools/check_health.sh"; then
  cicd_rollback_frontend || true
  exit 1
fi
cicd_commit_frontend
log_success "🎉 Fresh production setup completed with both databases and the technical-article service. / 운영 서버 구축을 완료했습니다."
