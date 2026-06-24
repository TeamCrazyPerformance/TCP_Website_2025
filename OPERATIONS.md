# 🛠️ 서버 운영 가이드: 서비스별 독립 업데이트 방법 

현재 서버는 **Docker Compose**를 기반으로 구성되어 있어, 전체 서버를 끄지 않고도 각 서비스(프론트엔드, 백엔드, DB)를 독립적으로 업데이트할 수 있습니다.

이 가이드는 서버 운영 중 자주 발생하는 **무중단/최소 중단 업데이트** 시나리오를 다룹니다.

---

## 1. 프론트엔드 (Web) 독립 업데이트

프론트엔드는 `web/dist` 폴더의 정적 파일을 Nginx가 서빙하는 구조입니다. 컨테이너를 재시작할 필요 없이, **빌드 결과물만 교체하면 즉시 반영**됩니다.

### 절차
1. `CICDtools/update_frontend.sh` 실행

```bash
# 한 번에 실행 (자동 백업 포함)
./CICDtools/update_frontend.sh
```

> **참고:** 빌드가 완료되는 즉시 사용자가 새로고침하면 변경 사항이 보입니다.

---

## 2. 백엔드 (API) 독립 업데이트

백엔드 코드가 변경되었을 때, API 컨테이너만 다시 빌드하고 교체합니다.

### 절차
1. `CICDtools/update_backend.sh` 실행

```bash
# 한 번에 실행 (실행 중인 서비스 중단 최소화, 자동 백업 포함)
sudo ./CICDtools/update_backend.sh
```

> **주의:** API 컨테이너가 재시작되는 동안(약 1~5초) API 요청은 실패할 수 있습니다.

---

## 3. 데이터베이스 (DB) 독립 업데이트

DB 업데이트는 크게 **스키마 변경(Migration)**과 **DB 버전/설정 변경**으로 나뉩니다.

### 3.1 스키마 변경 (컬럼 추가, 테이블 생성 등)
서버를 끄지 않고 마이그레이션을 실행합니다.

```bash
# 한 번에 실행 (자동 백업 포함)
sudo ./CICDtools/migrate_db.sh
```

### 3.2 DB 설정 변경 (비밀번호, 버전 업그레이드 등)
`docker-compose.yml`이나 `.env` 파일을수정한 경우입니다.

```bash
# DB 컨테이너만 재생성
docker compose up -d --no-deps db
```

> **주의:** DB 컨테이너가 재시작되는 동안 백엔드에서 DB 연결 에러가 발생합니다.

---

## 4. 리버스 프록시 (Nginx) 설정 변경

`reverse-proxy/default.conf` 등 Nginx 설정이나 SSL 인증서를 갱신했을 때 사용합니다.

```bash
# 설정 변경 후 Nginx 재로딩 (중단 없음)
docker compose exec reverse-proxy nginx -s reload
```

---

## 요약

| 작업 | 명령어 | 중단 범위 |
|------|--------|-----------|
| **프론트 배포** | `cd web && npm run build` | **무중단** |
| **백엔드 배포** | `docker compose build api && docker compose up -d --no-deps api` | API만 잠시 중단 |
| **DB 마이그레이션** | `docker compose exec api npm run migration:run` | **무중단** |
| **전체 재시작** | `docker compose restart` | 전체 중단 |
