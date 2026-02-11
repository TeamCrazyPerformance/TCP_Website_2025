#!/usr/bin/env bash
set -e

### =========================
### 기본 설정
### =========================
PROJECT_DIR="$(pwd)"
PARENT_DIR="$(cd .. && pwd)"

# ==============================================================================
# 📝 Execution Logging
# ==============================================================================
LOG_DIR="$(dirname "$0")/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/execution_$(date +%Y-%m-%d).log"
CURRENT_USER=$(whoami)
SCRIPT_NAME=$(basename "$0")
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] User: $CURRENT_USER | Script: $SCRIPT_NAME | Action: STARTED" >> "$LOG_FILE"

# Delete logs older than 30 days
find "$LOG_DIR" -name "execution_*.log" -mtime +30 -delete

echo "🔥 SERVER DESTROY SCRIPT"
echo "📂 Project dir : $PROJECT_DIR"
echo "📂 Parent dir  : $PARENT_DIR"
echo

### =========================
### 0. 실행 확인 (y/n)
### =========================
echo "⚠️  WARNING ⚠️"
echo "이 스크립트는 다음 작업을 수행합니다:"
echo "1) docker compose down -v"
echo "2) 프로젝트 디렉토리 전체 삭제 (rm -rf)"
echo "3) 서버 재부팅"
echo
# ==============================================================================
# ⚠️  User Confirmation / 사용자 확인
# ==============================================================================
echo "=============================================================================="
echo "                        🔥 Server Destruction Tool                            "
echo "=============================================================================="
echo "📘 What is this? / 📘 이건 무엇인가요?"
echo "   - COMPLETELY REMOVES the current server environment."
echo "   - 현재 서버 환경을 **완전히 삭제**합니다."
echo ""
echo "🕒 When to use? / 🕒 언제 사용하나요?"
echo "   - When you want to reset the server and start over."
echo "   - 서버를 초기화하고 처음부터 다시 시작하고 싶을 때 사용합니다."
echo "   - When decommissioning the server."
echo "   - 서버를 폐기할 때 사용합니다."
echo ""
echo "💥 What happens next? / 💥 실행하면 무슨 일이 일어나나요?"
echo "   - 1. Stop and remove all Docker containers/volumes."
echo "   - 1. 모든 Docker 컨테이너와 볼륨을 중지하고 삭제합니다."
echo "   - 2. Delete the project directory."
echo "   - 2. 프로젝트 디렉토리를 삭제합니다."
echo "   - 3. Reboot the system."
echo "   - 3. 시스템을 재부팅합니다."
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
# 🔒 Step 2: Intent Verification (Type 'DESTROY')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  This operation will DESTROY all data, containers, and volumes."
echo "⚠️  모든 데이터, 컨테이너, 볼륨이 영구적으로 삭제됩니다."
read -p "❓ [2/3] Please type 'DESTROY' to continue / 'DESTROY'를 입력하세요 : " CONFIRM_TEXT
if [[ "$CONFIRM_TEXT" != "DESTROY" ]]; then
    echo "🚫 Operation cancelled (Text mismatch)."
    exit 0
fi

# ------------------------------------------------------------------------------
# 🔒 Step 3: Final Safety Check (Type 'YES')
# ------------------------------------------------------------------------------
echo ""
echo "⚠️  Final Warning: This cannot be undone. Server will reboot."
echo "⚠️  마지막 경고: 되돌릴 수 없습니다. 서버가 재부팅됩니다."
read -p "❓ [3/3] Type 'YES' to execute / 'YES'를 입력하여 실행하세요 : " FINAL_CONFIRM
if [[ "$FINAL_CONFIRM" != "YES" ]]; then
    echo "🚫 Operation cancelled."
    exit 0
fi
echo ""

echo

### =========================
### 1. Docker Compose 종료 (컨테이너 종료, 이미지 삭제, 볼륨 삭제, 네트워크 삭제, build 캐시 삭제)
### =========================
echo "🐳 Stopping docker compose & removing volumes..."
sudo docker compose down -v --rmi local
echo "✅ Docker containers / networks / volumes removed"
echo

### =========================
### 2. 프로젝트 디렉토리 삭제
### =========================
echo "🗑️  Removing project directory..."
cd "$PARENT_DIR"
sudo rm -rf "$PROJECT_DIR"
echo "✅ Project directory removed"
echo

### =========================
### 3. 재부팅
### =========================
echo "🔁 Rebooting server..."
sudo reboot
