#!/bin/bash

# ==============================================================================
# Health Check Script
# ==============================================================================
# Description:
#   Checks if key service containers are running and healthy.
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."

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
echo "🏥 Checking Service Health"
echo "========================================"

# Check Docker Containers
sudo docker compose ps

echo "----------------------------------------"

# Check API Health Endpoint (if available locally)
echo "📡 Checking API Health Endpoint..."
if command -v curl &> /dev/null; then
    curl -I http://localhost:80/api/health/live || echo "⚠️  API might be down or unreachable locally"
else
    echo "⚠️  curl not found, skipping HTTP check"
fi

echo "========================================"
