#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${TCP_PRIVATE_QA_COMMON_LOADED:-}" ]]; then
  return 0
fi
readonly TCP_PRIVATE_QA_COMMON_LOADED=1

PRIVATE_QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PRIVATE_QA_DIR
PRIVATE_QA_PROJECT_ROOT="${PRIVATE_QA_PROJECT_ROOT_OVERRIDE:-$(cd "$PRIVATE_QA_DIR/../.." && pwd)}"
readonly PRIVATE_QA_PROJECT_ROOT
PRIVATE_QA_ENV_FILE="${PRIVATE_QA_ENV_FILE_OVERRIDE:-$PRIVATE_QA_DIR/.private-qa.env}"
readonly PRIVATE_QA_ENV_FILE
PRIVATE_QA_COMPOSE_FILE="${PRIVATE_QA_COMPOSE_FILE_OVERRIDE:-$PRIVATE_QA_DIR/docker-compose.private-qa.yml}"
readonly PRIVATE_QA_COMPOSE_FILE
readonly PRIVATE_QA_PROJECT_NAME="tcp-private-qa"

# Reuse the repository's safe environment-file primitives and colorful output.
# shellcheck source=../utils/runtime.sh
source "$PRIVATE_QA_DIR/../utils/runtime.sh"

# Interactive prompts must stay on the foreground terminal. Redirecting the
# whole process through sed/tee makes prompt text race with terminal input.
# Keep console writes synchronous and append only structured log messages.
private_qa_append_log() {
  local level="$1"
  shift
  if [[ -n "${PRIVATE_QA_LOG_FILE:-}" ]]; then
    printf '[%s] [%s] %s\n' "$(timestamp)" "$level" "$*" >>"$PRIVATE_QA_LOG_FILE"
  fi
}

log_info() {
  printf '%b\n' "${BLUE}[$(timestamp)] [INFO] ℹ️  $*${NC}"
  private_qa_append_log INFO "$*"
}

log_success() {
  printf '%b\n' "${GREEN}[$(timestamp)] [SUCCESS] ✅ $*${NC}"
  private_qa_append_log SUCCESS "$*"
}

log_warn() {
  printf '%b\n' "${YELLOW}[$(timestamp)] [WARN] ⚠️  $*${NC}"
  private_qa_append_log WARN "$*"
}

log_error() {
  printf '%b\n' "${RED}[$(timestamp)] [ERROR] ❌ $*${NC}" >&2
  private_qa_append_log ERROR "$*"
}

private_qa_handle_exit() {
  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    log_success "✨ Private QA command completed. / Private QA 명령을 완료했습니다."
  else
    log_error "Private QA command failed (exit $exit_code). / Private QA 명령에 실패했습니다."
  fi
}

private_qa_setup_logging() {
  local command_name="$1" log_dir="$PRIVATE_QA_DIR/logs" log_file
  mkdir -p "$log_dir"
  chmod 700 "$log_dir"
  log_file="$log_dir/execution_$(date +%Y-%m-%d).log"

  if [[ -z "${PRIVATE_QA_LOGGING_ACTIVE:-}" ]]; then
    printf '%s\n' '--------------------------------------------------------------------------------' >>"$log_file"
    printf '[%s] STARTING private_qa %s (user: %s)\n' "$(timestamp)" "$command_name" "$(whoami)" >>"$log_file"
    chmod 600 "$log_file"
    export PRIVATE_QA_LOGGING_ACTIVE=1
    export PRIVATE_QA_LOG_FILE="$log_file"
  fi
  trap private_qa_handle_exit EXIT
}

private_qa_require_commands() {
  cicd_require_commands docker curl openssl awk mktemp
  docker compose version >/dev/null 2>&1 || {
    log_error "Docker Compose v2 is required. / Docker Compose v2가 필요합니다."
    return 127
  }
  if docker info >/dev/null 2>&1; then
    export PRIVATE_QA_DOCKER_WITH_SUDO=0
  elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    export PRIVATE_QA_DOCKER_WITH_SUDO=1
    log_info "🐳 Docker requires sudo on this host. / 이 호스트에서는 Docker에 sudo를 사용합니다."
  else
    log_error "Docker daemon is unavailable or this user lacks permission. / Docker 실행 여부와 사용자 권한을 확인하세요."
    return 1
  fi
}

