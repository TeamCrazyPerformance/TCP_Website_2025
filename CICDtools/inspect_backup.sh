#!/bin/bash
set -e

# ==============================================================================
# Backup Inspection Script
# ==============================================================================
# Description:
#   Shows specific details about the latest backup file to verify its integrity.
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

echo "========================================"
echo "🧐 Inspecting Latest Backup"
echo "========================================"

# Find the latest backup file
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" | sort | tail -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ Error: No backup files found in $BACKUP_DIR"
    exit 1
fi

FILENAME=$(basename "$LATEST_BACKUP")
FILESIZE=$(du -h "$LATEST_BACKUP" | cut -f1)

echo "📄 File: $FILENAME"
echo "💾 Size: $FILESIZE"
echo "----------------------------------------"

echo "👀 Preview (First 20 lines):"
# Show header comments and first few SQL commands
gunzip -c "$LATEST_BACKUP" | grep -v "^--" | grep -v "^$" | head -n 20

echo "----------------------------------------"
echo "📊 Table Summary (CREATE TABLE statements):"
gunzip -c "$LATEST_BACKUP" | grep "CREATE TABLE" || echo "   (No CREATE TABLE statements found or compressed differently)"

echo "========================================"
echo "✅ Inspection completed"
echo "========================================"
