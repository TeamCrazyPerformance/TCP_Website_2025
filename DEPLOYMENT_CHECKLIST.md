# 🚀 배포 전 체크리스트

프로덕션 환경으로 배포하기 전에 아래 항목들을 반드시 확인하고 설정하세요.

---

## 📋 목차

1. [환경 변수 설정](#1-환경-변수-설정)
2. [보안 설정](#2-보안-설정)
3. [인프라 설정](#3-인프라-설정)
4. [최종 확인](#4-최종-확인)

---

## 1. 환경 변수 설정 (자동화됨)

> [!TIP]
> **자동화 도구 권장:** `CICDtools/ServerSetupRemove/set_env.sh` 스크립트를 사용하면 아래 과정이 대화형으로 **자동 처리**됩니다. 수동 설정이 필요한 경우에만 아래 내용을 참고하세요.

### 1.1 API 환경 변수 (`envs/api.env`)

| 변수명 | 설명 | 자동화 처리 |
|--------|------|-----------|
| `JWT_SECRET` | JWT 토큰 서명 키 | ✅ 자동 생성 (Random 64bytes) |
| `BCRYPT_SALT_ROUNDS` | 비밀번호 해싱 강도 | ✅ 기본값 12 설정 |
| `PORT` | 서버 포트 | ✅ 기본값 3000 설정 (변경 가능) |
| `NODE_ENV` | 실행 환경 | ✅ `production` 자동 설정 |

---

### 1.2 데이터베이스 환경 변수 (`envs/db_prod.env`)

| 변수명 | 설명 | 자동화 처리 |
|--------|------|-----------|
| `DB_HOST`, `DB_PORT` | DB 접속 정보 | ✅ 기본값 설정 (db, 5432) |
| `DB_USER` | DB 사용자명 | ✅ 입력값 반영 |
| `DB_PASSWORD` | DB 비밀번호 | ✅ **입력 필요** (공개 입력) |
| `ADMIN_ACCOUNT` | 초기 관리자 계정 | ✅ **입력 필요** (이메일/비번/유저명) |

> [!IMPORTANT]
> `prodserver_quicksetup.sh` 실행 시 이 파일이 자동으로 생성됩니다.

---

### 1.3 ELK 스택 (현재 수동 설정 필요)

| 변수명 | 설명 | 권장 조치 |
|--------|------|-----------|
| `ELASTIC_PASSWORD` | Elasticsearch elastic 사용자 비밀번호 | 🔴 **필수 변경** |
| `KIBANA_SYSTEM_PASSWORD` | Kibana 시스템 사용자 비밀번호 | 🔴 **필수 변경** |

```bash
# 강력한 비밀번호 생성 명령어
openssl rand -base64 32
```

---

## 2. 보안 설정

### 2.1 포트 접근 제한 ✅

모든 내부 서비스가 `expose`로 설정되어 외부 직접 접근이 차단되었습니다:

| 서비스 | 설정 | 상태 |
|--------|------|------|
| PostgreSQL | `expose: "5432"` | ✅ 내부망만 |
| Elasticsearch | `expose: "9200"` | ✅ 내부망만 |
| Kibana | `expose: "5601"` | ✅ 내부망만 |
| Logstash | `expose: "5000"` | ✅ 내부망만 |
| Reverse Proxy | `ports: "80:80"` | ✅ 외부 접근 허용 (정상) |

> [!TIP]
> SSH 터널링으로 내부 서비스에 접근하는 방법:
> ```bash
> # 예: Kibana 접근
> ssh -L 5601:localhost:5601 user@your-server
> # 브라우저에서 http://localhost:5601 접속
> ```

---

### 2.2 HTTPS 설정

`reverse-proxy/default.conf`에 SSL/TLS 설정 추가 필요:

- [ ] SSL 인증서 발급 (Let's Encrypt 권장)
- [ ] Nginx HTTPS 설정
- [ ] HTTP → HTTPS 리다이렉트 설정

---

### 2.3 Elasticsearch 보안

`elk/elasticsearch/elasticsearch.yml`에서 확인:

- [ ] `xpack.security.enabled: true` - 현재 활성화됨 ✅
- [ ] HTTPS 활성화 고려 (`xpack.security.http.ssl.enabled: true`)
- [ ] Kibana 접근 IP 제한 또는 VPN/SSH 터널링 사용

---

## 3. 인프라 설정

### 3.1 Nginx Reverse Proxy 설정

`reverse-proxy/default.conf` 파일이 비어있습니다. 다음 설정이 필요합니다:

```nginx
# 예시 설정
upstream api {
    server api:3000;
}

upstream web {
    server web:80;
}

server {
    listen 80;
    server_name your-domain.com;

    # API 요청
    location /api {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 정적 파일
    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
    }
}
```

---

### 3.2 프론트엔드 빌드

- [ ] `web/dist` 폴더에 프론트엔드 빌드 결과물 배치
- [ ] `npm run build` 또는 프레임워크에 맞는 빌드 명령 실행

---

### 3.3 Docker Compose 환경변수 동기화

`docker-compose.yml`에 하드코딩된 값들을 환경 변수로 교체:

```yaml
# 현재 (하드코딩)
environment:
  - DB_USER=user
  - DB_PASSWORD=password

# 개선 (env_file 사용)
env_file:
  - ./envs/db_dev.env
  - ./envs/api.env
```

---

## 4. 최종 확인

### 4.1 파일 체크리스트

- [ ] `.gitignore`에서 `*.env` 주석 해제하여 env 파일 제외
- [ ] 모든 env 파일의 개발용 비밀번호 변경 완료
- [ ] `reverse-proxy/default.conf` 설정 완료
- [ ] `web/dist` 프론트엔드 빌드 결과물 배치

---

### 4.2 배포 전 테스트

```bash
# 1. 설정 검증
docker-compose config

# 2. 서비스 빌드
docker-compose build

# 3. 서비스 시작
docker-compose up -d

# 4. DB ready 대기 (약 10초)
sleep 10

# 5. 초기 Admin 계정 생성 (최초 배포 시 1회만)
docker-compose exec api npm run seed

# 6. 로그 확인
docker-compose logs -f

# 7. 헬스체크
curl http://localhost/api/health/live
```

> [!NOTE]
> `seed` 명령어는 최초 배포 시 1회만 실행합니다. 이미 Admin 계정이 존재하면 스킵됩니다.

---

### 4.3 비밀번호 변경 요약

| 항목 | 파일 | 변수 |
|------|------|------|
| JWT 시크릿 | `envs/api.env` | `JWT_SECRET` |
| DB 비밀번호 | `envs/db_dev.env` + `docker-compose.yml` | `DB_PASSWORD` |
| 관리자 비밀번호 | `envs/db_dev.env` | `ADMIN_PASSWORD` |
| Elasticsearch | `envs/elk.env` | `ELASTIC_PASSWORD` |
| Kibana | `envs/elk.env` | `KIBANA_SYSTEM_PASSWORD` |

---

> [!WARNING]
> 배포 전 반드시 모든 기본 비밀번호를 변경하세요!  
> 변경 후 env 파일들이 Git에 커밋되지 않도록 `.gitignore` 설정을 확인하세요.
