#!/bin/bash
# DB 백업 스크립트
# 사용법: ./db/backup.sh
# Cron 예시 (매주 일요일 새벽 3시): 0 3 * * 0 /path/to/project/db/backup.sh

set -e

# 설정
BACKUP_DIR="$(dirname "$0")/backups"
CONTAINER_NAME="db"
DB_USER="user"
DB_NAME="mydb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.sql"
KEEP_DAYS=30  # 30일 이상 된 백업 삭제

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# 백업 실행
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"

# 압축
gzip "$BACKUP_DIR/$BACKUP_FILE"

echo "[$(date)] Backup completed: ${BACKUP_FILE}.gz"

# 오래된 백업 삭제
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups (older than $KEEP_DAYS days) deleted."

echo "[$(date)] Backup process finished."
