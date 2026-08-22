# CICDtools 운영 가이드

이 디렉터리의 스크립트는 저장소 어느 위치에서 실행해도 스크립트 자신의 경로로 프로젝트
루트를 계산합니다. 운영·개발 구축과 일반 업데이트는 항상 Compose의 `tech-articles`
프로필을 활성화합니다. 명령은 저장소 루트에서 `bash CICDtools/<script>.sh` 형식으로
실행하는 것을 권장합니다.

## 최초 구축

운영 서버에는 저장소 밖의 인증서 관리 절차로 다음 파일을 먼저 주입해야 합니다.

- `reverse-proxy/certs/origin.crt`
- `reverse-proxy/certs/origin.key`

그 다음 아래 중 하나를 실행합니다.

```bash
bash CICDtools/ServerSetupRemove/prodserver_quicksetup.sh
bash CICDtools/ServerSetupRemove/devserver_quicksetup.sh
```

두 스크립트 모두 환경 설정, `npm ci` 프론트 빌드, PostgreSQL/MySQL 기동과 migration,
관리자 seed, 파이프라인 readiness, 프론트 활성화, 전체 헬스체크까지 수행합니다. 개발
모드는 `docker-compose.dev.yml`을 함께 사용하고 Gemini 키 없이도 구축할 수 있습니다.

환경만 준비하려면 다음 명령을 사용합니다.

```bash
bash CICDtools/ServerSetupRemove/set_env.sh prod
bash CICDtools/ServerSetupRemove/set_env.sh dev
```

`set_env.sh`는 재실행해도 기존 비밀값을 유지하고 비어 있는 값만 생성하거나 질문합니다.
화면과 실행 로그에는 비밀값을 출력하지 않으며 `.env`와 실제 `envs/*.env` 권한을
`0600`으로 설정합니다.

| 소유권 | 값 |
|---|---|
| 내부 자동 생성 | JWT, PostgreSQL 비밀번호, ELK 비밀번호, 파이프라인 서비스 토큰, MySQL 앱/root 비밀번호 |
| 외부 입력 | 관리자 계정, Gemini API 키, 크롤러 공개 URL·연락 이메일 |
| 저장소 밖 주입 | 운영 SSL 인증서와 개인키 |

기본 크롤러 식별값은 `https://teamcrazyperformance.com/` 및
`seoultech.tcp@gmail.com`입니다. 운영 Gemini 키는 필수이고 개발에서는 선택입니다.
파이프라인 Compose 보간값은 루트 `.env`에만 두며, NestJS에는 MySQL/Gemini 자격
증명을 주입하지 않습니다.

## 배포 명령

```bash
bash CICDtools/update_all.sh
bash CICDtools/update_backend.sh
bash CICDtools/update_frontend.sh
bash CICDtools/update_pipeline.sh
```

`update_all.sh`는 확인, fast-forward Git pull, 통합 백업을 각각 한 번만 수행합니다.
크롤링 관리처럼 파이프라인 스키마·API·화면이 함께 바뀌는 릴리스는 개별 업데이트가 아니라
반드시 `update_all.sh`를 사용합니다.
배포 순서는 다음과 같이 고정됩니다.

1. 프론트엔드를 비활성 `dist.next`에 `npm ci`로 빌드
2. 파이프라인 이미지 빌드 → MySQL health → checksum migration → pipeline readiness
3. 새 API 이미지 빌드 → TypeORM migration → API 재생성/health
4. API에서 파이프라인 readiness 확인
5. 프론트 번들 원자적 활성화(실패 시 이전 번들 복구)
6. 전체 헬스체크

배포 실패 시 성공 문구를 출력하지 않고 비정상 종료합니다. 파이프라인 장애는 기존 API
컨테이너의 기동 의존성이 아니지만, 전체 배포는 기술 아티클 연동 검증이 실패하면 완료로
간주하지 않습니다.

## 변경 빈도가 높은 설정

