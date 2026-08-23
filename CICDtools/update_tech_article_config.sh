#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"

setup_logging "update_tech_article_config"
cicd_require_commands docker openssl
cicd_validate_env_files

setting="${1:-}"
case "$setting" in
  gemini-key|gemini-model|crawler-identity|auto-crawl|service-token) ;;
  *) log_error "Usage: $0 [gemini-key|gemini-model|crawler-identity|auto-crawl|service-token]"; exit 2 ;;
esac

case "$setting" in
  gemini-key) setting_description="Gemini API key / Gemini API 키"; affected_description="tech-article-pipeline" ;;
  gemini-model) setting_description="Gemini model / Gemini 모델"; affected_description="tech-article-pipeline" ;;
  crawler-identity) setting_description="Crawler URL and contact / 크롤러 URL·연락처"; affected_description="tech-article-pipeline" ;;
  auto-crawl) setting_description="Automatic article crawling / 기술 기사 자동 수집"; affected_description="api" ;;
  service-token) setting_description="Internal API-to-pipeline token / 내부 서비스 토큰"; affected_description="api + tech-article-pipeline" ;;
esac
cicd_print_banner "🛠️" "Technical-Article Configuration / 기술 아티클 설정 변경" \
  "📘 Selected setting / 선택 항목: $setting_description" \
  "♻️  Recreated services / 재생성 서비스: $affected_description" \
  "🧩 선택하지 않은 환경값은 바이트 단위로 그대로 보존합니다." \
  "🧯 readiness 실패 시 환경 파일과 컨테이너 설정을 이전 상태로 자동 복구합니다." \
  "🔐 시크릿 값은 화면이나 로그에 다시 출력하지 않습니다."

root_env="$CICD_PROJECT_ROOT/.env"
rollback_file="$(mktemp)"
cp -p "$root_env" "$rollback_file"
cleanup() { rm -f "$rollback_file"; }
trap cleanup EXIT

case "$setting" in
  gemini-key)
    cicd_read_secret_prompt value "🔑 New Gemini API key / 새 Gemini API 키:"
    [[ -n "$value" ]] || { log_error "Gemini API key cannot be empty."; exit 2; }
    cicd_env_set "$root_env" GEMINI_API_KEY "$value"
    services=(tech-article-pipeline)
    ;;
  gemini-model)
    cicd_read_prompt value "🤖 New Gemini model / 새 Gemini 모델:"
    [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]] || { log_error "Gemini model contains unsupported characters."; exit 2; }
    cicd_env_set "$root_env" GEMINI_MODEL "$value"
    services=(tech-article-pipeline)
    ;;
  crawler-identity)
    cicd_read_prompt crawler_url "🌐 Crawler public URL / 공개 URL [https://teamcrazyperformance.com/]:"
    crawler_url="${crawler_url:-https://teamcrazyperformance.com/}"
    cicd_read_prompt crawler_contact "📧 Crawler contact / 연락 이메일 [seoultech.tcp@gmail.com]:"
    crawler_contact="${crawler_contact:-seoultech.tcp@gmail.com}"
    [[ "$crawler_url" =~ ^https?://[^[:space:]]+$ ]] || { log_error "Crawler URL must be HTTP(S)."; exit 2; }
    [[ "$crawler_contact" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { log_error "Crawler contact must be an email address."; exit 2; }
    cicd_env_set "$root_env" CRAWLER_PUBLIC_URL "$crawler_url"
    cicd_env_set "$root_env" CRAWLER_CONTACT "$crawler_contact"
    services=(tech-article-pipeline)
    ;;
  auto-crawl)
    cicd_read_prompt value "🕒 Enable automatic article crawling? [true/false] / 자동 수집 활성화 여부:"
    [[ "$value" == "true" || "$value" == "false" ]] || { log_error "Automatic crawling must be true or false."; exit 2; }
    cicd_env_set "$root_env" TECH_ARTICLE_AUTO_CRAWL_ENABLED "$value"
    services=(api)
    ;;
  service-token)
    cicd_read_secret_prompt value "🔐 New service token / 새 토큰 (Enter: secure auto-generate / 안전한 자동 생성):"
    value="${value:-$(cicd_generate_hex 32)}"
    cicd_env_set "$root_env" PIPELINE_SERVICE_TOKEN "$value"
    services=(api tech-article-pipeline)
    ;;
esac
chmod 600 "$root_env"

cicd_print_step 1 2 "♻️" "Recreate only affected services / 영향받는 서비스만 재생성"
if cicd_compose up -d --no-deps --force-recreate "${services[@]}"; then
  healthy=1
  for service in "${services[@]}"; do
    if ! cicd_wait_service "$service" healthy 180; then healthy=0; break; fi
  done
else
  healthy=0
fi
if (( healthy == 1 )) && [[ "$setting" == "service-token" ]]; then
  if ! cicd_compose exec -T api node -e \
    "fetch('http://127.0.0.1:3000/api/v1/tech-articles/tags').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    healthy=0
  fi
fi

if (( healthy == 0 )); then
  cp -p "$rollback_file" "$root_env"
  chmod 600 "$root_env"
  cicd_compose up -d --no-deps --force-recreate "${services[@]}" || true
  for service in "${services[@]}"; do cicd_wait_service "$service" healthy 180 || true; done
  log_error "Readiness failed. The exact previous environment file and container configuration were restored. / 준비 상태 확인에 실패해 이전 설정을 복구했습니다."
  exit 1
fi

cicd_print_step 2 2 "🩺" "Readiness and integration confirmed / 준비 상태·연동 확인 완료"
log_success "🎉 $setting updated without exposing its value; unrelated environment bytes were preserved. / 선택한 설정만 안전하게 변경했습니다."
