#!/bin/bash
set -e

# ==============================================================================
# Update All Services Script
# ==============================================================================
# Description:
#   Sequentially updates Frontend, runs Migrations, and updates Backend.
# ==============================================================================

SCRIPT_DIR="$(dirname "$0")"

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                        🌍 Full Stack Update Tool                             "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Sequentially runs: Frontend Update -> DB Migration -> Backend Update."
echo "   - 순차적으로 실행합니다: 프론트엔드 업데이트 -> DB 마이그레이션 -> 백엔드 업데이트."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - When you want to sync the entire server with the latest 'main' branch."
echo "   - 서버 전체를 최신 'main' 브랜치와 동기화하고 싶을 때 사용합니다."
echo "   - Useful for major releases or full system updates."
echo "   - 메이저 배포나 전체 시스템 업데이트 시 유용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - 1. Frontend updated (No downtime)"
echo "   - 1. 프론트엔드 업데이트 (중단 없음)"
echo "   - 2. DB Schema updated (No downtime)"
echo "   - 2. DB 스키마 업데이트 (중단 없음)"
echo "   - 3. Backend restarted (⚠️ SHORT DOWNTIME ~5s)"
echo "   - 3. 백엔드 재시작 (⚠️ 약 5초간 짧은 중단)"
echo "   - Note: You will be asked to confirm each step individually as well."
echo "   - 참고: 각 단계별로도 실행 여부를 다시 한 번 물어볼 것입니다."
echo "=============================================================================="
read -p "❓ Do you want to proceed? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "full_stack_update"

# 1. Update Frontend
log_info ">>> [1/3] Updating Frontend..."
if [ -n "$SUDO_USER" ]; then
    sudo -u "$SUDO_USER" bash "$SCRIPT_DIR/update_frontend.sh"
else
    bash "$SCRIPT_DIR/update_frontend.sh"
fi

# 2. Update Backend (Get new code & migrations into container)
log_info ">>> [2/3] Updating Backend..."
bash "$SCRIPT_DIR/update_backend.sh"

# 3. Run Migrations (Now that container has new code)
log_info ">>> [3/3] Running Database Migrations..."
bash "$SCRIPT_DIR/migrate_db.sh"

log_success "Full Stack update completed!"
