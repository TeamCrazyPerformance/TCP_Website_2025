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
# 백업 디렉토리를 프로젝트 루트의 상위 폴더로 변경
BACKUP_DIR="$PROJECT_ROOT/../backups"

# ==============================================================================
# ⚠️  User Confirmation
# ==============================================================================
echo "=============================================================================="
echo "                        ♻️  System Restore Tool                               "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Finds the LATEST backup files in system backups."
echo "   - 가장 최신 DB 및 파일 백업을 찾습니다."
echo "   - Wipes current DB and OVERWRITES local files (uploads, json)."
echo "   - 현재 DB를 초기화하고 로컬 파일(업로드, 설정)을 덮어씁니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - 🚨 EMERGENCY ONLY: When data is corrupted or lost."
echo "   - 🚨 비상 상황: 데이터가 손상되거나 유실되었을 때만 사용하세요."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - ⚠️  ALL CURRENT DATA WILL BE LOST (Overwritten)."
echo "   - ⚠️  현재의 모든 데이터가 사라집니다 (덮어씌워짐)."
echo "   - The system will revert to the state of the latest backup."
echo "   - 시스템이 최신 백업 시점의 상태로 되돌아갑니다."
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

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "db_restore"

# Find the latest backup file
LATEST_DB_BACKUP=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" | sort | tail -n 1)
LATEST_FILES_BACKUP=$(find "$BACKUP_DIR" -name "files_backup_*.tar.gz" | sort | tail -n 1)

if [ -z "$LATEST_DB_BACKUP" ]; then
    echo "❌ Error: No DB backup files found in $BACKUP_DIR"
    exit 1
fi

log_info "🔍 Found latest DB backup   : $(basename "$LATEST_DB_BACKUP")"
if [ -n "$LATEST_FILES_BACKUP" ]; then
    log_info "🔍 Found latest Files backup: $(basename "$LATEST_FILES_BACKUP")"
else
    log_warn "⚠️  Warning: No local files backup found. Only DB will be restored."
fi

log_warn "⚠️  WARNING: This will OVERWRITE the current database and files."
echo "   Are you sure you want to proceed? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
    log_warn "🚫 Restore cancelled."
    exit 0
fi

# Check if DB container is running
if [ -z "$(sudo docker compose ps -q db)" ]; then
    log_error "❌ Error: DB container is not running!"
    exit 1
fi

# 1. Restore Database
log_info "⏳ [1/2] Restoring database... (This may take a while)"
# Unzip and pipe to psql
# Since the dump was created with --clean, it will drop existing tables first.
gunzip -c "$LATEST_DB_BACKUP" | sudo docker compose exec -T db psql -U user -d mydb
log_success "Database restored successfully!"

# 2. Restore Local Files
if [ -n "$LATEST_FILES_BACKUP" ]; then
    log_info "⏳ [2/2] Restoring local files..."
    # -C "$PROJECT_ROOT" : Extract relative to project root
    # This will overwrite api/uploads, api/json, logs
    # Use sudo to verify we can overwrite files regardless of ownership
    sudo tar -xzf "$LATEST_FILES_BACKUP" -C "$PROJECT_ROOT"
    log_success "Local files restored successfully!"
else
    log_info "⏩ Skipping file restore (no backup found)"
fi

log_success "System restore process completed!"
