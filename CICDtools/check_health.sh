#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=utils/runtime.sh
source "$SCRIPT_DIR/utils/runtime.sh"

setup_logging "check_health"
cicd_print_banner "🩺" "Full Service Health Check / 전체 서비스 상태 점검" \
  "📘 컨테이너뿐 아니라 실제 사용자 경로까지 순서대로 확인합니다." \
  "🔎 API live → pipeline ready → reverse proxy 공개 태그 API → /tech-articles SPA를 검사합니다." \
  "💡 Gemini API를 호출하지 않으므로 비용이나 외부 AI 장애가 이 점검에 영향을 주지 않습니다." \
  "✅ 모든 단계가 통과해야 성공 코드로 종료합니다."
cicd_require_commands docker curl
cicd_validate_env_files
cicd_require_production_ssl

required_services=(db pipeline-mysql pipeline-migrate tech-article-pipeline api web reverse-proxy)
cicd_print_step 1 5 "🐳" "Check all required containers / 필수 컨테이너 상태 확인"
for service in "${required_services[@]}"; do
  if [[ "$service" == "pipeline-migrate" ]]; then
    cicd_wait_service "$service" exited 30
  elif [[ "$service" == "web" ]]; then
    container_id="$(cicd_service_container_id "$service")"
    [[ -n "$container_id" ]] || { log_error "$service container is missing."; exit 1; }
    state="$(cicd_docker inspect --format '{{.State.Status}}' "$container_id")"
    [[ "$state" == "running" ]] || { log_error "$service is $state."; exit 1; }
  else
    cicd_wait_service "$service" healthy 30
  fi
done

cicd_print_step 2 5 "⚙️" "Check API liveness inside the private network / API 내부 상태 확인"
cicd_compose exec -T api node -e \
  "fetch('http://127.0.0.1:3000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

cicd_print_step 3 5 "📰" "Check pipeline readiness inside the private network / 파이프라인 준비 상태 확인"
cicd_compose exec -T tech-article-pipeline python -c \
  "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=5)"

curl_route_args=()
if [[ -n "${CICD_PUBLIC_BASE_URL:-}" ]]; then
  public_base_url="$CICD_PUBLIC_BASE_URL"
elif [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
  public_base_url="http://127.0.0.1"
else
  public_base_url="https://teamcrazyperformance.com"
  # Cloudflare Origin certificates are intentionally not public-trust certificates.
  # Route to local Nginx while preserving SNI/Host; file presence is checked above.
  curl_route_args=(--resolve teamcrazyperformance.com:443:127.0.0.1 --insecure)
fi
cicd_print_step 4 5 "🔗" "Check the public tags API through the reverse proxy / 공개 API 경로 확인"
cicd_http_check "$public_base_url/api/v1/tech-articles/tags" "public technical-article tags API" "${curl_route_args[@]}"

cicd_print_step 5 5 "🌐" "Check the technical-article SPA route / 기술 아티클 화면 경로 확인"
spa_body="$(mktemp)"
trap 'rm -f "$spa_body"' EXIT
curl --fail --silent --show-error --max-time 10 "${curl_route_args[@]}" "$public_base_url/tech-articles" --output "$spa_body"
grep -qi '<!doctype html\|<html' "$spa_body" || {
  log_error "The /tech-articles response is not an HTML SPA document."
  exit 1
}

log_success "🎉 All containers and end-to-end technical-article checks passed. / 전체 서비스가 정상입니다."
