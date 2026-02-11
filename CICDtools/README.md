# 🛠️ TCP Website CI/CD Tools Manual

이 문서는 `CICDtools` 디렉토리에 포함된 자동화 스크립트들의 사용법과 기능을 설명합니다.

모든 스크립트는 **실행 전 사용자 확인(Yes/No)** 절차를 거치며, **자동 백업**과 **로그 기록** 기능을 포함하고 있습니다.

---

## 📂 스크립트 목록 및 사용법

### 1. 🎨 프론트엔드 업데이트 (`update_frontend.sh`)
*   **기능:** `main` 브랜치에서 최신 코드를 받아와 React 앱을 빌드합니다.
*   **사용 시점:** 프론트엔드 코드(React, CSS, 이미지 등)가 변경되었을 때.
*   **실행 방법:**
    ```bash
    ./CICDtools/update_frontend.sh
    ```
*   **기대 효과:**
    *   `web/dist` 폴더가 최신 빌드본으로 교체됩니다.
    *   **무중단 배포:** Nginx가 새 파일을 즉시 서빙하므로 서버 다운타임이 없습니다.

### 2. ⚙️ 백엔드 업데이트 (`update_backend.sh`)
*   **기능:** 백엔드 코드를 받아와 Docker 이미지를 새로 빌드하고 컨테이너를 재시작합니다.
*   **사용 시점:** 백엔드 코드(NestJS, API 로직)가 변경되었을 때.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/update_backend.sh
    ```
*   **기대 효과:**
    *   API 서버가 최신 코드로 재시작됩니다.
    *   **짧은 중단:** 약 1~5초 간 API 요청이 실패할 수 있습니다.

### 3. 🐘 DB 마이그레이션 (`migrate_db.sh`)
*   **기능:** 스키마 변경 사항(테이블 생성/수정)을 운영 DB에 반영합니다.
*   **사용 시점:** 엔티티(Entity)나 DB 구조가 변경되었을 때.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/migrate_db.sh
    ```
    *(주의: 실행 시 'MIGRATE' 및 'YES' 입력 필요)*
*   **기대 효과:**
    *   데이터 손실 없이 DB 구조만 변경됩니다.
    *   일반적으로 무중단으로 처리됩니다.

### 4. 🌍 전체 업데이트 (`update_all.sh`)
*   **기능:** 위 3가지 과정(프론트 -> DB -> 백엔드)을 순차적으로 한 번에 수행합니다.
*   **사용 시점:** 대규모 배포나 전체 시스템 동기화가 필요할 때.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/update_all.sh
    ```
*   **기대 효과:**
    *   서버의 모든 구성요소가 최신 상태가 됩니다.

---

## 🛡️ 유지보수 및 안전 장치

### 5. 💾 DB 백업 (`backup_db.sh`)
*   **기능:** 현재 DB 데이터를 압축하여 `backups/` 폴더에 저장합니다.
*   **특징:**
    *   모든 업데이트 스크립트 실행 시 **자동으로 수행**됩니다.
    *   7일이 지난 오래된 백업 파일은 **자동 삭제**됩니다.
*   **수동 실행:**
    ```bash
    sudo ./CICDtools/backup_db.sh [라벨]
    ```

### 6. ♻️ DB 복구 (`restore_db.sh`)
*   **기능:** 가장 최신의 백업 파일을 이용해 DB를 **되돌립니다(Rollback)**.
*   **주의:** 현재 DB 데이터는 **모두 삭제**되고 백업 시점으로 덮어씌워집니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/restore_db.sh
    ```
    *(주의: 3단계 안전 확인 절차 통과 필요)*

### 7. 🏥 상태 확인 (`check_health.sh`)
*   **기능:** Docker 컨테이너 상태와 API 응답 여부를 확인합니다.
*   **실행 방법:**
    ```bash
    sudo ./CICDtools/check_health.sh
    ```

