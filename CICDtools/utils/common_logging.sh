#!/bin/bash

# ==============================================================================
# Common Logging Module
# ==============================================================================
# Usage:
#   source "$(dirname "$0")/common_logging.sh"
#   setup_logging "script_name"
# ==============================================================================

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging Functions
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

log_info() {
    echo -e "${BLUE}[$(timestamp)] [INFO] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(timestamp)] [SUCCESS] $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(timestamp)] [WARN] $1${NC}"
}

log_error() {
    echo -e "${RED}[$(timestamp)] [ERROR] $1${NC}"
}

# Error Handler
handle_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "❌ Script FAILED with exit code $exit_code"
    else
        log_success "✨ Script COMPLETED successfully"
    fi
}

# Setup Logging
setup_logging() {
    local script_label=$1
    local project_root="$(dirname "$0")/.." # Assuming script is in CICDtools/
    local log_dir="$project_root/CICDtools/logs"
    
    mkdir -p "$log_dir"
    local log_file="$log_dir/execution_$(date +%Y-%m-%d).log"
    
    # Header for log file (Always log this to plain file if possible, or stdout)
    # If we are in a child script, this echo goes to stdout -> parent tee -> log file
    if [ -z "$CICD_LOGGING_ACTIVE" ]; then
        echo "--------------------------------------------------------------------------------" >> "$log_file"
        echo "[$(timestamp)] STARTING (ROOT) $script_label (User: $(whoami))" >> "$log_file"
        echo "--------------------------------------------------------------------------------" >> "$log_file"
        
        export CICD_LOGGING_ACTIVE=true
        
        # Redirect all output (stdout and stderr) to both console and log file
        exec > >(tee -a "$log_file") 2>&1
    else
        echo "--------------------------------------------------------------------------------"
        echo "[$(timestamp)] STARTING (SUB) $script_label"
        echo "--------------------------------------------------------------------------------"
    fi

    # Set up trap to log final status
    trap handle_exit EXIT
}
