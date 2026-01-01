# 데이터베이스 백업 가이드

## 백업 폴더 구조

```
db/
├── backup.sh       # 백업 실행 스크립트
└── backups/        # 백업 파일 저장 위치
    └── backup_20260101_030000.sql.gz
```

---

## 수동 백업 실행

### 1. 스크립트 실행 권한 부여 (최초 1회)

```bash
chmod +x db/backup.sh
```

### 2. 백업 실행

```bash
./db/backup.sh
```

### 3. 백업 확인

```bash
ls -la db/backups/
```

---

## 주간 자동 백업 설정 (Cron)

서버에서 매주 일요일 새벽 3시에 자동 백업되도록 설정:

### 1. Crontab 편집

```bash
crontab -e
```

### 2. 아래 줄 추가

```bash
# 매주 일요일 새벽 3시에 DB 백업
# 분 시 일 월 요일 /경로/backup.sh >> /경로/db/backups/cron.log 2>&1
0 3 * * 0 /절대/경로/TCP_Website_2025/db/backup.sh >> /절대/경로/TCP_Website_2025/db/backups/cron.log 2>&1
```

> **Note**: `/절대/경로/`를 실제 프로젝트 경로로 변경하세요.

### 3. 설정 확인

```bash
crontab -l
```

---

## 백업 파일 복원

### 1. 백업 파일 압축 해제

```bash
gunzip db/backups/backup_20260101_030000.sql.gz
```

### 2. 복원 실행

```bash
docker exec -i db psql -U user -d mydb < db/backups/backup_20260101_030000.sql
```

---

## Docker 볼륨 설정

`docker-compose.yml`에 백업 폴더 마운트 설정됨:

```yaml
db:
  volumes:
    - db-data:/var/lib/postgresql/data
    - ./db/backups:/backups  # 호스트에서 백업 확인 가능
```

| 위치 | 경로 |
|------|------|
| 컨테이너 내부 | `/backups/` |
| 호스트 서버 | `./db/backups/` |

---

## 백업 보관 정책

- **자동 삭제**: 30일 이상 된 백업 파일은 자동 삭제됨
- **보관 기간 변경**: `db/backup.sh`의 `KEEP_DAYS` 값 수정

```bash
KEEP_DAYS=30  # 30일 → 원하는 기간으로 변경
```
