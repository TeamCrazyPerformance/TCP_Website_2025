#!/bin/bash
set -e

# ==============================================================================
# Backend Update Script
# ==============================================================================
# Description:
#   Pulls the latest code, rebuilds the 'api' container, and restarts it.
#   This minimizes downtime to just the API container restart time.
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."
REPO_URL="https://github.com/TeamCrazyPerformance/TCP_Website_2025"


# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                           ⚙️  Backend Update Tool                            "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Pulls the latest code from the 'main' branch."
echo "   - 'main' 브랜치에서 최신 코드를 가져옵니다."
echo "   - Rebuilds the 'api' Docker image and recrates the container."
echo "   - 'api' Docker 이미지를 다시 빌드하고 컨테이너를 재생성합니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - When you have updated backend code (NestJS, API logic, DTOs)."
echo "   - 백엔드 코드(NestJS, API 로직, DTO 등)를 업데이트했을 때 사용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - The 'api' container will be restarted."
echo "   - 'api' 컨테이너가 재시작됩니다."
echo "   - ⚠️  SHORT DOWNTIME (1~5 seconds) during restart."
echo "   - ⚠️  재시작하는 동안 짧은 중단(1~5초)이 발생할 수 있습니다."
echo "   - Existing DB connections might be dropped temporarily."
echo "   - 기존 DB 연결이 일시적으로 끊길 수 있습니다."
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
setup_logging "backend_update"

# 0. Backup DB (Safety First)
log_info "💾 Creating Pre-Update Backup..."
bash "$PROJECT_ROOT/CICDtools/backup_db.sh" "pre_backend_update"

# 1. Pull latest code
log_info "📥 Pulling latest code from main..."
cd "$PROJECT_ROOT"
git_as_user pull origin main

# 2. Rebuild API Container
log_info "🐳 Rebuilding API container..."
sudo docker compose build api

# 3. Restart API Container (No Deps)
log_info "🔄 Restarting API container..."
sudo docker compose up -d --no-deps api

# 4. Cleanup Unused Images (Optional)
log_info "🧹 Cleaning up old images..."
sudo docker image prune -f

log_success "backend update completed!"
