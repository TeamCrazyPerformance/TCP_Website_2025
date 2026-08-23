# TCP 기술 아티클 Admission 패키지

중복검사 v8, 정규화 기사 저장 v2, MySQL 구성 v2를 하나의 Python 라이브러리로 구현한 PL 통합용 패키지다. 자동 `UNIQUE` 판정과 `articles`·fingerprint·LSH bucket 저장은 반드시 하나의 MySQL transaction에서 commit 또는 rollback된다.

이 패키지는 독립 HTTP 서버나 worker가 아니다. PL coordinator가 정규화 직후 아래 공개 메서드 하나를 호출한다.

```python
result = admission_service.admit(article_admission_request)
```

중복검사와 저장을 서로 다른 두 호출로 나누지 않는다.

## 포함 범위

- Python 3.12 / Unicode 15.0.0 고정 검사
- NFKC·공백 정규화, SHA-256, Unicode 5-gram set
- 128-word MinHash, 16×8 LSH, exact Jaccard 최종 판정
- MySQL 8.4 LTS 후보 조회와 reference corpus 무결성 검사
- 자동 `UNIQUE`의 article·fingerprint·bucket 원자적 저장
- `DUPLICATE` 결과 저장, `POSSIBLE_DUPLICATE` 관리자 검토 case 저장
- 관리자 `APPROVE_UNIQUE`·`CONFIRM_DUPLICATE` 재검사와 멱등 resolution
- 기존 article fingerprint backfill
- activation gate가 기본으로 닫힌 영구 삭제 구현
- 순수 메모리 repository 기반 단위·동시성·rollback 테스트

품질 평가 호출, 메시지 broker/outbox, HTTP endpoint, Docker topology, 관리자 인증·UI는 PL 통합 범위다.

## 전달물 구조

```text
tech-article-admission/
├── migrations/001_article_admission.sql
├── examples/
├── src/tech_article_admission/
├── tests/
├── pyproject.toml
├── requirements.lock
└── README.md
```

## 설치

소스 폴더에서:

```bash
python3.12 -m pip install .
```

배포 wheel을 받았다면:

```bash
python3.12 -m pip install tcp_tech_article_admission-0.1.0-py3-none-any.whl
```

재현용 직접 의존성은 `requirements.lock`에 기록했다. PL 프로젝트의 중앙 lock 도구가 transitive dependency까지 다시 lock하는 것을 권장한다.

## MySQL 준비

1. `utf8mb4`로 만든 MySQL 8.4 database에 별도 migration 권한 계정으로 `migrations/001_article_admission.sql`을 한 번 적용한다.
2. runtime 계정에는 필요한 DML 권한만 준다. application startup에서 DDL을 실행하지 않는다.
3. 다음 환경변수를 runtime secret으로 설정한다.

```text
TECH_ARTICLE_MYSQL_HOST
TECH_ARTICLE_MYSQL_PORT=3306
TECH_ARTICLE_MYSQL_USER
TECH_ARTICLE_MYSQL_PASSWORD
TECH_ARTICLE_MYSQL_DATABASE
TECH_ARTICLE_MYSQL_POOL_NAME=tcp_article_admission
TECH_ARTICLE_MYSQL_POOL_SIZE=5
TECH_ARTICLE_MYSQL_CONNECT_TIMEOUT_SECONDS=10
```

4. startup readiness를 통과시킨다.

```python
from tech_article_admission import MySQLSettings, create_mysql_admission_service

service = create_mysql_admission_service(MySQLSettings.from_env())
service.check_readiness()
```

`check_readiness()`는 Python Unicode version과 migration `001` 적용 여부를 확인한다. admission 실행은 fingerprint가 빠진 current article이 하나라도 있으면 fail-closed한다.

## PL coordinator 통합

```python
result = service.admit(normalized_article_payload)

match result["outcome"]:
    case "ARTICLE_INGESTED":
        quality_input = result["articleIngested"]
    case "DUPLICATE_CHECK_COMPLETED":
        pass  # 자동 DUPLICATE이므로 신규 article 없음
    case "DUPLICATE_REVIEW_REQUESTED":
        review_case_id = result["reviewCase"]["reviewCaseId"]
    case "ADMISSION_FAILED":
        raise RuntimeError(result["error"])
```

