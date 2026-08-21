#!/usr/bin/env bash
# 기술 아티클 프론트엔드 로컬 확인용 — 목 API + CRA 개발 서버를 한 번에 띄웁니다.
#
#   bash tools/dev.sh
#
# 목 API는 node --watch 로 실행되므로 tools/ 아래 파일을 저장하면 자동 재시작합니다.
# React 코드는 CRA가 원래 hot reload 하므로 아무 것도 안 해도 됩니다.
# Ctrl+C 한 번이면 둘 다 같이 종료됩니다.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."   # web/

MOCK_PORT="${MOCK_PORT:-3000}"   # web/package.json 의 proxy 값과 일치해야 합니다
WEB_PORT="${WEB_PORT:-3100}"

# --- 사전 점검 ------------------------------------------------------------
node_major="$(node -p 'process.versions.node.split(".")[0]')"
node_minor="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$node_major" -lt 18 ] || { [ "$node_major" -eq 18 ] && [ "$node_minor" -lt 11 ]; }; then
  echo "✗ node --watch 는 Node 18.11 이상이 필요합니다 (현재 $(node -v))." >&2
  echo "  Node 를 올리거나 tools/mock-tech-articles-api.mjs 를 직접 실행하세요." >&2
  exit 1
fi

for port in "$MOCK_PORT" "$WEB_PORT"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ 포트 $port 가 이미 사용 중입니다. 아래로 확인 후 정리하세요:" >&2
    echo "    lsof -nP -iTCP:$port -sTCP:LISTEN" >&2
    exit 1
  fi
done

# --- 두 프로세스를 함께 살리고 함께 죽이기 --------------------------------
cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "▸ 종료합니다..."
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "▸ 목 API      http://localhost:$MOCK_PORT   (파일 저장 시 자동 재시작)"
echo "▸ 프론트엔드  http://localhost:$WEB_PORT/tech-articles"
echo ""

PORT="$MOCK_PORT" node --watch --watch-path=./tools tools/mock-tech-articles-api.mjs &
BROWSER=none PORT="$WEB_PORT" npm start &

wait
