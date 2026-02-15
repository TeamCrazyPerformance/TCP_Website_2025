#!/bin/bash
set -e

# ==============================================================================
# Database Password Rotation Script (Live System)
# ==============================================================================
# Description:
#   Safely rotates the PostgreSQL database password on a RUNNING production system.
#   1. Generates a new secure password.
#   2. Updates the User in the LIVE database (ALTER USER).
#   3. Updates the 'envs/db_prod.env' file.
#   4. Restarts the Backend to apply the change.
# ==============================================================================

# Ensure we are in the script's directory for relative path loading
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")/.." # Go up from CICDtools to Project Root
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db.sh"
UPDATE_BACKEND_SCRIPT="$SCRIPT_DIR/update_backend.sh"

# Import Common Logging
source "$SCRIPT_DIR/utils/common_logging.sh"

# Setup Logging
setup_logging "db_rotation"

echo "=============================================================================="
echo "                   🔐 Live Database Password Rotation"
echo "=============================================================================="
echo "⚠️  WARNING: This script will change the database password on a LIVE system."
echo "   - It will RESTART the API container."
echo "   - It will cause a brief service interruption (1-5 seconds)."
echo "=============================================================================="
echo ""

# 1. Verification & Confirmation
read -p "Type 'ROTATE' to confirm you want to change the DB password: " CONFIRM
if [[ "$CONFIRM" != "ROTATE" ]]; then
    log_warn "Confirmation failed. Exiting."
    exit 0
fi

# 2. Check if DB Container is running
if ! sudo docker ps | grep -q "db"; then
    log_error "Database container 'db' is NOT running. Cannot execute SQL."
    exit 1
fi

# 3. Create a Backup (Safety First)
log_info "📦 Creating safety backup before rotation..."
if [ -f "$BACKUP_SCRIPT" ]; then
    bash "$BACKUP_SCRIPT" "pre_rotation"
else
    log_warn "Backup script found. Proceeding without backup (RISKY)."
fi

# 4. Generate New Password
log_info "🎲 Generating new secure password..."
NEW_PASSWORD=$(openssl rand -hex 32)
# Escape potential special characters for sed (though hex doesn't have many)
SAFE_NEW_PASSWORD=$(echo "$NEW_PASSWORD" | sed 's/[\/&]/\\&/g')

# 5. Get Current DB User from Env File
ENV_FILE="$PROJECT_ROOT/envs/db_prod.env"
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

DB_USER=$(grep "^POSTGRES_USER=" "$ENV_FILE" | cut -d '=' -f2)
DB_NAME=$(grep "^POSTGRES_DB=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$DB_USER" ]; then
    # Fallback to default if not found
    DB_USER="tcp_user"
    log_warn "Could not read POSTGRES_USER from env. Using default: $DB_USER"
fi
if [ -z "$DB_NAME" ]; then
    DB_NAME="tcp_db"
fi

# 6. Rotate Password in LIVE Database
log_info "🔄 Updating password in running Database container..."
# Use docker exec to run psql. We use the root postgres user or the specific user? 
# Usually POSTGRES_USER is a superuser or owner.
# We need to execute: ALTER USER <user> WITH PASSWORD '<new_pass>';

if sudo docker compose exec db psql -U "$DB_USER" -d "$DB_NAME" -c "ALTER USER $DB_USER WITH PASSWORD '$NEW_PASSWORD';"; then
    log_success "Database User '$DB_USER' password updated successfully in DB."
else
    log_error "Failed to update password via SQL. Aborting."
    exit 1
fi

# 7. Update Environment File
log_info "📝 Updating 'envs/db_prod.env' file..."

# Use sed to replace the password lines. 
# We update both POSTGRES_PASSWORD and DB_PASSWORD if they exist.
# Detect OS for sed -i compatibility (Linux vs Mac). Assuming Linux/Bash here given user context.
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$SAFE_NEW_PASSWORD/" "$ENV_FILE"
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$SAFE_NEW_PASSWORD/" "$ENV_FILE"

# Also check api.env just in case it duplicates DB_PASSWORD (unlikely but safe to check)
API_ENV_FILE="$PROJECT_ROOT/envs/api.env"
if grep -q "^DB_PASSWORD=" "$API_ENV_FILE"; then
    log_info "Updating 'envs/api.env' as well..."
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$SAFE_NEW_PASSWORD/" "$API_ENV_FILE"
fi

log_success "Environment files updated."

# 8. Restart Backend to apply changes
log_info "🚀 Restarting Backend to apply new credentials..."
if [ -f "$UPDATE_BACKEND_SCRIPT" ]; then
    bash "$UPDATE_BACKEND_SCRIPT"
else
    log_warn "Update Backend script not found. You must restart the 'api' container manually."
    log_info "Run: sudo docker compose restart api"
fi

log_success "✅ Password Rotation Completed Successfully!"
