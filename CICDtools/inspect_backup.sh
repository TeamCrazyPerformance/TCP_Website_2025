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

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "backup_inspection"

echo "========================================"
log_info "🧐 Inspecting Latest Backup"
echo "========================================"

# Find the latest backup file
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "db_backup_*.sql.gz" | sort | tail -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    log_error "❌ Error: No backup files found in $BACKUP_DIR"
    exit 1
fi

FILENAME=$(basename "$LATEST_BACKUP")
FILESIZE=$(du -h "$LATEST_BACKUP" | cut -f1)

log_info "📄 File: $FILENAME"
log_info "💾 Size: $FILESIZE"
echo "----------------------------------------"

log_info "👀 Preview (First 20 lines):"
# Show header comments and first few SQL commands
gunzip -c "$LATEST_BACKUP" | grep -v "^--" | grep -v "^$" | head -n 20

echo "----------------------------------------"
log_info "📊 Table Summary (CREATE TABLE statements):"
gunzip -c "$LATEST_BACKUP" | grep "CREATE TABLE" || log_warn "   (No CREATE TABLE statements found or compressed differently)"

log_success "Inspection completed"
