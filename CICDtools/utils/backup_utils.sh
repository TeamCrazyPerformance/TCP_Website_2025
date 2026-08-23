#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${TCP_CICD_BACKUP_LOADED:-}" ]]; then
  return 0
fi
readonly TCP_CICD_BACKUP_LOADED=1

# shellcheck source=runtime.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/runtime.sh"

readonly CICD_BACKUP_ROOT="${CICD_BACKUP_ROOT_OVERRIDE:-$CICD_PROJECT_ROOT/../backups}"

cicd_latest_backup_set() {
  [[ -d "$CICD_BACKUP_ROOT" ]] || return 1
  find "$CICD_BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '.tmp.*' -printf '%f\n' | sort | tail -n 1
}

cicd_resolve_backup_set() {
  local requested="${1:-}"
  if [[ -z "$requested" ]]; then
    requested="$(cicd_latest_backup_set)" || return 1
  fi

  local candidate
  if [[ "$requested" == */* ]]; then
    candidate="$(realpath "$requested")"
  else
    candidate="$(realpath "$CICD_BACKUP_ROOT/$requested")"
  fi
  local root
  root="$(realpath "$CICD_BACKUP_ROOT")"
  [[ "$candidate" == "$root"/* && -d "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}

cicd_verify_backup_set() {
  local set_dir="$1"
  [[ -s "$set_dir/metadata" && -s "$set_dir/SHA256SUMS" ]] || {
    log_error "Backup metadata or SHA256SUMS is missing."
    return 1
  }
  (cd "$set_dir" && sha256sum --check --strict SHA256SUMS)
  gzip -t "$set_dir/postgres.sql.gz"
  if grep -q '^pipeline_mysql=OK$' "$set_dir/metadata"; then
    gzip -t "$set_dir/pipeline-mysql.sql.gz"
  elif ! grep -q '^pipeline_mysql=NOT_PRESENT$' "$set_dir/metadata"; then
    log_error "Backup has an invalid pipeline_mysql metadata state."
    return 1
  fi
  tar -tzf "$set_dir/files.tar.gz" >/dev/null
}

cicd_resolve_legacy_postgres_backup() {
  local requested="${1:-}"
  if [[ -z "$requested" ]]; then
    find "$CICD_BACKUP_ROOT" -maxdepth 1 -type f -name 'db_backup_*.sql.gz' -print | sort | tail -n 1
    return
  fi
  local candidate
  candidate="$(realpath "$requested")"
  local root
  root="$(realpath "$CICD_BACKUP_ROOT")"
  [[ "$candidate" == "$root"/* && -f "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}
