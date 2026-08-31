# web/tools

프런트엔드 개발용 도구입니다. **빌드 결과물에 포함되지 않고, 어디에도 배포되지 않습니다.**

- `Dockerfile.web` 은 최종 이미지에 `/app/dist` 만 복사합니다.
- CRA 는 `src/` 만 번들링하므로 이 디렉터리의 코드는 결과물에 들어갈 경로가 없습니다.
- 저장소의 다른 파일이 이 디렉터리를 참조하지 않습니다. 받아만 두면 아무 일도 일어나지 않고,
  직접 실행해야 동작합니다.

## dev.sh — 목 API + 개발 서버

```bash
cd web && bash tools/dev.sh
```

목 API(기본 3000번, `package.json` 의 `proxy` 값과 같아야 함)와 CRA 개발 서버(3100번)를
함께 띄웁니다. Ctrl+C 한 번으로 둘 다 종료됩니다.

**주의** — 평소 실제 API 를 3000번에 띄우신다면 이 스크립트를 실행하지 마세요. 가짜 데이터를
보게 됩니다. (포트가 이미 사용 중이면 스크립트가 그냥 종료하므로 조용히 가로채지는 않습니다.)

## mock-tech-articles-api.mjs — 기술 아티클 화면 전용 목 서버

```bash
PORT=4000 node tools/mock-tech-articles-api.mjs   # 단독 실행
```

관리자 목록·검수 큐·공개 화면과 크롤링 관리 화면이 쓰는 응답을 흉내 냅니다. 크롤링 실행
이력에는 대기·실행·재시도·완료·일부 성공·실패 상태가 포함됩니다. 실제 어댑터 계약과 같이
실행 중 숫자 진행률은 제공하지 않고, 여섯 가지 수집 통계는 종료 후에만 제공합니다. 백엔드나
DB 없이 화면을 확인할 때 씁니다. 로컬 로그인 화면에서는 비어 있지 않은 아이디와 비밀번호를
입력하면 데모 관리자로 로그인됩니다.

서버는 기본적으로 로컬 루프백 주소인 `localhost`에만 바인딩됩니다. 격리된 개발망에서 다른 기기의 접근이
꼭 필요한 경우에만 `MOCK_HOST=0.0.0.0`을 명시하세요. 이 경우 데모 관리자 인증도 함께
노출되므로 인터넷이나 공용 네트워크에서는 실행하면 안 됩니다.

### 서버 동작을 그대로 따라가야 하는 부분

이 파일은 실제 파이프라인의 규칙을 **베껴 둔 것**이라, 서버를 고치면 여기도 함께 고쳐야
로컬에서 본 화면이 운영과 같아집니다.

| 목 서버 | 대응하는 서버 코드 |
| --- | --- |
| `REACHABLE_STATES` | `persistence/mysql.py` 의 상태 전이 (도달 가능한 3축 조합) |
| `articleStage()` | `persistence/mysql.py` 의 `STAGE_PREDICATES` |
| `hasStatusMismatch()` | `persistence/mysql.py` 의 `STATUS_MISMATCH_PREDICATE` |
| `publicationQueue()` | `persistence/mysql.py` 의 `_review_conditions("publication")` |
| `applyPublication()` | `persistence/mysql.py` 의 `apply_publication_action` |
| `demoCrawlRuns` | crawl run/job 상태와 종료 시점의 공식 `CrawlRunCompleted.statistics` |
| `evaluationOf()` | 관리자 화면용 자기설명형 `score.axes`와 레거시 점수 호환 형태 |
| `publicValueScoreOf()` | 공개 화면용 `overall`, `scale`, 표시명·기여도만 있는 `breakdown` |
| 공개 상세의 헤더 분기 | NestJS Optional JWT 응답(`valueScore`는 회원 요청에만 포함) |
| 아티클당 태그 개수 | 요약기의 `maximumTagCount`(`contracts/models.py` 기본값 3) |
| `TAGS` | 요약기의 `ALLOWED_TAGS` 15개 |

공개 목록·상세 목 응답도 운영 API와 같은 allowlist를 사용한다. 따라서 공개 목록의
`source`에는 `name/domain`만, 상세에는 여기에 `path/articleUrl`만 추가되며 소스 ID·방식,
작성자, 내부 평가 버전·판정·근거·신호는 목 서버에서도 내려주지 않는다.

`applyPublication()` 의 `reviewStatus = "APPROVED"` 승격은 **알려진 서버 결함을 그대로 재현한
것**입니다. 서버에서 이 승격에 처리 단계 조건이 붙으면 이 줄도 함께 고쳐야 합니다.
