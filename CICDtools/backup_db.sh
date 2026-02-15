#!/bin/bash
set -e

# ==============================================================================
# Database Backup Script
# ==============================================================================
# Description:
#   Creates a dump of the PostgreSQL database and saves it to a local 'backups' folder.
#   - Retains at least 10 backups.
#   - Deletes backups older than 31 days ONLY if there are more than 10 files.
# Usage:
#   ./backup_db.sh [suffix_label]
# ==============================================================================

# Resolve absolute path to the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# 백업 디렉토리를 프로젝트 루트의 상위 폴더로 변경
BACKUP_DIR="$PROJECT_ROOT/../backups"

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "db_backup"

# Argument handling for custom label (default: manual)
LABEL=${1:-manual}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILENAME="db_backup_${TIMESTAMP}_${LABEL}.sql.gz"
FILES_FILENAME="files_backup_${TIMESTAMP}_${LABEL}.tar.gz"

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    log_info "Creating backup directory: $BACKUP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    # Set permissions so that the current user (and sudo) can write to it
    # We give full control to owner (root if sudo mkdir) and group/others read/execute?
    # Actually, we should make it owned by the user if possible, or just open permissions
    sudo chown "$CURRENT_USER:$CURRENT_USER" "$BACKUP_DIR"
    sudo chmod 755 "$BACKUP_DIR"
fi

# Ensure 'teams' upload directory exists to prevent tar errors
mkdir -p "$PROJECT_ROOT/api/uploads/teams"
mkdir -p "$PROJECT_ROOT/api/json"
mkdir -p "$PROJECT_ROOT/logs"

echo "========================================"
log_info "💾 Starting System Backup"
log_info "   Label: $LABEL"
log_info "   Dest : $BACKUP_DIR"
echo "========================================"

# Check if DB container is running
if [ -z "$(sudo docker compose ps -q db)" ]; then
    log_error "❌ Error: DB container is not running!"
    exit 1
fi

# 1. Database Backup
log_info "📦 [1/2] Dumping database..."
sudo docker compose exec -T db pg_dump -U user -d mydb --clean --if-exists | gzip | sudo tee "$BACKUP_DIR/$DB_FILENAME" > /dev/null
log_success "DB Backup created: $DB_FILENAME"

# 2. Local Files Backup (Uploads, JSON, Logs)
log_info "📦 [2/2] Archiving local files (uploads, json, logs)..."
# -C "$PROJECT_ROOT" : Change to project root before archiving
# Use sudo to ensure we can read files owned by root (from Docker)
sudo tar -czf "$BACKUP_DIR/$FILES_FILENAME" -C "$PROJECT_ROOT" api/uploads api/json logs

# Change ownership of the backup files to the current user (if defined)
if [ -n "$CURRENT_USER" ]; then
    sudo chown "$CURRENT_USER" "$BACKUP_DIR/$DB_FILENAME"
    sudo chown "$CURRENT_USER" "$BACKUP_DIR/$FILES_FILENAME"
fi

log_success "Files Backup created: $FILES_FILENAME"

log_success "Backup process completed!"

# Cleanup old backups
# Rule 1: Keep at least 10 backups (regardless of age).
# Rule 2: If more than 10 backups exist, delete those older than 31 days.
log_info "🧹 Checking for old backups to cleanup..."

cleanup_files() {
    local pattern=$1
    local count=$(find "$BACKUP_DIR" -name "$pattern" | wc -l)

    if [ "$count" -le 10 ]; then
        log_info "   - $pattern: $count files found (<= 10). Skipping cleanup."
    else
        log_info "   - $pattern: $count files found (> 10). Cleaning up files older than 31 days..."
        find "$BACKUP_DIR" -name "$pattern" -mtime +31 -delete
    fi
}

cleanup_files "db_backup_*.sql.gz"
cleanup_files "files_backup_*.tar.gz"

