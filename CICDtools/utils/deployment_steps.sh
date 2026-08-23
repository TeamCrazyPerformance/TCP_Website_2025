#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${TCP_CICD_DEPLOYMENT_LOADED:-}" ]]; then
  return 0
fi
readonly TCP_CICD_DEPLOYMENT_LOADED=1

# shellcheck source=runtime.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/runtime.sh"

readonly CICD_FRONTEND_STAGE_DIR="$CICD_PROJECT_ROOT/web/dist.next"
readonly CICD_FRONTEND_ACTIVE_DIR="$CICD_PROJECT_ROOT/web/dist"
readonly CICD_FRONTEND_ROLLBACK_DIR="$CICD_PROJECT_ROOT/web/dist.previous"

cicd_stage_frontend() {
  log_info "🎨 Building the frontend into an inactive staging directory... / 현재 화면에 영향 없이 새 프론트엔드를 빌드합니다."
  cicd_require_commands npm
  rm -rf -- "$CICD_FRONTEND_STAGE_DIR"
  (
    cd "$CICD_PROJECT_ROOT/web" || exit 1
    npm ci
    npx --no-install cross-env BUILD_PATH=dist.next react-scripts build
  )
  [[ -s "$CICD_FRONTEND_STAGE_DIR/index.html" ]] || {
    log_error "Frontend staging build did not produce index.html."
    return 1
  }
  log_success "📦 Frontend staging bundle is ready. / 프론트엔드 임시 번들을 준비했습니다."
}

cicd_activate_frontend() {
  [[ -s "$CICD_FRONTEND_STAGE_DIR/index.html" ]] || {
    log_error "No verified frontend staging bundle exists."
    return 1
  }

  log_info "🔄 Activating the staged frontend bundle... / 검증한 프론트엔드 번들을 활성화합니다."
  rm -rf -- "$CICD_FRONTEND_ROLLBACK_DIR"
  if [[ -d "$CICD_FRONTEND_ACTIVE_DIR" ]]; then
    mv "$CICD_FRONTEND_ACTIVE_DIR" "$CICD_FRONTEND_ROLLBACK_DIR"
  fi
  if ! mv "$CICD_FRONTEND_STAGE_DIR" "$CICD_FRONTEND_ACTIVE_DIR"; then
    [[ -d "$CICD_FRONTEND_ROLLBACK_DIR" ]] && mv "$CICD_FRONTEND_ROLLBACK_DIR" "$CICD_FRONTEND_ACTIVE_DIR"
    return 1
  fi

  if ! cicd_compose up -d --force-recreate web reverse-proxy || ! cicd_wait_service reverse-proxy healthy 90; then
    rm -rf -- "$CICD_FRONTEND_ACTIVE_DIR"
    [[ -d "$CICD_FRONTEND_ROLLBACK_DIR" ]] && mv "$CICD_FRONTEND_ROLLBACK_DIR" "$CICD_FRONTEND_ACTIVE_DIR"
    cicd_compose up -d --force-recreate web reverse-proxy || true
    log_error "Frontend activation failed; the previous bundle was restored."
    return 1
  fi
  log_success "🌐 Frontend bundle is active. / 새 프론트엔드가 활성화되었습니다."
}

cicd_commit_frontend() {
  rm -rf -- "$CICD_FRONTEND_ROLLBACK_DIR"
  log_success "🧹 Frontend activation was confirmed; the temporary rollback bundle was cleaned up. / 프론트엔드 전환을 확정했습니다."
}

cicd_rollback_frontend() {
  if [[ ! -d "$CICD_FRONTEND_ROLLBACK_DIR" ]]; then
    log_warn "No previous frontend bundle exists to restore."
    return 0
  fi
  log_warn "🧯 Restoring the previous frontend bundle after a failed deployment check... / 점검 실패로 이전 화면을 복구합니다."
  rm -rf -- "$CICD_FRONTEND_ACTIVE_DIR"
  mv "$CICD_FRONTEND_ROLLBACK_DIR" "$CICD_FRONTEND_ACTIVE_DIR"
  cicd_compose up -d --force-recreate web reverse-proxy
  cicd_wait_service reverse-proxy healthy 90
}

cicd_deploy_pipeline() {
  log_info "📰 Building the technical-article pipeline without replacing the running service... / 실행 중인 서비스를 유지한 채 새 이미지를 빌드합니다."
  cicd_compose build pipeline-migrate tech-article-pipeline
  cicd_compose up -d pipeline-mysql
  cicd_wait_service pipeline-mysql healthy 180

  log_info "🧬 Running checksum-verified MySQL migrations... / 체크섬으로 확인한 MySQL 마이그레이션을 실행합니다."
  cicd_compose up --no-deps --force-recreate pipeline-migrate
  cicd_wait_service pipeline-migrate exited 180

  log_info "♻️  Recreating the technical-article pipeline... / 기술 아티클 파이프라인을 새 버전으로 교체합니다."
  cicd_compose up -d --no-deps --force-recreate tech-article-pipeline
  cicd_wait_service tech-article-pipeline healthy 180
}

cicd_deploy_api() {
  log_info "⚙️  Building the NestJS API image... / 새 API 이미지를 빌드합니다."
  cicd_compose build api
  cicd_compose up -d db logstash
  cicd_wait_service db healthy 180

  log_info "🧬 Running PostgreSQL migrations with the new API image... / 새 API 이미지로 DB 마이그레이션을 실행합니다."
  if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
    cicd_compose run --rm --no-deps api npm run migration:run
  else
    cicd_compose run --rm --no-deps api npx typeorm migration:run -d dist/data-source.js
  fi

  log_info "♻️  Recreating the API... / API를 새 버전으로 교체합니다."
  cicd_compose up -d --no-deps --force-recreate api
  cicd_wait_service api healthy 180
}

cicd_seed_admin() {
  log_info "🌱 Ensuring the administrator account exists... / 관리자 계정을 확인하고 필요한 경우 생성합니다."
  if [[ "${CICD_ENVIRONMENT:-prod}" == "dev" ]]; then
    cicd_compose exec -T api npm run seed
  else
    cicd_compose exec -T api node dist/seed.js
  fi
}

cicd_verify_api_pipeline_integration() {
  log_info "🔗 Verifying the API and authenticated pipeline connection without invoking Gemini... / 비용이 발생하는 Gemini 호출 없이 연동을 확인합니다."
  cicd_compose exec -T api node -e \
    "fetch('http://127.0.0.1:3000/api/v1/tech-articles/tags').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
}