private_qa_docker() {
  if [[ "${PRIVATE_QA_DOCKER_WITH_SUDO:-0}" == "1" ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

private_qa_compose() {
  [[ -s "$PRIVATE_QA_ENV_FILE" ]] || {
    log_error "Private QA environment is missing. Run 'bash private_qa.sh setup' first. / 먼저 setup을 실행하세요."
    return 1
  }
  (
    cd "$PRIVATE_QA_DIR" || exit 1
    private_qa_docker compose --project-name "$PRIVATE_QA_PROJECT_NAME" \
      --env-file "$PRIVATE_QA_ENV_FILE" -f "$PRIVATE_QA_COMPOSE_FILE" "$@"
  )
}

private_qa_ensure_value() {
  local key="$1" value="$2"
  cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" "$key" || cicd_env_set "$PRIVATE_QA_ENV_FILE" "$key" "$value"
}

private_qa_prompt_required() {
  local prompt="$1" value=""
  while [[ -z "$value" ]]; do
    read -r -p "✍️  $prompt: " value
  done
  printf '%s' "$value"
}

private_qa_prompt_secret() {
  local prompt="$1" value=""
  while [[ -z "$value" ]]; do
    read -r -s -p "🔐 $prompt: " value
    printf '\n' >&2
  done
  printf '%s' "$value"
}

private_qa_validate_port() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 && port <= 65535 ))
}

