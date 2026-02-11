#!/bin/bash
set -e

# ==============================================================================
# Database Restore Script
# ==============================================================================
# Description:
#   Finds the latest backup file in 'backups/' and restores it to the database.
#   WARNING: This will OVERWRITE the current database!
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."
BACKUP_DIR="$PROJECT_ROOT/backups"

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
echo "                        ♻️  Database Restore Tool                             "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Finds the LATEST backup file in 'backups/'."
echo "   - 'backups/' 폴더에서 가장 최신 백업 파일을 찾습니다."
echo "   - Wipes the current database and restores data from the backup."
echo "   - 현재 데이터베이스를 지우고 백업 파일의 데이터로 복구합니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - 🚨 EMERGENCY ONLY: When data is corrupted or lost."
echo "   - 🚨 비상 상황: 데이터가 손상되거나 유실되었을 때만 사용하세요."
echo "   - To rollback to a previous state."
echo "   - 이전 상태로 되돌려야 할 때 사용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - ⚠️  ALL CURRENT DATA WILL BE LOST (Overwritten)."
echo "   - ⚠️  현재의 모든 데이터가 사라집니다 (덮어씌워짐)."
echo "   - The database will revert to the state of the latest backup."
echo "   - 데이터베이스가 최신 백업 시점의 상태로 되돌아갑니다."
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
# 🔒 Step 2: Intent Verification (Type 'RESTORE')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  This operation will DELETE ALL DATA and restore from backup."
echo "⚠️  모든 데이터가 삭제되고 백업본으로 복구됩니다."
read -p "❓ [2/3] Please type 'RESTORE' to continue / 'RESTORE'를 입력하세요 : " CONFIRM_TEXT
if [[ "$CONFIRM_TEXT" != "RESTORE" ]]; then
    echo "🚫 Operation cancelled (Text mismatch)."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 3: Final Safety Check (Type 'YES')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  Final Warning: This is destructive. Are you absolutely sure?"
echo "⚠️  마지막 경고: 파괴적인 작업입니다. 정말 확실합니까?"
read -p "❓ [3/3] Type 'YES' to execute / 'YES'를 입력하여 실행하세요 : " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" != "YES" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

# Find the latest backup file
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" | sort | tail -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Error: No backup files found in $BACKUP_DIR"
    exit 1
fi

echo "🔍 Found latest backup: $(basename "$LATEST_BACKUP")"
echo "⚠️  WARNING: This will OVERWRITE the current database data."
echo "   Are you sure you want to proceed? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "🚫 Restore cancelled."
    exit 0
fi

# Check if DB container is running
if [ -z "$(sudo docker compose ps -q db)" ]; then
    echo "❌ Error: DB container is not running!"
    exit 1
fi

echo "⏳ Restoring database... (This may take a while)"

# Unzip and pipe to psql
# Since the dump was created with --clean, it will drop existing tables first.
gunzip -c "$LATEST_BACKUP" | sudo docker compose exec -T db psql -U user -d mydb

echo "========================================"
echo "✅ Database restored successfully!"
echo "========================================"
