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

관리자 목록·검수 큐·공개 화면이 쓰는 응답만 흉내 냅니다. 백엔드나 DB 없이 화면을 확인할 때
씁니다.

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

`applyPublication()` 의 `reviewStatus = "APPROVED"` 승격은 **알려진 서버 결함을 그대로 재현한
것**입니다. 서버에서 이 승격에 처리 단계 조건이 붙으면 이 줄도 함께 고쳐야 합니다.