반환값은 DB commit이 끝난 뒤에만 생성된다. 이후 품질 모듈 전달의 내구성은 실제 process topology를 아는 PL coordinator가 결정한다. commit 결과를 받지 못했다면 같은 payload를 다시 `admit()`하면 저장된 멱등 결과를 `NO_CHANGE`로 돌려준다.

`ArticleIngested`에 `source.sourceId`가 포함되므로 coordinator는 이를 품질 평가 입력으로 바로 투영할 수 있다. discovery, final URL, normalization을 포함한 원래 payload는 admission 내부에서 보존되며 중복검사 출력만으로 저장 입력을 복원하지 않는다.

## 관리자 검토

```python
result = service.resolve_review(
    {
        "schemaVersion": "1.0",
        "resolutionRequestId": "resolution-000001",
        "reviewCaseId": "review-case-id-from-admission",
        "expectedCaseVersion": 1,
        "action": "APPROVE_UNIQUE",
        "matchedArticleId": None,
        "administratorId": "admin-001",
        "resolvedAt": "2026-08-14T06:00:00Z",
    }
)
```

resolution은 최신 corpus를 global lock 안에서 다시 검사한다. 자동 `DUPLICATE`가 생기면 관리자 입력보다 안전한 자동 결과를 우선한다. 새 `POSSIBLE_DUPLICATE` 후보가 생기면 `REVIEW_STALE`로 case version을 올리고 다시 검토하게 한다.

## Backfill

기존 `articles`가 있지만 current fingerprint가 없다면 admission을 열기 전에 실행한다.

```python
report = service.backfill_missing_fingerprints(batch_size=100)
service.check_readiness()
```

fingerprint 계산은 lock 밖에서 하고, 저장 직전에 global lock과 article content version을 다시 확인한다. 동일 content hash의 legacy article이 발견되면 자동으로 하나를 선택하지 않고 중단한다.

## 영구 삭제 gate

기본 생성 함수는 영구 삭제를 거부한다.

```python
service = create_mysql_admission_service(
    MySQLSettings.from_env(),
    hard_delete_enabled=True,
)
```

`True`는 downstream FK inventory, cascade/restrict 정책, backup·restore, 통합 테스트, PL 승인이 모두 끝난 배포에서만 사용한다. 공개 목록 제외는 이 패키지의 hard delete 대신 전체 파이프라인의 `HIDDEN` 상태를 사용한다.

## 알려진 상위 계약 차이

상위 pipeline v3의 `duplicatePolicy` 필드는 그대로 받지만 실제 최종 판정은 v8 문서대로 본문 exact Jaccard `0.80/0.92`를 사용한다. URL·제목은 후보 검색·진단 근거이며 그것만으로 자동 판정을 바꾸지 않는다. 이 차이는 전체 파이프라인을 변경할 수 없던 상황에서 이미 합의한 통합 부채이며, 구현이 필드 의미를 몰래 재정의한 것이 아니다.

## 검증

```bash
ruff check .
pytest
python -m build --no-isolation
```

로컬 MySQL 8.4 테스트 DB와 `.env`를 준비한 뒤 실제 transaction 통합 검증은
다음으로 실행한다. 이 스크립트는 자신이 만든 article만 hard delete로 정리하고
check·resolution·deletion audit 기록은 의도적으로 남긴다.

```bash
PYTHONPATH=src python scripts/live_mysql_integration.py
```

MySQL 통합 전 PL이 확인할 항목:

- Python 3.12 이미지 사용
- MySQL 8.4 LTS와 migration `001` 적용
- runtime/migration credential 분리
- 정규화 모듈 출력이 `ArticleAdmissionRequest` 길이·UTC 조건 충족
- coordinator가 `outcome` 합타입을 모두 처리
- 품질 평가 전달 실패 시 같은 admission payload 재시도 경로 마련
- hard delete gate 기본 비활성화
- 운영 corpus로 v8 recall gate 측정
