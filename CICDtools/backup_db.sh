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

# Argument handling for custom label (default: manual)
LABEL=${1:-manual}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="db_backup_${TIMESTAMP}_${LABEL}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "💾 Starting Database Backup"
echo "   Label: $LABEL"
echo "========================================"

# Check if DB container is running
if [ -z "$(sudo docker compose ps -q db)" ]; then
    echo "❌ Error: DB container is not running!"
    exit 1
fi

# Run pg_dump inside the container
# --clean: Drop database objects before creating them (useful for restores)
# --if-exists: Use IF EXISTS when dropping objects
echo "📦 Dumping database..."
sudo docker compose exec -T db pg_dump -U user -d mydb --clean --if-exists | gzip > "$BACKUP_DIR/$FILENAME"

echo "✅ Backup created: $BACKUP_DIR/$FILENAME"

# Cleanup old backups (older than 7 days)
echo "🧹 Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "========================================"
echo "✨ Backup process completed!"
echo "========================================"
