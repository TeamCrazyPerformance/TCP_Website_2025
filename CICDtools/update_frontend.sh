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

# ==============================================================================
# 📝 Execution Logging
# ==============================================================================
LOG_DIR="$PROJECT_ROOT/CICDtools/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/execution_$(date +%Y-%m-%d).log"
CURRENT_USER=$(whoami)
SCRIPT_NAME=$(basename "$0")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] User: $CURRENT_USER | Script: $SCRIPT_NAME | Action: STARTED" >> "$LOG_FILE"

# Delete logs older than 30 days
find "$LOG_DIR" -name "execution_*.log" -mtime +30 -delete

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                           🎨 Frontend Update Tool                            "
echo "=============================================================================="
echo "� What is this?"
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


# 0. Backup DB (Safety First)
echo "💾 Creating Pre-Update Backup..."
bash "$PROJECT_ROOT/CICDtools/backup_db.sh" "pre_frontend_update"

# 1. Pull latest code
echo "📥 Pulling latest code from main..."
cd "$PROJECT_ROOT"
git pull origin main

# 2. Install dependencies and Build
echo "📦 Installing dependencies and building frontend..."
cd "$WEB_DIR"
npm install
npm run build

echo "========================================"
echo "✅ Frontend update completed!"
echo "🌐 Verify at your website URL."
echo "========================================"
