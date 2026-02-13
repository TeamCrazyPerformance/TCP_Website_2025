#!/bin/bash
set -e

# ==============================================================================
# Database Backup Script
# ==============================================================================
# Description:
#   Creates a dump of the PostgreSQL database and saves it to a local 'backups' folder.
#   It retains backups for 7 days (deletes older ones).
# Usage:
#   ./backup_db.sh [suffix_label]
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."
# 백업 디렉토리를 프로젝트 루트의 상위 폴더로 변경 (server_quickremove.sh 실행 시 삭제 방지)
BACKUP_DIR="$PROJECT_ROOT/../backups"

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

# Argument handling for custom label (default: manual)
LABEL=${1:-manual}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILENAME="db_backup_${TIMESTAMP}_${LABEL}.sql.gz"
FILES_FILENAME="files_backup_${TIMESTAMP}_${LABEL}.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Ensure 'teams' upload directory exists to prevent tar errors
mkdir -p "$PROJECT_ROOT/api/uploads/teams"
mkdir -p "$PROJECT_ROOT/api/json"
mkdir -p "$PROJECT_ROOT/logs"

echo "========================================"
echo "💾 Starting System Backup"
echo "   Label: $LABEL"
echo "   Dest : $BACKUP_DIR"
echo "========================================"

# Check if DB container is running
if [ -z "$(sudo docker compose ps -q db)" ]; then
    echo "❌ Error: DB container is not running!"
    exit 1
fi

# 1. Database Backup
echo "📦 [1/2] Dumping database..."
sudo docker compose exec -T db pg_dump -U user -d mydb --clean --if-exists | gzip > "$BACKUP_DIR/$DB_FILENAME"
echo "✅ DB Backup created: $DB_FILENAME"

# 2. Local Files Backup (Uploads, JSON, Logs)
echo "📦 [2/2] Archiving local files (uploads, json, logs)..."
# -C "$PROJECT_ROOT" : Change to project root before archiving
# Use sudo to ensure we can read files owned by root (from Docker)
sudo tar -czf "$BACKUP_DIR/$FILES_FILENAME" -C "$PROJECT_ROOT" api/uploads api/json logs

# Change ownership of the backup file to the current user (since sudo created it)
sudo chown "$CURRENT_USER" "$BACKUP_DIR/$FILES_FILENAME"

echo "✅ Files Backup created: $FILES_FILENAME"

echo "========================================"
echo "✨ Backup process completed!"
echo "========================================"

# Cleanup old backups (older than 7 days)
echo "🧹 Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "files_backup_*.tar.gz" -mtime +7 -delete

echo "========================================"
echo "✨ Backup process completed!"
echo "========================================"
