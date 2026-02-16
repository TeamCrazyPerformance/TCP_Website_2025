#!/bin/bash
set -e

# ==============================================================================
# Database Migration Script
# ==============================================================================
# Description:
#   Pulls the latest code and runs TypeORM migrations via the running API container.
#   Zero downtime deployment if migrations are non-breaking.
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                           🐘 Database Migration Tool                         "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Pulls the latest code from 'main' (to get latest migration files)."
echo "   - 'main'에서 최신 코드를 가져옵니다 (최신 마이그레이션 파일 확보)."
echo "   - Runs 'npm run migration:run' inside the running API container."
echo "   - 실행 중인 API 컨테이너 내부에서 'npm run migration:run'을 실행합니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - When you have made changes to DB Entities or schema."
echo "   - DB 엔티티나 스키마(구조)를 변경했을 때 사용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - Database schema will be altered (CREATE TABLE, ALTER COLUMN, etc.)."
echo "   - 데이터베이스 스키마가 변경됩니다 (테이블 생성, 컬럼 변경 등)."
echo "   - 🟢 NO DOWNTIME expected (unless migration involves heavy table locking)."
echo "   - 🟢 서버 중단은 없습니다 (테이블 락이 걸리는 무거운 작업 제외)."
echo "=============================================================================="
# ------------------------------------------------------------------------------
# 🔒 Step 1: Basic Confirmation (y/n)
# ------------------------------------------------------------------------------
read -p "❓ [1/3] Do you want to proceed? (y/n) / 진행하시겠습니까? : " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 2: Intent Verification (Type 'MIGRATE')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  This operation will modify the database schema."
echo "⚠️  db 구조가 변경되는 작업입니다."
read -p "❓ [2/3] Please type 'MIGRATE' to continue / 'MIGRATE'를 입력하세요 : " CONFIRM_TEXT
if [[ "$CONFIRM_TEXT" != "MIGRATE" ]]; then
    echo "🚫 Operation cancelled (Text mismatch)."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 3: Final Safety Check (Type 'YES')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  Final Warning: Changes cannot be easily undone without feedback."
echo "⚠️  마지막 경고: 이 작업은 되돌리기 어려울 수 있습니다."
read -p "❓ [3/3] Type 'YES' to execute / 'YES'를 입력하여 실행하세요 : " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" != "YES" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

# Import Git Utils
source "$(dirname "$0")/utils/git_utils.sh"

# 🔒 Pre-flight Safety Check
check_git_status

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "db_migration"

# 0. Backup DB (Safety First)
log_info "💾 Creating Pre-Update Backup..."
bash "$PROJECT_ROOT/CICDtools/backup_db.sh" "pre_db_migration"

# 1. Pull latest code
log_info "📥 Pulling latest code from main..."
cd "$PROJECT_ROOT"
git pull origin main

# 2. Run Migration
log_info "🐘 Running TypeORM Migrations..."
sudo docker compose exec api npm run migration:run

log_success "Database migration completed!"
