#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

command_name="${1:-help}"
private_qa_setup_logging "$command_name"

print_usage() {
  cicd_print_banner "🏠" "Private Home QA Deployment / 가정용 Private QA 배포" \
    "📘 What is this? / 이건 무엇인가요?" \
    "   - 운영 데이터와 완전히 분리된 빈 DB로 기술 아티클 전체 흐름을 QA합니다." \
    "   - PostgreSQL + pipeline MySQL + pipeline + API + frontend + HTTP proxy만 실행합니다." \
    "   - ELK, 운영 SSL, 운영 DB와 운영 환경 파일은 사용하지 않습니다." \
    "" \
    "🌐 Network / 네트워크" \
    "   - 외부에는 HTTP 포트 하나만 공개합니다. DB·API·pipeline 내부 포트는 공개하지 않습니다." \
    "   - 공유기에서는 선택한 외부 포트를 이 PC의 QA HTTP 포트로 전달하세요." \
    "   - HTTP는 암호화되지 않습니다. 실제 계정 비밀번호를 재사용하지 마세요." \
    "" \
    "🧭 Commands / 명령어" \
    "   bash private_qa.sh setup              최초 설정·빈 DB 구축" \
    "   bash private_qa.sh update             Git pull 후 재배포(DB 보존)" \
    "   bash private_qa.sh start              기존 이미지·DB로 재기동" \
    "   bash private_qa.sh stop               컨테이너 중지(DB 보존)" \
    "   bash private_qa.sh status             전체 상태·접속 주소 확인" \
    "   bash private_qa.sh logs [service]     최근 로그 실시간 확인" \
    "   bash private_qa.sh config <item>      Gemini·자동 수집·크롤러·포트·내부 토큰 변경" \
    "   bash private_qa.sh reset              QA DB·업로드 삭제 후 빈 상태 재구축"
}

print_http_warning() {
  cicd_print_section "⚠️" "HTTP-only QA safety / HTTP 전용 QA 주의사항"
  printf '%s\n' "   - 로그인 정보와 트래픽은 TLS로 암호화되지 않습니다."
  printf '%s\n' "   - 실제 서비스 계정·비밀번호·운영 데이터를 절대 사용하지 마세요."
  printf '%s\n' "   - 가능하면 공유기 공개 대신 VPN을 사용하고, QA 종료 후 포트포워딩을 제거하세요."
}

