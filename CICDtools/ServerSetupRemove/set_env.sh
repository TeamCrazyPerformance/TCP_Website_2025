#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=../utils/runtime.sh
source "$SCRIPT_DIR/../utils/runtime.sh"

mode="${1:-}"
[[ "$mode" == "prod" || "$mode" == "dev" ]] || {
  log_error "Usage: $0 prod|dev"
  exit 2
}
export CICD_ENVIRONMENT="$mode"
cicd_require_commands openssl awk mktemp

if [[ "$mode" == "prod" ]]; then
  mode_label="production / 운영"
  gemini_rule="Gemini API key: required / 필수"
else
  mode_label="development / 개발"
  gemini_rule="Gemini API key: optional / 선택"
fi
cicd_print_banner "🔧" "Environment Setup ($mode_label) / 환경값 초기 설정" \
  "📘 여러 서비스의 환경 파일을 안전하고 재실행 가능하게 구성합니다." \
  "♻️  기존의 비어 있지 않은 값은 보존하고 누락된 내부 시크릿만 자동 생성합니다." \
  "🎲 Auto-generated / 자동 생성: JWT, PostgreSQL, ELK, service token, pipeline MySQL passwords" \
  "✍️  User input / 외부 입력: administrator, Gemini, crawler identity" \
  "🤖 $gemini_rule" \
  "🙈 시크릿 입력은 숨기며 값 자체를 화면이나 로그에 출력하지 않습니다." \
  "🔒 생성·갱신한 .env와 envs/*.env 권한은 0600으로 설정합니다."

readonly ROOT_ENV="$CICD_PROJECT_ROOT/.env"
readonly API_ENV="$CICD_PROJECT_ROOT/envs/api.env"
readonly ELK_ENV="$CICD_PROJECT_ROOT/envs/elk.env"
if [[ "$mode" == "prod" ]]; then
  readonly DB_ENV="$CICD_PROJECT_ROOT/envs/db_prod.env"
  readonly NODE_ENV_VALUE="production"
else
  readonly DB_ENV="$CICD_PROJECT_ROOT/envs/db_dev.env"
  readonly NODE_ENV_VALUE="development"
fi

cicd_print_section "🧭" "Configuration overview / 설정 항목 안내"
printf '%s\n' "   🔧 Fixed defaults / 고정 기본값"
printf '%s\n' "      - NODE_ENV=$NODE_ENV_VALUE, API port=3000, DB host=db, DB port=5432"
printf '%s\n' "      - Crawler defaults: https://teamcrazyperformance.com/ · seoultech.tcp@gmail.com"
printf '%s\n' "   🎲 Internal secrets / 내부 시크릿"
printf '%s\n' "      - JWT, PostgreSQL, ELK, pipeline service token, MySQL passwords"
printf '%s\n' "      - [Hidden / 숨김] Existing values are preserved; only missing values are generated."
printf '%s\n' "   ✍️  External input / 외부 입력"
printf '%s\n' "      - Administrator account, Gemini API key, crawler identity (only when missing)"
printf '%s\n' "   📁 Managed files / 관리 파일"
printf '%s\n' "      - .env, envs/api.env, $(basename "$DB_ENV"), envs/elk.env"

ensure_value() {
  local file="$1" key="$2" value="$3"
  cicd_env_has_nonempty "$file" "$key" || cicd_env_set "$file" "$key" "$value"
}

prompt_plain_required() {
  local prompt="$1" value=""
  while [[ -z "$value" ]]; do cicd_read_prompt value "✍️  $prompt:"; done
  printf '%s' "$value"
}

prompt_secret_required() {
  local prompt="$1" value=""
  while [[ -z "$value" ]]; do
    cicd_read_secret_prompt value "🔐 $prompt:"
  done
  printf '%s' "$value"
}

log_info "♻️  Configuring $mode environment; existing non-empty values will be preserved. / 기존 설정은 보존합니다."
mkdir -p "$CICD_PROJECT_ROOT/envs"

