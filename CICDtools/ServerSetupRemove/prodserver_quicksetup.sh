#!/usr/bin/env bash
set -e  # 에러 발생 시 즉시 중단

### =========================
### 기본 설정
### =========================
PROJECT_DIR="$(pwd)"
TARGET_USER="${SUDO_USER:-$USER}"

# ==============================================================================
# 📝 Execution Logging
# ==============================================================================
LOG_DIR="$(dirname "$0")/logs"
LOG_DIR="$(dirname "$0")/logs"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR" 2>/dev/null || sudo mkdir -p "$LOG_DIR"
    sudo chown -R "${SUDO_USER:-$(whoami)}" "$LOG_DIR" 2>/dev/null || true
fi
LOG_FILE="$LOG_DIR/execution_$(date +%Y-%m-%d).log"
CURRENT_USER=$(whoami)
SCRIPT_NAME=$(basename "$0")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] User: $CURRENT_USER | Script: $SCRIPT_NAME | Action: STARTED" >> "$LOG_FILE"

# Delete logs older than 30 days
find "$LOG_DIR" -name "execution_*.log" -mtime +30 -delete

echo "🚀 Server quick setup starting..."
echo "📂 Project dir : $PROJECT_DIR"
echo "👤 Target user : $TARGET_USER"
echo

# ==============================================================================
# ⚠️  User Confirmation / 사용자 확인
# ==============================================================================
echo "=============================================================================="
echo "                        🚀 Production Server Setup Tool                       "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - Initializes the production server environment from scratch."
echo "   - 운영(Production) 서버 환경을 처음부터 초기화합니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - When setting up a new server for the first time."
echo "   - 새로운 서버를 처음 세팅할 때 사용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - 1. Fix permissions and setup environment variables."
echo "   - 1. 권한을 수정하고 환경변수를 설정합니다."
echo "   - 2. Build Frontend and Backend."
echo "   - 2. 프론트엔드와 백엔드를 빌드합니다."
echo "   - 3. Start services and initialize DB (Migration, Seed)."
echo "   - 3. 서비스를 시작하고 DB를 초기화합니다 (마이그레이션, 시드)."
echo "=============================================================================="

# ------------------------------------------------------------------------------
# 🔒 Step 1: Basic Confirmation (y/n)
# ------------------------------------------------------------------------------
read -p "❓ [1/3] Do you want to proceed? (y/n) / 진행하시겠습니까? : " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 2: Intent Verification (Type 'SETUP')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  This operation will INITIALIZE the server environment."
echo "⚠️  서버 환경을 초기화합니다. 기존 데이터가 있다면 주의하세요."
read -p "❓ [2/3] Please type 'SETUP' to continue / 'SETUP'을 입력하세요 : " CONFIRM_TEXT
if [[ "$CONFIRM_TEXT" != "SETUP" ]]; then
    echo "🚫 Operation cancelled (Text mismatch)."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 3: Final Safety Check (Type 'YES')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  Final Warning: Changes might be irreversible."
echo "⚠️  마지막 경고: 되돌릴 수 없는 변경사항이 발생할 수 있습니다."
read -p "❓ [3/3] Type 'YES' to execute / 'YES'를 입력하여 실행하세요 : " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" != "YES" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

### =========================
### 1. 디렉토리 소유권 변경
### =========================
echo "🔧 Fixing directory ownership..."
sudo chown -R "$TARGET_USER:$TARGET_USER" "$PROJECT_DIR"
echo "✅ Ownership updated"
echo

### =========================
### 2. 환경변수 설정 (Interactive)
### =========================
echo "🔧 Setting up environment variables..."
chmod +x "$PROJECT_DIR/CICDtools/ServerSetupRemove/set_env.sh"
bash "$PROJECT_DIR/CICDtools/ServerSetupRemove/set_env.sh" "prod"
echo "✅ Environment variables configured"
echo

### =========================
### 3. Frontend build
### =========================
echo "🌐 Building frontend..."
cd "$PROJECT_DIR/web"

npm install
npm run build

echo "✅ Frontend build completed"
cd ..
echo

### =========================
### 3.5. Set vm.max_map_count=262144 for Elasticsearch
### =========================
echo "⚙️  Setting vm.max_map_count for Elasticsearch..."
sudo sysctl -w vm.max_map_count=262144
echo "✅ vm.max_map_count set to 262144"
echo

### 3.7. Set filebeat owner and permission
sudo chown root:root elk/filebeat/filebeat.yml
sudo chmod 600 elk/filebeat/filebeat.yml
echo "✅ Filebeat owner and permission set"
echo

### =========================
### 4. Docker Compose 실행
### =========================
echo "🐳 Starting docker compose..."
cd "$PROJECT_DIR"

sudo docker compose \
  up -d

echo "✅ Docker services are up"
echo


### =========================
### 5. 초기화 작업
### =========================
# 1. 테이블 생성
sudo docker compose exec api npm run migration:run
# 2. 관리자 계정 생성
sudo docker compose exec api npm run seed


### =========================
### 완료
### =========================
echo "🎉 Setup completed successfully!"