case "$command_name" in
  help|-h|--help)
    print_usage
    ;;

  setup)
    print_usage
    print_http_warning
    if ! cicd_confirm "Create or update the isolated Private QA stack? / 격리된 QA 환경을 구축할까요?"; then
      log_warn "🚫 Setup cancelled. / QA 구축을 취소했습니다."
      exit 0
    fi
    private_qa_require_commands
    cicd_print_step 1 2 "🔐" "Create or preserve isolated QA settings / QA 전용 환경값 설정"
    private_qa_ensure_env
    private_qa_validate_env
    cicd_print_step 2 2 "🚀" "Build and start the complete QA path / 전체 QA 환경 구축"
    private_qa_deploy 1
    private_qa_show_access
    ;;

  update)
    cicd_print_banner "🔄" "Private QA Update / Private QA 업데이트" \
      "📘 최신 upstream 코드를 가져와 QA 이미지를 다시 빌드하고 마이그레이션합니다." \
      "💾 PostgreSQL·pipeline MySQL·업로드 볼륨은 보존합니다." \
      "🛑 로컬 변경 또는 fast-forward할 수 없는 Git 상태에서는 안전하게 중단합니다."
    private_qa_require_commands
    private_qa_validate_env
    if [[ "${PRIVATE_QA_UPDATE_RESUMED:-0}" != "1" ]]; then
      if ! cicd_confirm "Pull latest code and update Private QA? / 최신 코드로 QA를 업데이트할까요?"; then
        log_warn "🚫 Update cancelled. / 업데이트를 취소했습니다."
        exit 0
      fi
      private_qa_pull_latest
      exec env PRIVATE_QA_UPDATE_RESUMED=1 PRIVATE_QA_LOGGING_ACTIVE=1 bash "$SCRIPT_DIR/private_qa.sh" update
    fi
    private_qa_deploy 1
    private_qa_show_access
    ;;

  start)
    cicd_print_banner "▶️" "Start Private QA / Private QA 재기동" \
      "📘 기존 로컬 이미지와 QA 볼륨을 사용해 서비스를 다시 시작합니다." \
      "🧬 안전을 위해 두 DB migration과 관리자 seed를 다시 확인합니다." \
      "💾 기존 QA 데이터는 보존합니다."
    private_qa_require_commands
    private_qa_validate_env
    private_qa_deploy 0
    private_qa_show_access
    ;;

  stop)
    cicd_print_banner "⏸️" "Stop Private QA / Private QA 중지" \
      "📘 Private QA 컨테이너만 중지합니다." \
      "💾 DB와 업로드 볼륨, 환경 설정은 삭제하지 않습니다." \
      "▶️  다시 실행하려면 './private_qa.sh start'를 사용하세요."
    private_qa_require_commands
    private_qa_validate_env
    private_qa_compose stop
    log_success "Private QA containers stopped; data was preserved. / QA 데이터를 보존하고 컨테이너를 중지했습니다."
    ;;

  status)
    cicd_print_banner "🩺" "Private QA Status / Private QA 상태 확인" \
      "📘 컨테이너, migration, API-pipeline 연결, 공개 API와 SPA를 모두 확인합니다." \
      "💡 Gemini 실요청은 보내지 않아 비용이 발생하지 않습니다."
    private_qa_require_commands
    private_qa_compose ps
    private_qa_check_health
    private_qa_show_access
    ;;

  logs)
    private_qa_require_commands
    private_qa_validate_env
    service="${2:-}"
    if [[ -n "$service" ]]; then
      case "$service" in
        postgres|pipeline-mysql|pipeline-migrate|tech-article-pipeline|api-migrate|api-seed|api|web|reverse-proxy) ;;
        *) log_error "Unknown service '$service'. Run 'bash private_qa.sh help'. / 알 수 없는 서비스입니다."; exit 2 ;;
      esac
      cicd_print_section "📜" "Following '$service' logs (Ctrl+C to stop) / 서비스 로그 확인"
      private_qa_compose logs --tail=200 --follow "$service"
    else
      cicd_print_section "📜" "Following all Private QA logs (Ctrl+C to stop) / 전체 로그 확인"
      private_qa_compose logs --tail=200 --follow
    fi
    ;;

  config)
    setting="${2:-}"
    cicd_print_banner "🛠️" "Private QA Configuration / Private QA 설정 변경" \
      "📘 선택한 설정만 변경하고 영향받는 컨테이너만 재생성합니다." \
      "🧯 readiness 실패 시 정확한 이전 환경 파일로 자동 복구합니다." \
      "🔐 Supported: gemini-key, gemini-model, crawler-identity, auto-crawl, service-token, http-port"
    private_qa_require_commands
    private_qa_update_config "$setting"
    private_qa_show_access
    ;;

  reset)
    cicd_print_banner "🧨" "Reset Private QA Data / Private QA 데이터 초기화" \
      "🚨 Private QA 프로젝트의 PostgreSQL, pipeline MySQL, 업로드 볼륨을 영구 삭제합니다." \
      "🧱 운영 Compose 프로젝트와 운영 볼륨은 대상에 포함되지 않습니다." \
      "🔐 .private-qa.env는 보존하므로 같은 QA 계정·내부 시크릿을 다시 사용합니다." \
      "🆕 삭제 후 migration과 seed를 실행해 완전히 빈 QA 데이터로 재구축합니다."
    private_qa_require_commands
    private_qa_validate_env
    if ! cicd_confirm_dangerous_action "RESET-QA" \
      "Only tcp-private-qa containers and volumes will be permanently deleted." \
      "tcp-private-qa 전용 컨테이너와 볼륨의 데이터가 영구 삭제됩니다."; then
      log_warn "🚫 Reset cancelled. Nothing was deleted. / 초기화를 취소했습니다."
      exit 0
    fi
    private_qa_compose down --volumes --remove-orphans
    log_success "🧹 Private QA volumes were removed. / QA 전용 볼륨을 삭제했습니다."
    private_qa_deploy 1
    private_qa_show_access
    ;;

  *)
    log_error "Unknown command '$command_name'. / 알 수 없는 명령어입니다."
    print_usage
    exit 2
    ;;
esac
