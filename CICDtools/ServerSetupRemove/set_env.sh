#!/bin/bash
set -e

# ==============================================================================
# Environment Setup Script
# ==============================================================================
# Description:
#   Interactively creates or updates necessary .env files for the production server.
#   - envs/api.env
#   - envs/db_prod.env
#   - .env (root)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENVS_DIR="$PROJECT_ROOT/envs"

mkdir -p "$ENVS_DIR"

# ==============================================================================
# 📝 Execution Logging
# ==============================================================================
LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
sudo chown -R "${SUDO_USER:-$(whoami)}" "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/execution_$(date +%Y-%m-%d).log"
CURRENT_USER=$(whoami)
SCRIPT_NAME=$(basename "$0")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] User: $CURRENT_USER | Script: $SCRIPT_NAME | Action: STARTED" >> "$LOG_FILE"

# Delete logs older than 30 days
find "$LOG_DIR" -name "execution_*.log" -mtime +30 -delete

echo "=============================================================================="
echo "🛠️  Environment Variable Setup"
echo "=============================================================================="
echo ""

# ==============================================================================
# 0. Mode Selection (Prod vs Dev)
# ==============================================================================
MODE="${1:-prod}" # Default to prod if no arg provided

if [[ "$MODE" == "dev" || "$MODE" == "development" ]]; then
    echo "🚧 Development Mode Selected"
    DEFAULT_NODE_ENV="development"
    DB_ENV_FILE="db_dev.env"
else
    echo "🚀 Production Mode Selected"
    DEFAULT_NODE_ENV="production"
    DB_ENV_FILE="db_prod.env"
fi
echo ""

# ------------------------------------------------------------------------------
# 1. API Environment (envs/api.env)
# ------------------------------------------------------------------------------
echo "🔹 Configuring [envs/api.env]..."

# Defaults
DEFAULT_PORT=3000
DEFAULT_SALT=12

# Ask for values
read -p "   Running PORT [Default: $DEFAULT_PORT]: " INPUT_PORT
PORT=${INPUT_PORT:-$DEFAULT_PORT}

read -p "   NODE_ENV [Default: $DEFAULT_NODE_ENV]: " INPUT_NODE_ENV
NODE_ENV=${INPUT_NODE_ENV:-$DEFAULT_NODE_ENV}

read -p "   BCRYPT_SALT_ROUNDS [Default: $DEFAULT_SALT]: " INPUT_SALT
SALT=${INPUT_SALT:-$DEFAULT_SALT}

# Generate JWT Secret automatically
if grep -q "JWT_SECRET=" "$ENVS_DIR/api.env" 2>/dev/null; then
    echo "   🔑 JWT_SECRET already exists. Keeping it."
    EXISTING_JWT=$(grep "JWT_SECRET=" "$ENVS_DIR/api.env" | cut -d '=' -f2)
    JWT_SECRET=$EXISTING_JWT
else
    echo "   🔑 Generating random JWT_SECRET..."
    JWT_SECRET=$(openssl rand -base64 64)
fi

# Write to file
cat > "$ENVS_DIR/api.env" <<EOF
# API Backend Environment Variables
PORT=$PORT
NODE_ENV=$NODE_ENV
BCRYPT_SALT_ROUNDS=$SALT
JWT_SECRET=$JWT_SECRET
EOF

echo "✅ envs/api.env created."
echo ""

# ------------------------------------------------------------------------------
# 2. DB Environment (envs/$DB_ENV_FILE)
# ------------------------------------------------------------------------------
echo "🔹 Configuring [envs/$DB_ENV_FILE]..."

# Defaults
DEFAULT_DB_HOST=db
DEFAULT_DB_PORT=5432
DEFAULT_DB_USER=user
DEFAULT_DB_NAME=mydb

# Ask for Non-Sensitive values
read -p "   DB_HOST [Default: $DEFAULT_DB_HOST]: " INPUT_DB_HOST
DB_HOST=${INPUT_DB_HOST:-$DEFAULT_DB_HOST}

read -p "   DB_PORT [Default: $DEFAULT_DB_PORT]: " INPUT_DB_PORT
DB_PORT=${INPUT_DB_PORT:-$DEFAULT_DB_PORT}

read -p "   DB_USER [Default: $DEFAULT_DB_USER]: " INPUT_DB_USER
DB_USER=${INPUT_DB_USER:-$DEFAULT_DB_USER}

read -p "   DB_NAME [Default: $DEFAULT_DB_NAME]: " INPUT_DB_NAME
DB_NAME=${INPUT_DB_NAME:-$DEFAULT_DB_NAME}

# Password input (Visible)
echo -n "   🔑 Enter DB_PASSWORD [Default: Mirae122!@#]: "
read INPUT_DB_PASSWORD
echo ""
DB_PASSWORD=${INPUT_DB_PASSWORD:-Mirae122!@#}

# Admin Account (Mandatory)
while [[ -z "$ADMIN_USERNAME" ]]; do
    read -p "   👤 Enter Admin Username (Required): " ADMIN_USERNAME
done

while [[ -z "$ADMIN_EMAIL" ]]; do
    read -p "   📧 Enter Admin Email (Required): " ADMIN_EMAIL
done

while [[ -z "$ADMIN_PASSWORD" ]]; do
    echo -n "   🔑 Enter Admin Password (Required): "
    read ADMIN_PASSWORD
    echo ""
done

# Write to file
cat > "$ENVS_DIR/$DB_ENV_FILE" <<EOF
# POSTGRES Container Init
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_NAME

# DB Connection
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Admin Account w/ Seeding
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

echo "✅ envs/$DB_ENV_FILE created."
echo ""

# ------------------------------------------------------------------------------
# 3. Root .env (For Docker Compose project name etc)
# ------------------------------------------------------------------------------
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "🔹 Configuring [.env] (Root)..."
    echo "COMPOSE_PROJECT_NAME=tcp-website" > "$PROJECT_ROOT/.env"
    echo "✅ .env created."
else
    echo "🔹 [.env] already exists. Skipping."
fi

echo ""
echo "🎉 Environment setup completed successfully!"
echo "=============================================================================="
