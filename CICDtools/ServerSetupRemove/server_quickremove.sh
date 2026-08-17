#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
# shellcheck source=../utils/runtime.sh
source "$SCRIPT_DIR/../utils/runtime.sh"

setup_logging "server_quickremove"
cicd_require_commands docker realpath

project_dir="$(realpath "$CICD_PROJECT_ROOT")"
parent_dir="$(realpath "$CICD_PROJECT_ROOT/..")"
[[ -f "$project_dir/docker-compose.yml" && -d "$project_dir/CICDtools" ]] || {
  log_error "Resolved target does not look like the TCP website repository: $project_dir"
  exit 1
}
[[ "$project_dir" == "$parent_dir"/* && "$project_dir" != "/" ]] || {
  log_error "Unsafe project target: $project_dir"
  exit 1
}

compose_project="$(cicd_env_get "$project_dir/.env" COMPOSE_PROJECT_NAME 2>/dev/null || printf 'tcp-website')"
cicd_print_banner "💣" "Complete Server Removal / 서버 완전 제거" \
  "🚨 DANGER / 위험: 이 작업은 되돌릴 수 없습니다." \
  "📘 Docker 컨테이너·이미지, 아래 데이터 볼륨, 저장소 디렉터리를 모두 영구 삭제합니다." \
  "🐘 PostgreSQL volume: ${compose_project}_db-data" \
  "🐬 Pipeline MySQL volume: ${compose_project}_pipeline-mysql-data" \
  "🔎 Elasticsearch volume: ${compose_project}_es-data" \
  "📁 Repository directory: $project_dir" \
  "💾 필요한 백업을 다른 위치에 보관했는지 반드시 먼저 확인하세요." \
  "🖥️  호스트 재부팅은 자동으로 수행하지 않습니다."
if ! cicd_confirm_dangerous_action "DESTROY" \
  "All listed containers, volumes, and repository files will be permanently deleted." \
  "표시된 컨테이너·볼륨·저장소 파일이 영구 삭제됩니다."; then
  log_warn "🚫 Removal cancelled. Nothing was deleted. / 제거를 취소했습니다."
  exit 0
fi
read -r -p "❓ [4/4] Type the exact repository name '$(basename "$project_dir")' / 저장소 이름 입력: " repository_name
[[ "$repository_name" == "$(basename "$project_dir")" ]] || { log_error "Repository name did not match."; exit 1; }

cicd_print_step 1 2 "🐳" "Remove containers, images, and named volumes / Docker 리소스 제거"
cd "$project_dir"
cicd_compose down --volumes --remove-orphans --rmi local

cicd_print_step 2 2 "📁" "Remove the verified repository directory / 확인된 저장소 디렉터리 제거"
cd "$parent_dir"
cicd_as_root rm -rf --one-file-system -- "$project_dir"
log_success "🎉 Containers, PostgreSQL/MySQL/Elasticsearch volumes, and repository directory were removed. / 전체 제거를 완료했습니다."
log_warn "🖥️  The host was not rebooted automatically. Reboot manually if required. / 필요하면 서버를 직접 재부팅하세요."
