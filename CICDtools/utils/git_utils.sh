#!/usr/bin/env bash
set -Eeuo pipefail

git_as_user() {
  if [[ -n "${SUDO_USER:-}" ]]; then
    sudo -u "$SUDO_USER" git "$@"
  else
    git "$@"
  fi
}

check_git_status() {
  log_info "🔍 Fetching the configured upstream branch... / 원격 브랜치 상태를 확인합니다."
  git_as_user fetch --prune origin

  if [[ -n "$(git_as_user status --porcelain)" && "${CICD_ALLOW_DIRTY:-0}" != "1" ]]; then
    log_error "The deployment worktree has uncommitted changes. Commit/stash them or set CICD_ALLOW_DIRTY=1 deliberately."
    git_as_user status --short
    return 1
  fi

  local upstream counts behind ahead
  upstream="$(git_as_user rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  [[ -n "$upstream" ]] || upstream="origin/main"
  counts="$(git_as_user rev-list --left-right --count "$upstream...HEAD")"
  behind="$(awk '{print $1}' <<<"$counts")"
  ahead="$(awk '{print $2}' <<<"$counts")"

  if (( ahead > 0 && behind > 0 )); then
    log_error "Local and upstream branches have diverged; automatic deployment requires a fast-forward."
    return 1
  fi
  log_success "🌿 Git status is safe for deployment: local ahead=$ahead, behind=$behind. / 배포 가능한 Git 상태입니다."
}

pull_latest_changes() {
  log_info "⬇️  Fast-forwarding the current branch... / 최신 코드를 안전하게 가져옵니다."
  git_as_user pull --ff-only
  log_success "📦 Latest upstream revision is ready. / 최신 소스 코드를 준비했습니다."
}
