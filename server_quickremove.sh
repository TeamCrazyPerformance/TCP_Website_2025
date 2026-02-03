#!/usr/bin/env bash
set -e

### =========================
### 기본 설정
### =========================
PROJECT_DIR="$(pwd)"
PARENT_DIR="$(cd .. && pwd)"

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
read -p "계속하시겠습니까? (y/n): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "❌ 취소됨"
  exit 1
fi

echo

### =========================
### 1. Docker Compose 종료 (컨테이너 종료, 이미지 삭제, 볼륨 삭제, 네트워크 삭제, build 캐시 삭제)
### =========================
echo "🐳 Stopping docker compose & removing volumes..."
sudo docker system prune -a --volumes
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
