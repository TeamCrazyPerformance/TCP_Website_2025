#!/bin/bash

# ==============================================================================
# Git Utility Module
# ==============================================================================
# Usage:
#   source "$(dirname "$0")/git_utils.sh"
#   check_git_status
# ==============================================================================

# Ensure common logging is loaded
# If common_logging.sh is in the same directory as this script
if [ -f "$(dirname "$0")/common_logging.sh" ]; then
    source "$(dirname "$0")/common_logging.sh"
fi

check_git_status() {
    log_info "🔍 Checking git status and remote updates..."

    # 1. Fetch latest changes from remote (without merging)
    log_info "📡 Fetching origin..."
    git fetch origin main

    # 2. Check for uncommitted local changes
    if [ -n "$(git status --porcelain)" ]; then
        log_warn "⚠️  Uncommitted local changes detected:"
        git status --short
        echo ""
        log_warn "These changes might cause conflicts during pull."
        read -p "❓ Do you want to proceed anyway? (y/n): " CONFIRM -r
        if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
            log_error "🚫 Operation cancelled by user due to local changes."
            exit 1
        fi
    else
        log_success "✅ Working directory is clean."
    fi

    # 3. Check for divergence (commits on both local and remote)
    # Get the count of commits: local_ahead...remote_ahead
    # HEAD...@{u} checks the current branch against its upstream
    local UPSTREAM="origin/main"
    local LOCAL="HEAD"
    
    # Check if upstream is set, if not fallback to origin/main explicit
    if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} > /dev/null 2>&1; then
       # If no upstream configured, assume tracking origin/main for safety check
       UPSTREAM="origin/main"
    else
       UPSTREAM="@{u}"
    fi

    # Left: Local, Right: Remote
    local COUNTS=$(git rev-list --left-right --count $UPSTREAM...$LOCAL)
    local BEHIND=$(echo $COUNTS | awk '{print $1}')
    local AHEAD=$(echo $COUNTS | awk '{print $2}')

    if [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -gt 0 ]; then
        log_error "🚨 DIVERGED BRANCH DETECTED!"
        log_warn "   - You have $AHEAD local commit(s)."
        log_warn "   - Origin has $BEHIND new commit(s)."
        log_warn "⚠️  'git pull' will likely produce a MERGE COMMIT or CONFLICT."
        
        read -p "❓ Do you want to proceed? (y/n): " CONFIRM -r
        if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
            log_error "🚫 Operation cancelled to avoid conflict."
            exit 1
        fi
    elif [ "$AHEAD" -gt 0 ]; then
        log_warn "⚠️  You are ahead of origin by $AHEAD commit(s)."
        log_info "   - 'git pull' is safe, but you should push your changes later."
    elif [ "$BEHIND" -gt 0 ]; then
        log_info "⬇️  You are behind origin by $BEHIND commit(s)."
        log_success "✅ 'git pull' will be a fast-forward update."
    else
        log_success "✅ Your branch is up to date with origin."
    fi
}