```bash
bash CICDtools/update_tech_article_config.sh gemini-key
bash CICDtools/update_tech_article_config.sh gemini-model
bash CICDtools/update_tech_article_config.sh crawler-identity
bash CICDtools/update_tech_article_config.sh auto-crawl
bash CICDtools/update_tech_article_config.sh service-token
```

한 번에 한 항목만 변경합니다. Gemini·크롤러 값은 파이프라인만, 자동 수집은 API만,
서비스 토큰은 API와 파이프라인만 재생성합니다. readiness 실패 시 루트 환경 파일을
바이트 단위의 이전 사본으로 되돌리고 이전 컨테이너 구성을 재적용합니다.

DB 자격 증명은 직접 편집하지 말고 다음을 사용합니다.

```bash
bash CICDtools/rotate_db_password.sh postgres
bash CICDtools/rotate_db_password.sh pipeline
```

두 경로 모두 먼저 통합 백업을 만듭니다. `pipeline`은 MySQL 앱 사용자와 root 비밀번호를
함께 변경한 뒤 MySQL, migration, 파이프라인만 재기동합니다. live MySQL 변경 이후의
재기동 단계가 실패하면 루트 `.env`는 DB와 일치하는 새 값으로 유지됩니다. 이전 값만
되돌리지 말고 오류 안내에 따라 재기동을 재시도하거나 직전 백업 세트를 복구합니다.

## 통합 migration, 백업, 검사, 복구

```bash
bash CICDtools/migrate_db.sh
bash CICDtools/backup_db.sh manual
bash CICDtools/inspect_backup.sh                 # 최신 세트
bash CICDtools/inspect_backup.sh 20260817_010203_manual
bash CICDtools/restore_db.sh 20260817_010203_manual
```

백업은 저장소 상위 `backups/<UTC timestamp>_<label>/`에 원자적으로 생성됩니다.

```text
postgres.sql.gz
pipeline-mysql.sql.gz        # 최초 파이프라인 도입 전이면 생략, metadata=NOT_PRESENT
files.tar.gz
metadata
SHA256SUMS
```

임시 디렉터리에서 두 dump, 압축 무결성, SHA-256을 검증한 뒤에만 최종 이름으로
이동합니다. `inspect_backup.sh`는 데이터 본문이나 비밀값을 출력하지 않고 체크섬,
압축 스트림, 스키마/테이블 이름, 파일 경로만 보여 줍니다.

복구는 하나의 일치하는 세트만 사용합니다. 체크섬 검증 후 API/파이프라인 writer를
중지하고 두 DB와 파일을 복구한 뒤 양쪽 migration, 재기동, 전체 health를 수행합니다.
예전 PostgreSQL 단독 파일은 명시적으로만 지원합니다.

```bash
bash CICDtools/inspect_backup.sh --legacy /path/to/db_backup_....sql.gz
bash CICDtools/restore_db.sh --legacy /path/to/db_backup_....sql.gz
```

legacy 복구는 PostgreSQL만 변경하고 파이프라인 MySQL과 파일은 건드리지 않습니다.

## 헬스체크와 제거

```bash
bash CICDtools/check_health.sh
```

검사 항목은 PostgreSQL/MySQL/API/pipeline/reverse-proxy 컨테이너 상태,
`pipeline-migrate` 종료 코드 0, API live, pipeline ready, reverse proxy 경유 공개 태그
API, `/tech-articles` SPA HTML입니다. Gemini 요청은 보내지 않습니다. 다른 공개 주소로
확인하려면 `CICD_PUBLIC_BASE_URL=https://...`를 지정합니다.

`ServerSetupRemove/server_quickremove.sh`는 PostgreSQL, pipeline MySQL,
Elasticsearch 볼륨과 저장소 디렉터리를 영구 삭제합니다. 스크립트 위치로 대상을 계산하고
정확한 저장소 이름까지 재확인하며, 자동 재부팅하지 않습니다.
