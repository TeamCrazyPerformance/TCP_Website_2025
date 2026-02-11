#!/usr/bin/env bash
set -e  # 에러 발생 시 즉시 중단

### =========================
### 기본 설정
### =========================
PROJECT_DIR="$(pwd)"
TARGET_USER="${SUDO_USER:-$USER}"

echo "🚀 Server quick setup starting..."
echo "📂 Project dir : $PROJECT_DIR"
echo "👤 Target user : $TARGET_USER"
echo

### =========================
### 1. 디렉토리 소유권 변경
### =========================
echo "🔧 Fixing directory ownership..."
sudo chown -R "$TARGET_USER:$TARGET_USER" "$PROJECT_DIR"
echo "✅ Ownership updated"
echo

### =========================
### 2. env 파일 안내 (수동 작업)
### =========================
echo "⚠️  IMPORTANT"
echo "👉 ./envs/ 안의 env 파일들을 먼저 수정하세요."
echo "👉 수정이 끝났으면 엔터를 누르세요."
read -r
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