# Root .env is the only source for Compose interpolation used by the pipeline.
cicd_print_step 1 4 "🎲" "Fill missing internal pipeline settings / 누락된 파이프라인 내부 설정 생성"
ensure_value "$ROOT_ENV" COMPOSE_PROJECT_NAME tcp-website
ensure_value "$ROOT_ENV" PIPELINE_SERVICE_TOKEN "$(cicd_generate_hex 32)"
ensure_value "$ROOT_ENV" TECH_ARTICLE_MYSQL_DATABASE tech_articles
ensure_value "$ROOT_ENV" TECH_ARTICLE_MYSQL_USER pipeline
ensure_value "$ROOT_ENV" TECH_ARTICLE_MYSQL_PASSWORD "$(cicd_generate_hex 32)"
ensure_value "$ROOT_ENV" TECH_ARTICLE_MYSQL_ROOT_PASSWORD "$(cicd_generate_hex 32)"
ensure_value "$ROOT_ENV" PIPELINE_WORKER_CONCURRENCY 1
ensure_value "$ROOT_ENV" PIPELINE_WORKER_POLL_SECONDS 1
ensure_value "$ROOT_ENV" PIPELINE_WORKER_LEASE_SECONDS 60
ensure_value "$ROOT_ENV" PIPELINE_JOB_MAX_ATTEMPTS 3
ensure_value "$ROOT_ENV" TECH_ARTICLE_MYSQL_POOL_SIZE 5
ensure_value "$ROOT_ENV" TECH_ARTICLE_AUTO_CRAWL_ENABLED false
ensure_value "$ROOT_ENV" TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES 10
ensure_value "$ROOT_ENV" TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS 48
ensure_value "$ROOT_ENV" GEMINI_MODEL gemini-3.5-flash-lite

if { [[ "$mode" == "prod" ]] && ! cicd_env_has_nonempty "$ROOT_ENV" GEMINI_API_KEY; } || \
   { [[ "$mode" == "dev" ]] && ! cicd_env_has_key "$ROOT_ENV" GEMINI_API_KEY; }; then
  if [[ "$mode" == "prod" ]]; then
    gemini_key="$(prompt_secret_required 'Gemini API key / Gemini API 키 (required in production / 운영 필수)')"
    cicd_env_set "$ROOT_ENV" GEMINI_API_KEY "$gemini_key"
  else
    cicd_read_secret_prompt gemini_key "🤖 Gemini API key / Gemini API 키 (optional in development, Enter to skip / 개발 선택):"
    if [[ -n "$gemini_key" ]]; then
      cicd_env_set "$ROOT_ENV" GEMINI_API_KEY "$gemini_key"
    else
      cicd_env_set "$ROOT_ENV" GEMINI_API_KEY ""
      log_warn "🤖 Gemini enrichment will be unavailable until a key is configured. / 키 설정 전까지 AI 보강 기능은 사용할 수 없습니다."
    fi
  fi
fi