### 8. 🧐 백업 파일 검사 (`inspect_backup.sh`)
*   **기능:** 가장 최신 백업 파일의 용량과 내용을 미리보기 합니다.
*   **실행 방법:**
    ```bash
    ./CICDtools/inspect_backup.sh
    ```

---

## 📝 로그 시스템 (Logging)

모든 스크립트 실행 기록은 `CICDtools/logs/` 디렉토리에 저장됩니다.

*   **로그 파일명:** `execution_YYYY-MM-DD.log` (일자별 자동 생성)
*   **기록 내용:** 실행 시간, 실행 유저, 스크립트 이름, 상태(STARTED 등)
*   **자동 관리:** 30일이 지난 로그 파일은 자동 삭제됩니다.

---

## 🏗️ 서버 구축 및 제거 (`ServerSetupRemove/`)

이 스크립트들은 서버의 **초기 구축** 또는 **완전 삭제**와 같은 대규모 작업을 수행합니다. `CICDtools/ServerSetupRemove/` 디렉토리에 위치합니다.

### 9. 🚀 운영 서버 초기 구축 (`prodserver_quicksetup.sh`)
*   **기능:** 운영(Production) 환경을 처음부터 자동으로 구축합니다.
*   **포함 단계:**
    1.  권한 설정 및 필수 패키지 확인
    2.  `set_env.sh`를 호출하여 환경변수 설정 (대화형)
    3.  프론트엔드/백엔드 빌드
    4.  Docker 컨테이너 실행 및 DB 초기화 (Migration, Seed)
*   **사용 시점:** 새로운 서버를 프로비저닝 할 때 (최초 1회).
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/prodserver_quicksetup.sh
    ```
    *(주의: `SETUP` 키워드 입력 및 3단계 인증 필요)*
*   **기대 효과:**
    *   빈 서버가 서비스 가능한 상태로 완벽하게 세팅됩니다.

### 10. 🛠️ 개발 서버 초기 구축 (`devserver_quicksetup.sh`)
*   **기능:** 개발(Dev) 환경을 구축합니다. `docker-compose.dev.yml`을 사용합니다.
*   **사용 시점:** 로컬이나 개발용 서버에서 테스트 환경을 만들 때.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/devserver_quicksetup.sh
    ```
    *(주의: `SETUP` 키워드 입력 및 3단계 인증 필요)*
*   **기대 효과:**
    *   코드 변경 사항을 즉시 반영할 수 있는 개발 환경이 구성됩니다.

### 11. 🔥 서버 완전 삭제 (`server_quickremove.sh`)
*   **기능:** 모든 Docker 컨테이너, 볼륨, 프로젝트 파일을 삭제하고 서버를 **초기화(재부팅)** 합니다.
*   **사용 시점:** 서버를 폐기하거나, 완전히 새로 세팅하기 위해 데이터를 날릴 때.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/server_quickremove.sh
    ```
    *(주의: `DESTROY` 키워드 입력 및 3단계 인증 필요. **데이터 복구 불가**)*
*   **기대 효과:**
    *   프로젝트와 관련된 모든 데이터가 영구적으로 삭제됩니다.
    *   시스템이 재부팅되어 클린 상태가 됩니다.

### 12. 🔧 환경변수 설정 마법사 (`set_env.sh`)
*   **기능:** `envs/` 디렉토리의 환경변수 파일(`api.env`, `db_prod.env`)을 대화형으로 생성합니다.
*   **특징:**
    *   **JWT Secret:** 자동 생성 (보안 강화)
    *   **DB Password:** 공개 입력 (입력값 화면 표시)
    *   **Admin Account:** 관리자 계정 정보 필수 입력 강제
*   **사용 시점:** `prodserver_quicksetup.sh` 실행 시 자동으로 호출되거나, 수동으로 환경변수를 재설정할 때.
*   **실행 방법:**
    ```bash
    ./CICDtools/ServerSetupRemove/set_env.sh
    ```

