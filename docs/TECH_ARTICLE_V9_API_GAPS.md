# 기술 아티클 v9 통합 완료 현황

v9 목업을 기준으로 한 프론트엔드와 API 연동이 완료됐다. 이 문서는 더 이상 후속 변경
목록이 아니라 현재 구현 계약과 운영 확인 항목을 기록한다. 최종 HTTP 계약은
`api/src/tech-articles/API.md`가 기준이다.

## 완료된 공개 화면

- API가 반환하는 15개 표준 태그와 반복 `tags` OR 필터를 사용한다.
- 공개 목록은 비로그인, 상세는 JWT 인증 요청으로 분리됐다.
- 상세에는 원문 대신 `summaryMarkdown`을 렌더링한다.
- 목업의 가상 점수 대신 `relevance`, `timeliness`, `sourceReliability`를 표시한다.
- 목록은 서버 pagination, keyword, tags와 원문 게시일 최신순 계약을 사용한다.

## 완료된 관리자 화면

- 영구 삭제 대신 `HIDE`와 `ARCHIVE`를 사용하고, 실행 경로가 없던 “수정 요청”을 제거했다.
- 인벤토리와 세 검수 큐가 서버 검색·필터·pagination을 사용한다.
- `recordVersion`/`caseVersion`을 변경 요청에 보내며 409 충돌 시 재조회한다.
- 게시·중복·품질 bulk 응답의 입력 순서별 성공/실패를 처리한다.
- 등록된 수집 소스 조합만 사용하는 crawl 실행/상태 조회와 보관 흐름이 연결됐다.

## 배포 완료 조건

`CICDtools/update_all.sh`가 파이프라인과 NestJS API를 먼저 검증한 뒤 새 프론트 번들을
활성화한다. `check_health.sh`가 reverse proxy 경유 태그 API와 `/tech-articles` SPA를
모두 확인하므로, 서버에서는 이 스크립트가 성공해야 기능 배포 완료로 판단한다.
