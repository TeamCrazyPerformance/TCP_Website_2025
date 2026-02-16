#!/bin/bash
set -e

# ==============================================================================
# Environment Setup Script - Secured & Automated
# ==============================================================================
# Description:
#   Generates secure .env files for production with minimal user input.
#   - Auto-generates secrets (JWT, DB Passwords).
#   - Uses safe defaults for ports and names.
#   - Only prompts for Admin credentials.
# ==============================================================================

# Ensure we are in the script's directory for relative path loading
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.." # Go up from CICDtools/ServerSetupRemove to Project Root
ENVS_DIR="$PROJECT_ROOT/envs"

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions (embedded for standalone use, but mimicking common logging)
log_info() { echo -e "${BLUE}[INFO] $1${NC}"; }
log_success() { echo -e "${GREEN}[SUCCESS] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error() { echo -e "${RED}[ERROR] $1${NC}"; }

mkdir -p "$ENVS_DIR"

log_info "🚀 Starting Secure Environment Setup..."

# ==============================================================================
# 0. Configuration & Defaults
# ==============================================================================
# Fixed Default Values (Safe to expose)
DEFAULT_PORT=3000
DEFAULT_NODE_ENV="production"
DEFAULT_SALT=12
DEFAULT_DB_HOST="db"
DEFAULT_DB_PORT=5432
DEFAULT_DB_USER="tcp_user"
DEFAULT_DB_NAME="tcp_db"

# ==============================================================================
# 1. Existing Value Check (Idempotency)
# ==============================================================================
# If files exist, read them. If not, generate new secrets.

# --- API Env ---
if [ -f "$ENVS_DIR/api.env" ]; then
    log_info "📄 Found existing api.env. Reading values..."
    EXISTING_JWT=$(grep "JWT_SECRET=" "$ENVS_DIR/api.env" | cut -d '=' -f2)
    # Use existing or generate if empty in file
    JWT_SECRET=${EXISTING_JWT:-$(openssl rand -base64 64 | tr -d '\n')}
else
    log_info "🆕 Generating NEW JWT_SECRET..."
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
fi

# --- DB Env ---
if [ -f "$ENVS_DIR/db_prod.env" ]; then
    log_info "📄 Found existing db_prod.env. Reading values..."
    EXISTING_DB_PASS=$(grep "POSTGRES_PASSWORD=" "$ENVS_DIR/db_prod.env" | cut -d '=' -f2)
    DB_PASSWORD=${EXISTING_DB_PASS:-$(openssl rand -hex 32 | tr -d '\n')}
    
    # Check for existing Admin details
    EXISTING_ADMIN_USER=$(grep "ADMIN_USERNAME=" "$ENVS_DIR/db_prod.env" | cut -d '=' -f2)
    EXISTING_ADMIN_EMAIL=$(grep "ADMIN_EMAIL=" "$ENVS_DIR/db_prod.env" | cut -d '=' -f2)
    # Password might not be easily grep-able if complex, but we try
    ADMIN_USERNAME=$EXISTING_ADMIN_USER
    ADMIN_EMAIL=$EXISTING_ADMIN_EMAIL
    # We will prompt for Admin credentials only if username is missing
else
    log_info "🆕 Generating NEW DB_PASSWORD..."
    DB_PASSWORD=$(openssl rand -hex 32 | tr -d '\n')
fi

# ==============================================================================
# 2. Pre-execution Summary (Echo to User)
# ==============================================================================
echo ""
echo "=============================================================================="
echo "                       📋  Configuration Summary                              "
echo "=============================================================================="
echo -e "🔧 ${BLUE}FIXED DEFAULTS (Standard Config):${NC}"
echo "   - PORT            : $DEFAULT_PORT"
echo "   - NODE_ENV        : $DEFAULT_NODE_ENV"
echo "   - DB_HOST         : $DEFAULT_DB_HOST"
echo "   - DB_PORT         : $DEFAULT_DB_PORT"
echo "   - DB_USER         : $DEFAULT_DB_USER"
echo ""
echo -e "🎲 ${YELLOW}GENERATED SECRETS (Auto-created):${NC}"
echo "   - JWT_SECRET      : [Hidden] (Run 'cat envs/api.env' to view)"
echo "   - DB_PASSWORD     : [Hidden] (Run 'cat envs/db_prod.env' to view)"
echo ""
echo -e "✍️  ${GREEN}MANUAL INPUT REQUIRED:${NC}"
if [ -z "$ADMIN_USERNAME" ]; then
    echo "   - Admin Credentials (Username, Email, Password)"
else
    echo "   - None (Admin credentials found)"
fi
echo "=============================================================================="
echo ""

# ==============================================================================
# 3. User Input (Admin Credentials)
# ==============================================================================
# Only ask if not already found
if [ -z "$ADMIN_USERNAME" ]; then
    log_info "Please enter Admin Account details for initial seeding:"
    
    while [[ -z "$ADMIN_USERNAME" ]]; do
        read -p "   👤 Admin Username: " ADMIN_USERNAME
    done
    export ADMIN_USERNAME # Temporarily export just in case

    while [[ -z "$ADMIN_EMAIL" ]]; do
        read -p "   📧 Admin Email: " ADMIN_EMAIL
    done
    export ADMIN_EMAIL

    while [[ -z "$ADMIN_PASSWORD" ]]; do
        echo -n "   🔑 Admin Password: "
        read -s ADMIN_PASSWORD
        echo "" # Newline after silent input
    done
    export ADMIN_PASSWORD
else
    # If admin user exists, we might still need password if it wasn't readable from env file easily?
    # Actually, we rely on writing what we read. If we read it, we write it back.
    # If we read username but not password (unlikely unless file corrupted), we might write empty password.
    # Let's try to read password too.
    if [ -f "$ENVS_DIR/db_prod.env" ]; then
         EXISTING_ADMIN_PASS=$(grep "ADMIN_PASSWORD=" "$ENVS_DIR/db_prod.env" | cut -d '=' -f2)
         ADMIN_PASSWORD=$EXISTING_ADMIN_PASS
    fi
    # If password still empty, ask for it?
    if [ -z "$ADMIN_PASSWORD" ]; then
        log_warn "⚠️  Admin Password missing in env file. Please enter it:"
        read -s ADMIN_PASSWORD
        echo ""
    else 
        log_info "👤 Admin Username found: $ADMIN_USERNAME"
        log_info "   (Using existing Admin credentials)"
    fi
fi

# ==============================================================================
# 4. Write Configuration Files
# ==============================================================================
log_info "💾 Writing configuration files..."

# --- api.env ---
cat > "$ENVS_DIR/api.env" <<EOF
# API Backend Environment Variables
PORT=$DEFAULT_PORT
NODE_ENV=$DEFAULT_NODE_ENV
BCRYPT_SALT_ROUNDS=$DEFAULT_SALT
JWT_SECRET=$JWT_SECRET
EOF

# --- db_prod.env ---
cat > "$ENVS_DIR/db_prod.env" <<EOF
# POSTGRES Container Init
POSTGRES_USER=$DEFAULT_DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DEFAULT_DB_NAME

# DB Connection
DB_HOST=$DEFAULT_DB_HOST
DB_PORT=$DEFAULT_DB_PORT
DB_USER=$DEFAULT_DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DEFAULT_DB_NAME

# Admin Account w/ Seeding
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

# --- root .env ---
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "COMPOSE_PROJECT_NAME=tcp-website" > "$PROJECT_ROOT/.env"
fi

# ==============================================================================
# 5. Post-execution Instructions
# ==============================================================================
echo ""
log_success "🎉 Environment setup completed successfully!"
echo ""
echo "=============================================================================="
echo "🚀 NEXT STEPS / ACTION REQUIRED"
echo "=============================================================================="
echo "1. Apply changes to the server:"
echo -e "   ${GREEN}sudo docker compose up -d --force-recreate${NC}"
echo ""
echo "2. ⚠️  IMPORTANT WARNING about Database Password:"
echo -e "   If you changed ${YELLOW}DB_PASSWORD${NC} and a database volume already exists,"
echo "   the running database WILL NOT update its password automatically."
echo "   To force a password change, you may need to reset the volume:"
echo "   (Only do this if you can afford to lose data or have a backup!)"
echo "   - sudo docker compose down -v"
echo "   - sudo docker compose up -d"
echo "=============================================================================="
echo ""