if ! cicd_env_has_nonempty "$ROOT_ENV" CRAWLER_PUBLIC_URL; then
  cicd_read_prompt crawler_url "🌐 Crawler public URL / 크롤러 공개 URL [https://teamcrazyperformance.com/]:"
  crawler_url="${crawler_url:-https://teamcrazyperformance.com/}"
  [[ "$crawler_url" =~ ^https?://[^[:space:]]+$ ]] || { log_error "Crawler URL must be an HTTP(S) URL."; exit 2; }
  cicd_env_set "$ROOT_ENV" CRAWLER_PUBLIC_URL "$crawler_url"
fi
if ! cicd_env_has_nonempty "$ROOT_ENV" CRAWLER_CONTACT; then
  cicd_read_prompt crawler_contact "📧 Crawler contact email / 크롤러 연락 이메일 [seoultech.tcp@gmail.com]:"
  crawler_contact="${crawler_contact:-seoultech.tcp@gmail.com}"
  [[ "$crawler_contact" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { log_error "Crawler contact must be an email address."; exit 2; }
  cicd_env_set "$ROOT_ENV" CRAWLER_CONTACT "$crawler_contact"
fi

# API gets only API settings. Compose injects the shared service token directly.
cicd_print_step 2 4 "⚙️" "Configure API and PostgreSQL / API·PostgreSQL 설정"
ensure_value "$API_ENV" PORT 3000
ensure_value "$API_ENV" NODE_ENV "$NODE_ENV_VALUE"
ensure_value "$API_ENV" BCRYPT_SALT_ROUNDS 12
ensure_value "$API_ENV" JWT_SECRET "$(cicd_generate_hex 64)"

postgres_password="$(cicd_env_get "$DB_ENV" POSTGRES_PASSWORD 2>/dev/null || true)"
[[ -n "$postgres_password" ]] || postgres_password="$(cicd_env_get "$DB_ENV" DB_PASSWORD 2>/dev/null || true)"
[[ -n "$postgres_password" ]] || postgres_password="$(cicd_generate_hex 32)"
ensure_value "$DB_ENV" POSTGRES_USER tcp_user
ensure_value "$DB_ENV" POSTGRES_PASSWORD "$postgres_password"
ensure_value "$DB_ENV" POSTGRES_DB tcp_db
ensure_value "$DB_ENV" DB_HOST db
ensure_value "$DB_ENV" DB_PORT 5432
ensure_value "$DB_ENV" DB_USER "$(cicd_env_get "$DB_ENV" POSTGRES_USER)"
ensure_value "$DB_ENV" DB_PASSWORD "$postgres_password"
ensure_value "$DB_ENV" DB_NAME "$(cicd_env_get "$DB_ENV" POSTGRES_DB)"

if ! cicd_env_has_nonempty "$DB_ENV" ADMIN_USERNAME; then
  cicd_env_set "$DB_ENV" ADMIN_USERNAME "$(prompt_plain_required 'Administrator username / 관리자 아이디')"
fi
if ! cicd_env_has_nonempty "$DB_ENV" ADMIN_EMAIL; then
  admin_email="$(prompt_plain_required 'Administrator email / 관리자 이메일')"
  [[ "$admin_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { log_error "Administrator email is invalid."; exit 2; }
  cicd_env_set "$DB_ENV" ADMIN_EMAIL "$admin_email"
fi
if ! cicd_env_has_nonempty "$DB_ENV" ADMIN_PASSWORD; then
  cicd_env_set "$DB_ENV" ADMIN_PASSWORD "$(prompt_secret_required 'Administrator password / 관리자 비밀번호')"
fi

cicd_print_step 3 4 "📊" "Configure ELK internal credentials / ELK 내부 자격 증명 설정"
ensure_value "$ELK_ENV" ELASTIC_PASSWORD "$(cicd_generate_hex 24)"
ensure_value "$ELK_ENV" KIBANA_SYSTEM_PASSWORD "$(cicd_generate_hex 24)"
ensure_value "$ELK_ENV" LOGSTASH_PASSWORD "$(cicd_generate_hex 24)"

cicd_print_step 4 4 "🔒" "Protect files and verify SSL requirements / 파일 권한·SSL 요구사항 확인"
chmod 600 "$ROOT_ENV" "$API_ENV" "$DB_ENV" "$ELK_ENV"
cicd_require_production_ssl
log_success "🎉 Environment setup completed. Secret values were not printed or logged. / 환경값 설정을 완료했습니다."
cicd_print_section "✅" "Saved configuration / 저장 결과"
printf '%s\n' "   - Existing values: preserved / 기존 값: 보존"
printf '%s\n' "   - Missing internal secrets: securely generated / 누락 내부 시크릿: 안전하게 생성"
printf '%s\n' "   - File permissions: 0600 / 파일 권한: 0600"
cicd_print_section "📌" "Next step / 다음 단계"
if [[ "$mode" == "prod" ]]; then
  printf '%s\n' "   ▶ Continue with prodserver_quicksetup.sh to build and start every service."
  printf '%s\n' "   ▶ prodserver_quicksetup.sh로 돌아가 전체 서비스를 구축하세요."
else
  printf '%s\n' "   ▶ Continue with devserver_quicksetup.sh to build and start every service."
  printf '%s\n' "   ▶ devserver_quicksetup.sh로 돌아가 전체 서비스를 구축하세요."
fi
