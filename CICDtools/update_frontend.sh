#!/bin/bash
set -e

# ==============================================================================
# Frontend Update Script
# ==============================================================================
# Description:
#   Pulls the latest code from the 'main' branch and rebuilds the frontend.
#   Since Nginx serves static files from a volume, no container restart is needed.
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."
WEB_DIR="$PROJECT_ROOT/web"
REPO_URL="https://github.com/TeamCrazyPerformance/TCP_Website_2025"

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Wrapper to run npm as the original user if sudo is used
npm_as_user() {
    if [ -n "$SUDO_USER" ]; then
        sudo -u "$SUDO_USER" npm "$@"
    else
        npm "$@"
    fi
}

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                           🎨 Frontend Update Tool                            "
echo "=============================================================================="
echo " What is this?"
echo "   - Pulls the latest code from the 'main' branch."
echo "   - Reinstalls dependencies (npm install) and rebuilds the React app."
echo ""
echo "🕒 When to use?"
echo "   - When you have updated frontend code (React, CSS, Assets)."
echo ""
echo "💥 What happens next?"
echo "   - The 'web/dist' folder will be updated."
echo "   - Users will see the changes immediately upon refresh."
echo "   - 🟢 NO DOWNTIME expected."
echo "=============================================================================="
read -p "❓ Do you want to proceed? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

# Import Git Utils
source "$(dirname "$0")/utils/git_utils.sh"

# 🔒 Pre-flight Safety Check
check_git_status

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "frontend_update"

# 0. Backup DB (Safety First)
log_info "📥 Pulling latest code from main..."
cd "$PROJECT_ROOT"
git_as_user pull origin main

# 2. Install dependencies & Build (Zero-Downtime Strategy)
log_info "📦 Installing dependencies..."
cd "$WEB_DIR"
npm_as_user install

log_info "🏗️  Building frontend to temporary directory (dist_temp)..."
# Build to a temporary directory first to prevent downtime
# We use 'npm exec' to run the project's local react-scripts
export BUILD_PATH=dist_temp
if npm_as_user exec -- react-scripts build; then
    log_success "✅ Build successful!"
    
    log_info "🔄 Swapping new build with live version..."
    # Atomic swap: Remove old dist and move new dist in place
    rm -rf dist
    mv dist_temp dist
    
    log_success "Frontend update completed successfully!"
    log_info "🌐 Verify at your website URL."

else
    log_error "❌ Build FAILED!"
    log_warn "⚠️  The live website was NOT affected."
    log_info "🧹 Cleaning up temporary files..."
    rm -rf dist_temp
    exit 1
fi
