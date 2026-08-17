# Private Home QA deployment

운영 서버가 준비되기 전까지 가정용 PC에서 기술 아티클 기능을 반복 QA하기 위한 격리 환경입니다.

이 구성은 기존 `docker-compose.yml`, root `.env`, `envs/*.env`, 운영 볼륨을 사용하지 않습니다. 고정된 Compose 프로젝트 `tcp-private-qa` 아래에 다음 구성만 실행합니다.

여기서 개발 모드는 `NODE_ENV=development`, HTTP 전용 진입점, 빈 격리 DB를 뜻합니다. 다른 PC에서 장시간 QA하는 안정성을 위해 hot reload 대신 검증 가능한 이미지를 빌드하며, 코드 반영은 `update` 명령 한 번으로 수행합니다.

- 빈 PostgreSQL과 관리자 seed
- 빈 pipeline MySQL과 checksum migration
- 기술 아티클 pipeline worker/API
- NestJS API
- React 정적 frontend
- SSL 없는 HTTP reverse proxy

Elasticsearch, Logstash, Kibana, Filebeat는 실행하지 않습니다. 호스트에 공개되는 포트는 HTTP 포트 하나뿐이며 PostgreSQL, MySQL, NestJS API, pipeline 내부 API는 Docker 네트워크 안에만 둡니다.

## 준비 사항

- Linux PC 또는 Bash를 실행할 수 있는 Docker 호스트
- Docker Engine과 Docker Compose v2
- Git, curl, OpenSSL
- 공유기에서 이 PC에 고정 DHCP 주소를 할당하는 것을 권장

이 디렉터리에서 아래 명령을 실행합니다.

```bash
cd CICDtools/PrivateQuickDeploy
bash private_qa.sh setup
```

최초 설정 시 다음 값을 물어봅니다.

- 호스트 HTTP 포트: 기본 `8088`
- QA 관리자 아이디·이메일·비밀번호
- Gemini API 키: 개발 환경에서는 생략 가능하지만 AI 보강 QA에는 필요
- 크롤러 공개 URL·연락 이메일: 기존 프로젝트 값을 기본값으로 제안

JWT, 두 DB 비밀번호, API-pipeline 서비스 토큰은 자동 생성됩니다. 모든 값은 이 디렉터리의 `.private-qa.env`에만 `0600` 권한으로 저장되며 Git에서 제외됩니다. 재실행해도 기존 값은 바뀌지 않습니다.

## 공유기 포트포워딩

예를 들어 QA PC의 내부 IP가 `192.168.0.20`이고 기본 포트 `8088`을 선택했다면 TCP 포트포워딩 대상을 다음처럼 설정합니다.

```text
외부 포트 18088  ->  192.168.0.20:8088 TCP
```

외부에는 해당 HTTP 포트 하나만 전달해야 합니다. `3000`, `3306`, `5432`, pipeline의 `8080` 포트는 포워딩하지 마세요.

> 이 환경에는 SSL이 없습니다. 로그인 정보와 JWT를 포함한 통신이 암호화되지 않으므로 실제 서비스 비밀번호를 재사용하거나 운영 데이터를 넣으면 안 됩니다. 가능하면 포트포워딩 대신 VPN을 사용하고, QA가 끝나면 포트포워딩 규칙을 즉시 제거하세요.

## 반복 QA 명령

```bash
# 상태와 접속 주소 확인
bash private_qa.sh status

# 최신 upstream 코드로 재배포 — QA DB는 보존
bash private_qa.sh update

# 전체 로그 또는 특정 서비스 로그
bash private_qa.sh logs
bash private_qa.sh logs tech-article-pipeline
bash private_qa.sh logs api

# 컨테이너만 중지 — QA DB는 보존
bash private_qa.sh stop

# 기존 이미지와 DB로 재기동
bash private_qa.sh start
```

`update`는 dirty worktree나 분기된 Git 브랜치에서 자동 배포하지 않습니다. 최신 이미지를 먼저 빌드한 뒤 두 DB migration과 관리자 seed를 확인하고 pipeline → API → frontend/HTTP proxy 순서로 교체합니다.

## 설정값 하나만 변경

```bash
bash private_qa.sh config gemini-key
bash private_qa.sh config gemini-model
bash private_qa.sh config crawler-identity
bash private_qa.sh config service-token
bash private_qa.sh config http-port
```

선택한 값 이외의 환경 파일 바이트는 보존합니다. readiness 점검이 실패하면 이전 환경 파일과 컨테이너 설정을 자동 복구합니다.

## DB를 다시 완전히 비우기

```bash
bash private_qa.sh reset
```

`reset`은 3단계 확인 후 `tcp-private-qa` 프로젝트의 PostgreSQL, pipeline MySQL, 업로드 볼륨만 삭제합니다. 운영 프로젝트와 운영 볼륨은 건드리지 않습니다. 이후 migration과 seed를 다시 실행하여 빈 QA 상태로 구축합니다.

`.private-qa.env`는 보존되므로 관리자 로그인 정보와 내부 시크릿은 그대로입니다.

## 주요 QA 경로

- 공개 목록: `/tech-articles`
- 관리자 인벤토리: `/admin/tech-articles`
- 중복 검수: `/admin/tech-articles/reviews/duplicates`
- 품질·게시 검수: `/admin/tech-articles/reviews/quality`
- 공개 태그 점검: `/api/v1/tech-articles/tags`

`status`는 컨테이너 상태뿐 아니라 공개 태그 API를 통한 API-pipeline 인증 연동과 `/tech-articles` SPA 응답까지 확인합니다. 실제 Gemini 요청은 상태 점검에서 실행하지 않습니다.
