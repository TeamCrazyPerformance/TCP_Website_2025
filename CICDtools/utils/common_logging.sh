#!/usr/bin/env bash
set -Eeuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

timestamp() {
  date '+%Y-%m-%d %H:%M:%S'
}

log_info() {
  printf '%b\n' "${BLUE}[$(timestamp)] [INFO] ℹ️  $*${NC}"
}

log_success() {
  printf '%b\n' "${GREEN}[$(timestamp)] [SUCCESS] ✅ $*${NC}"
}

log_warn() {
  printf '%b\n' "${YELLOW}[$(timestamp)] [WARN] ⚠️  $*${NC}"
}

log_error() {
  printf '%b\n' "${RED}[$(timestamp)] [ERROR] ❌ $*${NC}" >&2
}

cicd_print_rule() {
  printf '%s\n' '=============================================================================='
}

cicd_print_banner() {
  local icon="$1" title="$2"
  shift 2
  printf '\n'
  cicd_print_rule
  printf '  %s  %s\n' "$icon" "$title"
  cicd_print_rule
  local line
  for line in "$@"; do printf '%s\n' "$line"; done
  cicd_print_rule
  printf '\n'
}

cicd_print_section() {
  local icon="$1" title="$2"
  printf '\n%s %s\n' "$icon" "$title"
  printf '%s\n' '------------------------------------------------------------------------------'
}

cicd_print_step() {
  local current="$1" total="$2" icon="$3"
  shift 3
  printf '\n%b\n' "${BLUE}▶ [$current/$total] $icon $*${NC}"
}

handle_exit() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    log_error "Script FAILED with exit code $exit_code. / 스크립트 실행에 실패했습니다."
  else
    log_success "✨ Script COMPLETED successfully. / 스크립트가 정상 완료되었습니다."
  fi
}

setup_logging() {
  local script_label="$1"
  local module_dir project_root log_dir log_file
  module_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_root="$(cd "$module_dir/../.." && pwd)"
  log_dir="$project_root/CICDtools/logs"
  mkdir -p "$log_dir"
  log_file="$log_dir/execution_$(date +%Y-%m-%d).log"

  if [[ -z "${CICD_LOGGING_ACTIVE:-}" ]]; then
    printf '%s\n' '--------------------------------------------------------------------------------' >>"$log_file"
    printf '[%s] STARTING %s (user: %s)\n' "$(timestamp)" "$script_label" "$(whoami)" >>"$log_file"
    export CICD_LOGGING_ACTIVE=true
    exec > >(sed -u 's/^/    /' | tee -a "$log_file") 2>&1
  else
    log_info "🔗 Starting child operation: $script_label / 하위 작업을 시작합니다."
  fi
  trap handle_exit EXIT
}
