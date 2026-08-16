# 기술 아티클 v9 목업 후속 변경사항

이 문서는 이후 프론트엔드 구현 시 `work_source/tech-articles-vanilla-v9` 목업에서 변경해야
할 부분을 기록한다. 이번 API 작업에서는 목업과 프론트엔드 파일을 수정하지 않았다.

## 공개 화면

- 하드코딩된 12개 영문 slug 태그를 `GET /api/v1/tech-articles/tags`가 반환하는 파이프라인
  표준 태그 15개로 교체한다.
- 목록은 비로그인으로 조회하되 상세 요청에는 access token을 보낸다. 상세의 본문 영역은
  `summaryMarkdown`을 렌더링하며 수집 원문 전체를 기대하지 않는다.
- 목업의 `depth`, `freshness`, `sourceTrust` 가상 점수를 제거하고 실제 API의 `relevance`,
  `timeliness`, `sourceReliability`를 사용한다.
- 클라이언트 전체 배열 필터링 대신 서버의 `page`, `pageSize`, `keyword`, 반복 `tags`와
  `pagination`을 사용한다.

## 관리자 화면

- “영구 삭제” 버튼과 관련 경고 문구를 제거한다. 공개 중단은 `HIDE`, 장기 보관은
  `ARCHIVE` 액션을 사용한다.
- 실제 수정·재처리 단계가 없는 “수정 요청” 버튼을 제거한다.
- 인벤토리 및 검수 항목의 `recordVersion`/`caseVersion`을 보관해 변경 요청에 전송하고
  409 충돌 시 최신 항목을 다시 조회한다.
- 일괄 작업은 로컬 배열을 즉시 변경하지 말고 bulk API의 항목별 `SUCCEEDED`/`FAILED`
  결과를 반영한다. 부분 실패 항목은 선택 상태를 유지해 재시도할 수 있게 한다.
- 공개 검수 승인은 별도 가상 상태 변경이 아니라 `PUBLISH` publication action을 사용한다.

## v9에 없던 후속 UI

- `crawl-sources`의 허용 조합으로 수집 실행 폼을 구성하고, 반환된 `crawlRunId`로 상태를
  조회하는 관리자 화면이 필요하다. 임의 URL 입력은 만들지 않는다.
- 인벤토리에 `ARCHIVE` 액션과 `ARCHIVED` 필터를 추가한다.
- 공개 정책 변경 시 현재 `recordVersion`을 `expectedVersion`으로 보내도록 한다.

최종 경로와 요청·응답 예시는 `api/src/tech-articles/API.md`를 기준으로 한다.
