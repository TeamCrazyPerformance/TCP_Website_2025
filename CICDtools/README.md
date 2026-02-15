# 🛠️ TCP Website CI/CD Tools Manual

이 문서는 `CICDtools` 디렉토리에 포함된 자동화 스크립트들의 사용법과 기능을 설명합니다.

모든 스크립트는 **실행 전 사용자 확인(Yes/No)** 절차를 거치며, **자동 백업**, **로그 기록**, **Git 충돌 방지**, **무중단 배포(Frontend)** 기능을 포함하고 있습니다.

---

## 📂 디렉토리 구조 및 핵심 기능

```
CICDtools/
├── update_frontend.sh      # 🎨 프론트엔드 무중단 업데이트
├── update_backend.sh       # ⚙️ 백엔드 업데이트 (컨테이너 재시작)
├── migrate_db.sh           # 🐘 DB 마이그레이션 도구
├── update_all.sh           # 🌍 전체 업데이트 (순차 실행)
├── check_health.sh         # 🏥 상태 점검
├── backup_db.sh            # 💾 데이터 백업
├── restore_db.sh           # ♻️ 데이터 복구
├── inspect_backup.sh       # 🧐 백업 파일 검사
├── utils/                  # 🔧 공통 유틸리티 (New!)
│   ├── common_logging.sh   #    - 통합 로깅 시스템 (색상, 파일 저장)
│   └── git_utils.sh        #    - Git 충돌 사전 감지 (Pre-flight Check)
└── ServerSetupRemove/      # 🏗️ 서버 구축/제거 도구
    └── set_env.sh          #    - 보안 환경변수 자동 생성
```

### ✨ 주요 개선 사항
1.  **무중단 프론트엔드 배포:** `dist_temp`에 빌드 후 성공 시에만 교체(Atomic Swap)하여 다운타임을 제거했습니다.
2.  **Git 충돌 사전 감지 (Pre-flight Check):** `git pull` 전에 로컬 변경사항이나 브랜치 충돌 여부를 미리 확인하고 경고합니다.
3.  **통합 로깅:** 모든 실행 기록은 `CICDtools/logs/`에 색상과 함께 저장됩니다.
4.  **보안 환경 설정:** `set_env.sh`가 비밀번호를 자동 생성하여 보안성을 강화했습니다.

---

## 📂 스크립트 목록 및 사용법

### 1. 🎨 프론트엔드 업데이트 (`update_frontend.sh`)
*   **기능:** `main` 브랜치 코드를 받아 React 앱을 빌드하고 배포합니다.
*   **특징:** **무중단 배포 (Zero-Downtime)** 를 지원합니다. 빌드 실패 시 기존 사이트에 영향을 주지 않습니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/update_frontend.sh
    ```

### 2. ⚙️ 백엔드 업데이트 (`update_backend.sh`)
*   **기능:** 백엔드 코드를 받아 API 컨테이너를 재빌드하고 실행합니다.
*   **특징:** 컨테이너 재시작 시간(약 1~5초) 동안만 짧은 중단이 발생합니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/update_backend.sh
    ```

### 3. 🐘 DB 마이그레이션 (`migrate_db.sh`)
*   **기능:** TypeORM 마이그레이션을 실행하여 DB 스키마를 변경합니다.
*   **안전 장치:** 실행 전 'MIGRATE' 및 'YES' 입력 3단계 확인 절차가 있습니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/migrate_db.sh
    ```

### 4. 🌍 전체 업데이트 (`update_all.sh`)
*   **기능:** [프론트엔드 -> DB 마이그레이션 -> 백엔드] 순서로 전체 시스템을 업데이트합니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/update_all.sh
    ```

---

## 🛡️ 유지보수 및 안전 장치

### 5. 💾 DB 백업 (`backup_db.sh`)
*   **기능:** DB 덤프와 주요 파일(uploads, logs)을 `backups/`에 저장합니다.
*   **특징:** 업데이트 스크립트 실행 시 **자동 수행**되며, 오래된 백업은 자동 삭제됩니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/backup_db.sh [라벨]
    ```

### 6. ♻️ DB 복구 (`restore_db.sh`)
*   **기능:** 최신 백업 파일로 시스템을 되돌립니다. (데이터 덮어쓰기)
*   **주의:** **모든 데이터가 삭제**되고 백업 시점으로 복구됩니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/restore_db.sh
    ```