private_qa_validate_admin_password() {
  local value="$1"
  (( ${#value} >= 8 )) && [[ "$value" =~ ^[A-Za-z0-9._@%+=,:/-]+$ ]]
}

private_qa_ensure_env() {
  umask 077
  mkdir -p "$(dirname "$PRIVATE_QA_ENV_FILE")"
  [[ -f "$PRIVATE_QA_ENV_FILE" ]] || : >"$PRIVATE_QA_ENV_FILE"
  chmod 600 "$PRIVATE_QA_ENV_FILE"

  private_qa_ensure_value PRIVATE_QA_BIND_ADDRESS 0.0.0.0
  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT; then
    local http_port
    read -r -p "🌐 Host HTTP port / 외부 공개용 호스트 포트 [8088]: " http_port
    http_port="${http_port:-8088}"
    private_qa_validate_port "$http_port" || {
      log_error "HTTP port must be between 1024 and 65535. / 포트는 1024~65535 범위여야 합니다."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT "$http_port"
  fi

  private_qa_ensure_value JWT_SECRET "$(cicd_generate_hex 64)"
  private_qa_ensure_value PIPELINE_SERVICE_TOKEN "$(cicd_generate_hex 32)"
  private_qa_ensure_value POSTGRES_USER tcp_private_qa
  private_qa_ensure_value POSTGRES_PASSWORD "$(cicd_generate_hex 32)"
  private_qa_ensure_value POSTGRES_DB tcp_private_qa
  private_qa_ensure_value TECH_ARTICLE_MYSQL_DATABASE tech_articles
  private_qa_ensure_value TECH_ARTICLE_MYSQL_USER pipeline
  private_qa_ensure_value TECH_ARTICLE_MYSQL_PASSWORD "$(cicd_generate_hex 32)"
  private_qa_ensure_value TECH_ARTICLE_MYSQL_ROOT_PASSWORD "$(cicd_generate_hex 32)"

  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" ADMIN_USERNAME; then
    local admin_username
    admin_username="$(private_qa_prompt_required 'QA administrator username / QA 관리자 아이디')"
    [[ "$admin_username" =~ ^[A-Za-z0-9._-]{3,50}$ ]] || {
      log_error "Administrator username must be 3-50 safe characters. / 관리자 아이디 형식을 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" ADMIN_USERNAME "$admin_username"
  fi
  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" ADMIN_EMAIL; then
    local admin_email
    admin_email="$(private_qa_prompt_required 'QA administrator email / QA 관리자 이메일')"
    [[ "$admin_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
      log_error "Administrator email is invalid. / 관리자 이메일 형식을 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" ADMIN_EMAIL "$admin_email"
  fi
  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" ADMIN_PASSWORD; then
    local admin_password
    log_info "Use a throwaway QA password; do not reuse a real account password. / 실제 계정 비밀번호를 재사용하지 마세요."
    admin_password="$(private_qa_prompt_secret 'QA administrator password / QA 관리자 비밀번호')"
    private_qa_validate_admin_password "$admin_password" || {
      log_error "Password must be 8+ characters using letters, numbers, or ._@%+=,:/-. / 지원 문자와 길이를 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" ADMIN_PASSWORD "$admin_password"
  fi

  if ! cicd_env_has_key "$PRIVATE_QA_ENV_FILE" GEMINI_API_KEY; then
    local gemini_key
    read -r -s -p "🤖 Gemini API key (Enter to skip) / Gemini API 키 (생략 가능): " gemini_key
    printf '\n'
    [[ -z "$gemini_key" || "$gemini_key" =~ ^[A-Za-z0-9._-]+$ ]] || {
      log_error "Gemini API key contains unsupported environment-file characters. / API 키 형식을 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" GEMINI_API_KEY "$gemini_key"
    if [[ -z "$gemini_key" ]]; then
      log_warn "Gemini enrichment QA is unavailable until a key is configured. / 키 설정 전에는 AI 보강 QA를 할 수 없습니다."
    fi
  fi
  private_qa_ensure_value GEMINI_MODEL gemini-3.5-flash-lite

  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" CRAWLER_PUBLIC_URL; then
    local crawler_url
    read -r -p "🌍 Crawler public URL [https://teamcrazyperformance.com/]: " crawler_url
    crawler_url="${crawler_url:-https://teamcrazyperformance.com/}"
    [[ "$crawler_url" =~ ^https?://[^[:space:]]+$ ]] || {
      log_error "Crawler public URL must be HTTP(S). / 크롤러 URL 형식을 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" CRAWLER_PUBLIC_URL "$crawler_url"
  fi
  if ! cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" CRAWLER_CONTACT; then
    local crawler_contact
    read -r -p "📧 Crawler contact [seoultech.tcp@gmail.com]: " crawler_contact
    crawler_contact="${crawler_contact:-seoultech.tcp@gmail.com}"
    [[ "$crawler_contact" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
      log_error "Crawler contact must be an email address. / 연락처 이메일 형식을 확인하세요."
      return 2
    }
    cicd_env_set "$PRIVATE_QA_ENV_FILE" CRAWLER_CONTACT "$crawler_contact"
  fi

  private_qa_ensure_value TECH_ARTICLE_MYSQL_POOL_SIZE 5
  private_qa_ensure_value PIPELINE_WORKER_CONCURRENCY 1
  private_qa_ensure_value PIPELINE_WORKER_POLL_SECONDS 1
  private_qa_ensure_value PIPELINE_WORKER_LEASE_SECONDS 60
  private_qa_ensure_value PIPELINE_JOB_MAX_ATTEMPTS 3
  private_qa_ensure_value TECH_ARTICLE_PIPELINE_READ_TIMEOUT_MS 3000
  private_qa_ensure_value TECH_ARTICLE_PIPELINE_WRITE_TIMEOUT_MS 10000
  private_qa_ensure_value TECH_ARTICLE_AUTO_CRAWL_ENABLED false
  private_qa_ensure_value TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES 10
  private_qa_ensure_value TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS 48
  chmod 600 "$PRIVATE_QA_ENV_FILE"
}

private_qa_validate_env() {
  [[ -s "$PRIVATE_QA_ENV_FILE" ]] || {
    log_error "Missing $PRIVATE_QA_ENV_FILE. Run setup first. / Private QA 환경 파일이 없습니다."
    return 1
  }

  local key
  for key in PRIVATE_QA_BIND_ADDRESS PRIVATE_QA_HTTP_PORT JWT_SECRET PIPELINE_SERVICE_TOKEN \
    POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB TECH_ARTICLE_MYSQL_DATABASE \
    TECH_ARTICLE_MYSQL_USER TECH_ARTICLE_MYSQL_PASSWORD TECH_ARTICLE_MYSQL_ROOT_PASSWORD \
    ADMIN_USERNAME ADMIN_EMAIL ADMIN_PASSWORD GEMINI_MODEL CRAWLER_PUBLIC_URL CRAWLER_CONTACT; do
    cicd_env_has_nonempty "$PRIVATE_QA_ENV_FILE" "$key" || {
      log_error "Missing private QA setting: $key / 필수 설정이 없습니다."
      return 1
    }
  done
  private_qa_validate_port "$(cicd_env_get "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT)" || {
    log_error "PRIVATE_QA_HTTP_PORT must be between 1024 and 65535."
    return 1
  }
  local gemini_key
  gemini_key="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" GEMINI_API_KEY 2>/dev/null || true)"
  [[ -z "$gemini_key" || "$gemini_key" =~ ^[A-Za-z0-9._-]+$ ]] || {
    log_error "GEMINI_API_KEY contains unsupported environment-file characters."
    return 1
  }
  local auto_crawl_enabled auto_crawl_max_articles auto_crawl_max_age_hours
  auto_crawl_enabled="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" TECH_ARTICLE_AUTO_CRAWL_ENABLED 2>/dev/null || printf false)"
  auto_crawl_max_articles="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES 2>/dev/null || printf 10)"
  auto_crawl_max_age_hours="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS 2>/dev/null || printf 48)"
  [[ "$auto_crawl_enabled" == "true" || "$auto_crawl_enabled" == "false" ]] || {
    log_error "TECH_ARTICLE_AUTO_CRAWL_ENABLED must be true or false."
    return 1
  }
  [[ "$auto_crawl_max_articles" =~ ^[0-9]+$ ]] \
    && (( auto_crawl_max_articles >= 1 && auto_crawl_max_articles <= 100 )) || {
      log_error "TECH_ARTICLE_AUTO_CRAWL_MAX_ARTICLES must be between 1 and 100."
      return 1
    }
  [[ "$auto_crawl_max_age_hours" =~ ^[0-9]+$ ]] \
    && (( auto_crawl_max_age_hours >= 1 )) || {
      log_error "TECH_ARTICLE_AUTO_CRAWL_MAX_AGE_HOURS must be positive."
      return 1
    }
  log_success "🔐 Isolated Private QA configuration is valid. / 격리된 QA 설정을 확인했습니다."
}

private_qa_container_id() {
  private_qa_compose ps -a -q "$1" | tail -n 1
}

private_qa_wait_service() {
  local service="$1" expected="${2:-healthy}" timeout="${3:-240}"
  local started now container_id state
  log_info "⏳ Waiting for '$service' → '$expected' (timeout ${timeout}s). / 서비스 상태를 기다립니다."
  started="$(date +%s)"
  while true; do
    container_id="$(private_qa_container_id "$service")"
    if [[ -n "$container_id" ]]; then
      if [[ "$expected" == "exited" ]]; then
        state="$(private_qa_docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$container_id" 2>/dev/null || true)"
        if [[ "$state" == "exited:0" ]]; then
          log_success "🟢 '$service' completed successfully. / 정상 종료되었습니다."
          return 0
        fi
        if [[ "$state" == exited:* && "$state" != "exited:0" ]]; then
          log_error "'$service' failed with $state. / 일회성 작업이 실패했습니다."
          private_qa_compose logs --tail=100 "$service" || true
          return 1
        fi
      else
        state="$(private_qa_docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
        if [[ "$state" == "$expected" ]]; then
          log_success "🟢 '$service' is '$expected'. / 서비스 상태가 정상입니다."
          return 0
        fi
        if [[ "$state" == "unhealthy" || "$state" == "exited" || "$state" == "dead" ]]; then
          log_error "'$service' entered state '$state'. / 서비스가 비정상 상태입니다."
          private_qa_compose logs --tail=100 "$service" || true
          return 1
        fi
      fi
    fi
    now="$(date +%s)"
    if (( now - started >= timeout )); then
      log_error "Timed out waiting for '$service'. / 서비스 대기 시간이 초과되었습니다."
      private_qa_compose logs --tail=100 "$service" || true
      return 1
    fi
    sleep 3
  done
}

private_qa_run_one_shot() {
  local service="$1"
  private_qa_compose up -d --no-deps --force-recreate "$service"
  private_qa_wait_service "$service" exited 240
}

private_qa_check_health() {
  private_qa_validate_env
  local service
  for service in postgres pipeline-mysql tech-article-pipeline api web reverse-proxy; do
    private_qa_wait_service "$service" healthy 60
  done
  for service in pipeline-migrate api-migrate api-seed; do
    private_qa_wait_service "$service" exited 30
  done

  local port base_url spa_body
  port="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT)"
  base_url="http://127.0.0.1:$port"
  log_info "🔗 Checking public tags through the HTTP proxy... / 공개 태그 API를 확인합니다."
  curl --fail --silent --show-error --max-time 10 --output /dev/null \
    "$base_url/api/v1/tech-articles/tags"
  spa_body="$(mktemp)"
  if ! curl --fail --silent --show-error --max-time 10 \
    "$base_url/tech-articles" --output "$spa_body" \
    || ! grep -qi '<!doctype html\|<html' "$spa_body"; then
    rm -f "$spa_body"
    log_error "The /tech-articles route is not a valid SPA response. / 화면 경로 점검에 실패했습니다."
    return 1
  fi
  rm -f "$spa_body"
  log_success "🎉 Private QA containers, API-pipeline integration, and SPA are healthy. / 전체 QA 경로가 정상입니다."
}

private_qa_deploy() {
  local rebuild="${1:-1}"
  private_qa_validate_env

  if [[ "$rebuild" == "1" ]]; then
    cicd_print_step 1 7 "📦" "Build API, pipeline, and frontend images / 새 이미지 빌드"
    private_qa_compose build --pull api tech-article-pipeline web
  else
    cicd_print_step 1 7 "📦" "Reuse existing local images / 기존 로컬 이미지 사용"
  fi

  cicd_print_step 2 7 "🗄️" "Start isolated empty databases / 격리된 QA 데이터베이스 준비"
  private_qa_compose up -d postgres pipeline-mysql
  private_qa_wait_service postgres healthy 240
  private_qa_wait_service pipeline-mysql healthy 240

  log_info "⏸️  Stopping data writers before migrations... / 마이그레이션 전 쓰기 서비스를 중지합니다."
  private_qa_compose stop api tech-article-pipeline >/dev/null 2>&1 || true

  cicd_print_step 3 7 "🐬" "Run checksum-verified pipeline MySQL migrations / pipeline MySQL 마이그레이션"
  private_qa_run_one_shot pipeline-migrate

  cicd_print_step 4 7 "🐘" "Run PostgreSQL migrations and administrator seed / PostgreSQL 마이그레이션·관리자 생성"
  private_qa_run_one_shot api-migrate
  private_qa_run_one_shot api-seed

  cicd_print_step 5 7 "📰" "Start technical-article pipeline / 기술 아티클 파이프라인 기동"
  private_qa_compose up -d --no-deps --force-recreate tech-article-pipeline
  private_qa_wait_service tech-article-pipeline healthy 240

  cicd_print_step 6 7 "⚙️" "Activate API, frontend, and HTTP proxy / API·프론트엔드·HTTP 프록시 활성화"
  private_qa_compose up -d --no-deps --force-recreate api web
  private_qa_wait_service api healthy 240
  private_qa_wait_service web healthy 120
  private_qa_compose up -d --no-deps --force-recreate reverse-proxy
  private_qa_wait_service reverse-proxy healthy 120

  cicd_print_step 7 7 "🩺" "Run end-to-end QA health checks / 전체 QA 경로 점검"
  private_qa_check_health
}

private_qa_show_access() {
  local port lan_ips
  port="$(cicd_env_get "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT)"
  lan_ips="$(hostname -I 2>/dev/null | xargs 2>/dev/null || true)"
  cicd_print_section "🌐" "QA access information / QA 접속 정보"
  printf '%s\n' "   Local / 로컬: http://127.0.0.1:$port/tech-articles"
  if [[ -n "$lan_ips" ]]; then
    printf '%s\n' "   LAN addresses / 내부 IP 후보: $lan_ips"
    printf '%s\n' "   Router / 공유기: 외부 포트를 이 PC의 <LAN-IP>:$port 로 전달하세요."
  fi
  printf '%s\n' "   Admin username / 관리자 아이디: $(cicd_env_get "$PRIVATE_QA_ENV_FILE" ADMIN_USERNAME)"
  printf '%s\n' "   Admin password / 관리자 비밀번호: [hidden; setup 때 입력한 값 / 숨김]"
  printf '%s\n' "   ⚠️  HTTP plaintext only. QA가 끝나면 포트포워딩을 즉시 제거하세요."
}

private_qa_pull_latest() {
  cicd_require_commands git
  cd "$PRIVATE_QA_PROJECT_ROOT"
  if [[ -n "$(git status --porcelain)" && "${PRIVATE_QA_ALLOW_DIRTY:-0}" != "1" ]]; then
    log_error "The worktree has local changes. Commit/stash them before update. / 로컬 변경사항을 먼저 정리하세요."
    git status --short
    return 1
  fi
  log_info "🔍 Fetching the configured upstream branch... / 원격 브랜치를 확인합니다."
  git fetch --prune origin
  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  [[ -n "$upstream" ]] || upstream="origin/main"
  git merge-base --is-ancestor HEAD "$upstream" || {
    log_error "The branch cannot be fast-forwarded safely. / fast-forward할 수 없는 브랜치 상태입니다."
    return 1
  }
  git pull --ff-only
  log_success "📦 Latest source is ready. / 최신 소스 코드를 준비했습니다."
}

private_qa_recreate_services() {
  local service
  for service in "$@"; do
    private_qa_compose up -d --no-deps --force-recreate "$service"
    private_qa_wait_service "$service" healthy 240
  done
}

private_qa_update_config() {
  local setting="$1" rollback_file value crawler_url crawler_contact
  local -a services=()
  private_qa_validate_env
  rollback_file="$(mktemp)"
  cp -p "$PRIVATE_QA_ENV_FILE" "$rollback_file"

  case "$setting" in
    gemini-key)
      read -r -s -p "🤖 New Gemini API key (Enter to disable) / 새 Gemini API 키: " value
      printf '\n'
      [[ -z "$value" || "$value" =~ ^[A-Za-z0-9._-]+$ ]] || {
        rm -f "$rollback_file"
        log_error "Gemini API key contains unsupported environment-file characters. / API 키 형식을 확인하세요."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" GEMINI_API_KEY "$value"
      services=(tech-article-pipeline)
      ;;
    gemini-model)
      read -r -p "🤖 New Gemini model / 새 Gemini 모델: " value
      [[ "$value" =~ ^[A-Za-z0-9._-]+$ ]] || {
        rm -f "$rollback_file"
        log_error "Gemini model contains unsupported characters. / Gemini 모델 형식을 확인하세요."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" GEMINI_MODEL "$value"
      services=(tech-article-pipeline)
      ;;
    crawler-identity)
      read -r -p "🌍 Crawler public URL / 크롤러 공개 URL: " crawler_url
      read -r -p "📧 Crawler contact email / 크롤러 연락 이메일: " crawler_contact
      [[ "$crawler_url" =~ ^https?://[^[:space:]]+$ ]] || {
        rm -f "$rollback_file"
        log_error "Crawler public URL must be HTTP(S)."
        return 2
      }
      [[ "$crawler_contact" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || {
        rm -f "$rollback_file"
        log_error "Crawler contact must be an email address."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" CRAWLER_PUBLIC_URL "$crawler_url"
      cicd_env_set "$PRIVATE_QA_ENV_FILE" CRAWLER_CONTACT "$crawler_contact"
      services=(tech-article-pipeline)
      ;;
    auto-crawl)
      read -r -p "🕒 Enable automatic article crawling? [true/false] / 자동 수집 활성화 여부: " value
      [[ "$value" == "true" || "$value" == "false" ]] || {
        rm -f "$rollback_file"
        log_error "Automatic crawling must be true or false. / 자동 수집 값은 true 또는 false여야 합니다."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" TECH_ARTICLE_AUTO_CRAWL_ENABLED "$value"
      services=(api)
      ;;
    service-token)
      read -r -s -p "🔐 New service token (Enter: generate securely) / 새 내부 토큰: " value
      printf '\n'
      value="${value:-$(cicd_generate_hex 32)}"
      [[ "$value" =~ ^[A-Za-z0-9._-]{32,255}$ ]] || {
        rm -f "$rollback_file"
        log_error "Service token must be 32+ safe characters. / 내부 토큰 형식을 확인하세요."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" PIPELINE_SERVICE_TOKEN "$value"
      services=(tech-article-pipeline api)
      ;;
    http-port)
      read -r -p "🌐 New host HTTP port / 새 호스트 HTTP 포트: " value
      private_qa_validate_port "$value" || {
        rm -f "$rollback_file"
        log_error "HTTP port must be between 1024 and 65535."
        return 2
      }
      cicd_env_set "$PRIVATE_QA_ENV_FILE" PRIVATE_QA_HTTP_PORT "$value"
      services=(reverse-proxy)
      ;;
    *)
      rm -f "$rollback_file"
      log_error "Config usage: bash private_qa.sh config [gemini-key|gemini-model|crawler-identity|auto-crawl|service-token|http-port]"
      return 2
      ;;
  esac
  chmod 600 "$PRIVATE_QA_ENV_FILE"

  log_info "♻️  Recreating only affected services... / 영향받는 서비스만 재생성합니다."
  if private_qa_recreate_services "${services[@]}" && private_qa_check_health; then
    rm -f "$rollback_file"
    log_success "🎉 '$setting' was updated; unrelated environment bytes were preserved. / 선택한 설정만 변경했습니다."
    return 0
  fi

  log_warn "🧯 Readiness failed; restoring the exact previous environment file. / 이전 설정을 복구합니다."
  cp -p "$rollback_file" "$PRIVATE_QA_ENV_FILE"
  rm -f "$rollback_file"
  private_qa_recreate_services "${services[@]}" || true
  log_error "Configuration update failed and was rolled back. / 설정 변경에 실패해 이전 값으로 복구했습니다."
  return 1
}
