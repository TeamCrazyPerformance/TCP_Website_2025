#!/usr/bin/env bash
set -Eeuo pipefail

# Shared runtime for every operational script. This file is intentionally safe
# to source more than once.
if [[ -n "${TCP_CICD_RUNTIME_LOADED:-}" ]]; then
  return 0
fi
readonly TCP_CICD_RUNTIME_LOADED=1

CICD_UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly CICD_UTILS_DIR
CICD_PROJECT_ROOT="${CICD_PROJECT_ROOT_OVERRIDE:-$(cd "$CICD_UTILS_DIR/../.." && pwd)}"
readonly CICD_PROJECT_ROOT
readonly CICD_COMPOSE_PROFILE="tech-articles"

if ! declare -F log_info >/dev/null 2>&1; then
  # shellcheck source=common_logging.sh
  source "$CICD_UTILS_DIR/common_logging.sh"
fi

cicd_require_commands() {
  local command_name
  for command_name in "$@"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      log_error "Required command is not installed: $command_name / 필수 명령어가 설치되어 있지 않습니다."
      return 127
    fi
  done
}

cicd_as_root() {
  if [[ "${CICD_NO_SUDO:-0}" == "1" || "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

cicd_docker() {
  cicd_as_root docker "$@"
}

cicd_compose() {
  local -a compose_files=()
  if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
    compose_files=(-f docker-compose.yml -f docker-compose.dev.yml)
  fi
  (
    cd "$CICD_PROJECT_ROOT" || exit 1
    cicd_docker compose "${compose_files[@]}" --profile "$CICD_COMPOSE_PROFILE" "$@"
  )
}

# Prompts must end with a newline because setup_logging routes stderr through
# sed/tee. Bash's `read -p` emits no newline, so sed waits for more input and
# the operator sees the prompt only after already typing an answer.
cicd_read_prompt() {
  local variable_name="$1" prompt="$2" input
  printf '%s\n' "$prompt" >&2
  IFS= read -r input || return 1
  printf -v "$variable_name" '%s' "$input"
}

cicd_read_secret_prompt() {
  local variable_name="$1" prompt="$2" input
  printf '%s\n' "$prompt" >&2
  IFS= read -r -s input || return 1
  printf '\n' >&2
  printf -v "$variable_name" '%s' "$input"
}

cicd_confirm() {
  local prompt="${1:-Continue?}"
  if [[ "${CICD_ASSUME_YES:-0}" == "1" ]]; then
    return 0
  fi
  local answer
  cicd_read_prompt answer "❓ $prompt [y/N] / 계속하시겠습니까? [y/N]:"
  [[ "$answer" =~ ^[Yy]$ ]]
}

cicd_confirm_dangerous_action() {
  local action_word="$1" warning_en="$2" warning_ko="$3"
  if [[ "${CICD_ASSUME_YES:-0}" == "1" ]]; then
    return 0
  fi

  local answer phrase final_answer
  cicd_read_prompt answer "❓ [1/3] Do you want to proceed? / 진행하시겠습니까? [y/N]:"
  [[ "$answer" =~ ^[Yy]$ ]] || return 1

  printf '\n'
  log_warn "$warning_en"
  log_warn "$warning_ko"
  cicd_read_prompt phrase "❓ [2/3] Type '$action_word' to continue / 계속하려면 '$action_word' 입력:"
  [[ "$phrase" == "$action_word" ]] || return 1

  printf '\n'
  log_warn "Final confirmation: this operation may be difficult to undo."
  log_warn "마지막 확인: 이 작업은 되돌리기 어렵거나 불가능할 수 있습니다."
  cicd_read_prompt final_answer "❓ [3/3] Type 'YES' to execute / 실행하려면 'YES' 입력:"
  [[ "$final_answer" == "YES" ]]
}

cicd_env_get() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  awk -v prefix="$key=" 'index($0, prefix) == 1 { print substr($0, length(prefix) + 1); found=1; exit } END { if (!found) exit 1 }' "$file"
}

cicd_env_has_nonempty() {
  local value
  value="$(cicd_env_get "$1" "$2" 2>/dev/null || true)"
  [[ -n "$value" ]]
}

cicd_env_has_key() {
  cicd_env_get "$1" "$2" >/dev/null 2>&1
}

cicd_env_set() {
  local file="$1" key="$2" value="$3"
  if [[ "$key" == *$'\n'* || "$key" == *$'\r'* || "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    log_error "Environment keys and values must be single-line."
    return 2
  fi

  mkdir -p "$(dirname "$file")"
  [[ -f "$file" ]] || : >"$file"
  local temp_file
  temp_file="$(mktemp "${file}.tmp.XXXXXX")"
  awk -v prefix="$key=" -v replacement="$key=$value" '
    index($0, prefix) == 1 {
      if (!written) print replacement
      written=1
      next
    }
    { print }
    END { if (!written) print replacement }
  ' "$file" >"$temp_file"
  chmod 600 "$temp_file"
  mv -f "$temp_file" "$file"
}

cicd_generate_hex() {
  local bytes="${1:-32}"
  openssl rand -hex "$bytes"
}

cicd_validate_env_files() {
  local file
  for file in "$CICD_PROJECT_ROOT/.env" \
              "$CICD_PROJECT_ROOT/envs/api.env" \
              "$CICD_PROJECT_ROOT/envs/elk.env"; do
    if [[ ! -s "$file" ]]; then
      log_error "Missing required environment file: $file"
      return 1
    fi
  done

  local db_env="$CICD_PROJECT_ROOT/envs/db_prod.env"
  if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
    db_env="$CICD_PROJECT_ROOT/envs/db_dev.env"
  fi
  [[ -s "$db_env" ]] || { log_error "Missing required environment file: $db_env"; return 1; }

  local key
  for key in PIPELINE_SERVICE_TOKEN TECH_ARTICLE_MYSQL_PASSWORD TECH_ARTICLE_MYSQL_ROOT_PASSWORD; do
    cicd_env_has_nonempty "$CICD_PROJECT_ROOT/.env" "$key" || {
      log_error "Missing required root .env value: $key"
      return 1
    }
  done
  for key in CRAWLER_PUBLIC_URL CRAWLER_CONTACT; do
    cicd_env_has_nonempty "$CICD_PROJECT_ROOT/.env" "$key" || {
      log_error "Missing required root .env value: $key"
      return 1
    }
  done
  if [[ "${CICD_ENVIRONMENT:-prod}" == "prod" ]] && ! cicd_env_has_nonempty "$CICD_PROJECT_ROOT/.env" GEMINI_API_KEY; then
    log_error "GEMINI_API_KEY is required in production."
    return 1
  fi
  log_success "Required environment files and secret placeholders are ready. / 필수 환경 파일과 시크릿 설정을 확인했습니다."
}

cicd_service_container_id() {
  cicd_compose ps -a -q "$1" | tail -n 1
}

cicd_wait_service() {
  local service="$1" expected="${2:-healthy}" timeout="${3:-180}"
  local started now container_id status
  log_info "⏳ Waiting for '$service' to become '$expected' (timeout: ${timeout}s). / '$service' 상태를 기다립니다."
  started="$(date +%s)"
  while true; do
    container_id="$(cicd_service_container_id "$service")"
    if [[ -n "$container_id" ]]; then
      if [[ "$expected" == "exited" ]]; then
        status="$(cicd_docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' "$container_id" 2>/dev/null || true)"
        if [[ "$status" == "exited:0" ]]; then
          log_success "🟢 '$service' completed successfully. / '$service' 작업이 정상 종료되었습니다."
          return 0
        fi
        if [[ "$status" == exited:* && "$status" != "exited:0" ]]; then
          log_error "$service exited unsuccessfully ($status)."
          cicd_compose logs --tail=80 "$service" || true
          return 1
        fi
      else
        status="$(cicd_docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
        if [[ "$status" == "$expected" ]]; then
          log_success "🟢 '$service' is '$expected'. / '$service' 상태가 정상입니다."
          return 0
        fi
        if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
          log_error "$service entered state: $status"
          cicd_compose logs --tail=80 "$service" || true
          return 1
        fi
      fi
    fi

    now="$(date +%s)"
    if (( now - started >= timeout )); then
      log_error "Timed out waiting for $service to become $expected."
      cicd_compose logs --tail=80 "$service" || true
      return 1
    fi
    sleep 3
  done
}

cicd_http_check() {
  local url="$1" label="${2:-$1}"
  shift 2 || true
  if ! curl --fail --silent --show-error --max-time 10 --output /dev/null "$@" "$url"; then
    log_error "HTTP health check failed: $label"
    return 1
  fi
}

cicd_require_production_ssl() {
  [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]] && return 0
  local cert="$CICD_PROJECT_ROOT/reverse-proxy/certs/origin.crt"
  local key="$CICD_PROJECT_ROOT/reverse-proxy/certs/origin.key"
  if [[ ! -s "$cert" || ! -s "$key" ]]; then
    log_error "Production SSL files must be injected before setup: origin.crt and origin.key"
    return 1
  fi
  log_success "🔒 Production SSL certificate files are present. / 운영 SSL 인증서 파일을 확인했습니다."
}

cicd_safe_remove_tree() {
  local target="$1" allowed_parent="$2"
  local resolved_target resolved_parent
  resolved_target="$(realpath "$target")"
  resolved_parent="$(realpath "$allowed_parent")"
  if [[ "$resolved_target" == "$resolved_parent" || "$resolved_target" != "$resolved_parent"/* ]]; then
    log_error "Refusing to remove path outside the expected parent: $resolved_target"
    return 1
  fi
  rm -rf -- "$resolved_target"
}