### 7. 🏥 상태 확인 (`check_health.sh`)
*   **기능:** Docker 컨테이너 상태와 API 응답을 점검합니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/check_health.sh
    ```

### 8. 🧐 백업 파일 검사 (`inspect_backup.sh`)
*   **기능:** 백업 파일의 내용과 테이블 구조를 미리 확인합니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/inspect_backup.sh
    ```

---

## 🏗️ 서버 구축 및 환경 설정 (`ServerSetupRemove/`)

### 9. � 보안 환경변수 설정 (`set_env.sh`)
*   **기능:** 운영 서버용 환경변수 파일(`api.env`, `db_prod.env`)을 안전하게 생성합니다.
*   **보안 강화:**
    *   **자동 생성:** `JWT_SECRET`, `DB_PASSWORD` 등은 랜덤 난수로 자동 생성됩니다.
    *   **고정값:** 포트 등은 표준값으로 자동 설정됩니다.
    *   **수동 입력:** 관리자(Admin) 계정 정보만 입력하면 됩니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/set_env.sh
    ```

### 10. � 운영 서버 초기 구축 (`prodserver_quicksetup.sh`)
*   **기능:** 빈 서버에 필요한 모든 패키지 설치부터 실행까지 한 번에 처리합니다. 내부적으로 `set_env.sh`를 호출합니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/prodserver_quicksetup.sh
    ```

### 11. 🔥 서버 완전 삭제 (`server_quickremove.sh`)
*   **기능:** 서버의 모든 데이터와 컨테이너를 파괴하고 초기화합니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/server_quickremove.sh
    ```

---

### 12. � DB 비밀번호 변경 (`rotate_db_password.sh`)
*   **기능:** 운영 중인 DB의 비밀번호를 안전하게 변경하고 API 서버에 적용합니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/rotate_db_password.sh
    ```
    *(주의: `ROTATE` 입력 확인 필요. API 재시작으로 인한 1~5초 순단 발생)*

---

## �🚦 운영 시나리오 가이드 (Operational Scenarios)

### ✨ 상황별 추천 절차

| 상황 | 실행 스크립트 | 설명 |
| :--- | :--- | :--- |
| **코드 업데이트** (Routine) | `sudo ./CICDtools/update_all.sh` | Git Pull -> 빌드 -> 배포 -> 마이그레이션을 한 번에 처리합니다. <br> **가장 많이 사용하게 될 명령어입니다.** |
| **환경변수 변경** (Config) | 1. `envs/` 파일 수정 <br> 2. `sudo ./CICDtools/update_all.sh` | 포트, API 키 등을 변경했다면 파일을 수정한 뒤 `update_all.sh`로 재배포하여 적용합니다. |
| **DB 비밀번호 변경** (Security) | `sudo ./CICDtools/rotate_db_password.sh` | **운영 중인 DB**의 비밀번호를 바꿔야 한다면 반드시 이 전용 스크립트를 사용하세요. <br> (`set_env.sh`로 바꾸면 DB 접속 장애 발생함) |
| **서버 초기 구축** (Setup) | `./CICDtools/ServerSetupRemove/prodserver_quicksetup.sh` | 새 서버 세팅 시에만 사용합니다. |

### ❓ 환경변수(Env)를 자주 바꾸면 안 되나요?
매번 배포할 때마다 `set_env.sh`를 실행하여 환경변수를 재생성하는 것은 **권장하지 않습니다.**
1.  **사용자 로그아웃:** `JWT_SECRET`이 바뀌면 모든 사용자의 로그인 토큰이 무효화되어 강제 로그아웃됩니다.
2.  **DB 접속 장애:** `DB_PASSWORD`가 바뀌면 실행 중인 DB 컨테이너와 비밀번호가 불일치하여 접속이 불가능해집니다.
3.  **안정성:** 환경변수는 '상수'처럼 취급하여, 꼭 필요한 경우(보안 사고, 설정 변경)에만 신중하게 변경하는 것이 운영 안정성에 좋습니다.

**결론:** 평소에는 **`update_all.sh`** 만 실행하세요! 🚀
