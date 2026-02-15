#!/bin/bash

# ==============================================================================
# Health Check Script
# ==============================================================================
# Description:
#   Checks if key service containers are running and healthy.
# ==============================================================================

PROJECT_ROOT="$(dirname "$0")/.."

# Import Common Logging
source "$(dirname "$0")/utils/common_logging.sh"

# Setup Logging (Redirects output to log file & handles errors)
setup_logging "health_check"

echo "========================================"
log_info "🏥 Checking Service Health"
echo "========================================"

# Check Docker Containers
sudo docker compose ps

echo "----------------------------------------"

# Check API Health Endpoint (if available locally)
log_info "📡 Checking API Health Endpoint..."
if command -v curl &> /dev/null; then
    curl -I http://localhost:80/api/health/live || log_warn "⚠️  API might be down or unreachable locally"
else
    log_warn "⚠️  curl not found, skipping HTTP check"
fi

log_success "Health check completed"
