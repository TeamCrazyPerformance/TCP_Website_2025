# 기술 아티클 API v1

이 문서는 외부 클라이언트가 사용하는 최종 계약이다. NestJS만 외부에 노출하며 Python
파이프라인의 `/internal/v1` 경로와 서비스 토큰은 클라이언트에서 사용하지 않는다.

## 공통 규칙

- 모든 날짜는 UTC ISO 8601 문자열이다.
- `originalPublishedAt`은 소스가 제공한 원문 게시 시각을 사용한다. 원문 게시 시각을
  제공하지 않는 GitHub Trending만 예외로 해당 항목의 `crawl.crawledAt` 관측 시각을
  사용하며, 파이프라인 내부 경고에 근사값임을 기록한다.
- 페이지 응답은 `pagination: { totalCount, currentPage, totalPages, pageSize }`를 사용한다.
- 회원 API는 `Authorization: Bearer <access-token>`, 관리자 API는 ADMIN 권한까지 필요하다.
- 버전이 바뀐 검수·게시 요청은 `409 VERSION_CONFLICT`를 반환한다.
- 파이프라인 장애·timeout·설정 누락은 `503 TECH_ARTICLE_PIPELINE_UNAVAILABLE`로 정규화한다.
- 외부 응답에는 수집 원문 `content`와 `localizedContent`가 포함되지 않는다.

## 공개 및 회원 API

### `GET /api/v1/tech-articles`

인증 없이 공개된 기술 아티클 티저를 조회한다.

| Query | 기본값 | 제약 |
| --- | --- | --- |
| `page` | `1` | 1 이상 |
| `pageSize` | `20` | 1~100 |
| `keyword` | 없음 | 최대 100자, 제목·AI 한 줄 요약 검색 |
| `tags` | 없음 | 같은 키를 반복하며 최대 15개, OR 조건 |

```json
{
  "items": [
    {
      "id": "article-20260816-000001",
      "title": "한국어 표시 제목",
      "oneLineSummary": "AI 한 줄 요약",
      "tags": ["AI", "데이터"],
      "source": {
        "id": "infoq",
        "name": "InfoQ",
        "type": "RSS",
        "domain": "infoq.com",
        "path": "/articles/example",
        "articleUrl": "https://www.infoq.com/articles/example"
      },
      "originalLanguage": { "code": "en", "label": "영어" },
      "originalPublishedAt": "2026-08-15T00:00:00Z",
      "collectedAt": "2026-08-15T01:00:00Z",
      "score": 88
    }
  ],
  "pagination": { "totalCount": 1, "currentPage": 1, "totalPages": 1, "pageSize": 20 },
  "lastCrawledAt": "2026-08-15T01:00:00Z"
}
```

### `GET /api/v1/tech-articles/tags`

파이프라인의 표준 태그 15개를 `{"items": ["AI", ...]}` 형태로 반환한다.

### `GET /api/v1/tech-articles/:articleId`

로그인 회원만 사용할 수 있다. 목록 필드와 `authors`, `summaryMarkdown`, 실제 품질 평가를
반환한다. 공개 상태가 아니거나 처리 완료 전인 아티클은 404이다.

```json
{
  "id": "article-20260816-000001",
  "title": "한국어 표시 제목",
  "authors": ["Example Author"],
  "summaryMarkdown": "## AI 상세 요약",
  "evaluation": {
    "decision": "PASS",
    "reason": "품질 기준점 이상입니다.",
    "signals": {},
    "score": {
      "overall": 88,
      "relevance": 91,
      "timeliness": 87,
      "sourceReliability": 84
    }
  }
}
```

## 관리자 조회 API

- `GET /api/v1/tech-articles`: `page`, `pageSize`, `keyword`, `tags`(반복),
  `sources`(반복). 소스는 파이프라인 카탈로그로 검증하며, 모르는 값이면 422 입니다.
  각 항목의 `isNew` 는 수집 후 24시간 이내인지를 서버가 판정한 값입니다 —
  기준을 프런트에 두면 바꿀 때마다 재배포해야 합니다.
- `GET /api/v1/tech-articles/sources`: 소스 선택기용 목록(`id`, `name`, `domain`,
  `category`, 공개 건수 `count`). 소스는 계속 늘어나므로 목록 응답에 얹지 않고
  `tags` 와 같은 방식으로 따로 둡니다.
- 아티클 상세(`GET /api/v1/tech-articles/{articleId}`)는 조회수를 집계합니다.
  미들웨어가 **응답이 끝난 뒤 상태 코드를 보고** 셉니다.

  | 응답 | 판정 | 이유 |
  |---|---|---|
  | `200`·`304` | 회원 열람 | `304`는 브라우저 캐시 재검증. 본문만 생략됐을 뿐 열람입니다 |
  | `401` (토큰 없음) | 비회원 열람 시도 | 로그인하지 않은 요청 |
  | `401` (토큰 있음) | 세지 않음 | 만료된 회원. 프런트가 갱신 후 재시도해 `200`으로 잡힙니다 |
  | `404`·`5xx` | 세지 않음 | 비공개·보관·없는 아티클이거나 우리 쪽 실패 |

  상태 코드는 가드와 컨트롤러의 최종 판정이라, 서명만 맞고 실제로는 거부되는
  토큰(로그아웃·refresh 토큰 등)이 회원으로 잘못 잡히지 않습니다. 사용자별
  이력은 남기지 않으며, 집계는 관리자 응답(`viewCounts`)에만 실리고 공개
  응답에는 없습니다.
- `GET /api/v1/admin/tech-articles`: `page`, `pageSize`, `keyword`, `publicationStatus`,
  `stage=INGESTED|QUALITY_REVIEW|ENRICHING|PUBLICATION_REVIEW|COMPLETED|FAILED_AFTER_APPROVAL|FAILED|QUALITY_REJECTED`,
  `statusMismatch=true`, `sort=NEWEST|OLDEST|SCORE_DESC|SCORE_ASC`. `stage` 와
  `statusMismatch` 는 선택이며, 없으면 전체를 돌려줍니다. 둘은 별개 축이라 함께
  쓸 수 있습니다. 각 항목에는 같은 규칙으로 계산된 `stage` 가 함께 옵니다.
- `GET /api/v1/admin/tech-articles/stats`: `keyword`, `publicationStatus` 를 받습니다.
  **목록과 같은 조건으로 세야 칩 숫자와 목록 총계가 같은 모집단을 가리킵니다.**
  단계(`stage`)는 받지 않습니다 — 넣으면 고른 단계만 남고 나머지 칩이 0 이 됩니다.
  응답은 공개·처리 상태별 개수, 단계별 개수(`stages`, 0 건인 단계도 키를 유지),
  단계별 최장 체류 시각(`stageOldest`), `statusMismatch`(검토 상태 표시 오류),
  그리고 `reviews`(검수 큐 개수)입니다. 앞의 넷은 위 필터를 따르고, `reviews` 는
  다른 테이블이라 항상 전체입니다. `stageOldest` 는 `updated_at` 기준이라 "마지막 수정"
  시각이며 "단계 진입" 시각의 하한으로만 읽어야 합니다.
- `GET /api/v1/admin/tech-articles/:articleId`: 원문을 제외한 관리자 상세 projection.
- `GET /api/v1/admin/tech-articles/reviews/duplicates`: `filter=JACCARD`,
  `sort=NEWEST|SIMILARITY_DESC`.
- `GET /api/v1/admin/tech-articles/reviews/quality` 및 `/reviews/publication`:
  `filter=RSS|WEB_CRAWL|API`, `sort=NEWEST`.

모든 목록은 공통 페이지 메타데이터를 반환한다. 검수 항목에는 후속 요청에 필요한
`caseVersion` 또는 `recordVersion`이 포함된다.

## 관리자 변경 API

### 게시 상태

- `POST /api/v1/admin/tech-articles/:articleId/publication-actions`
- `POST /api/v1/admin/tech-articles/publication-actions/bulk`

단건 본문은 아래 형식이며 액션은 `PUBLISH`, `HIDE`, `ARCHIVE`만 허용한다.

```json
{ "action": "HIDE", "expectedRecordVersion": 3, "reason": "관리자 판단" }
```

### 중복·품질 판정

- `POST /api/v1/admin/tech-articles/reviews/duplicates/:caseId/resolutions`
- `POST /api/v1/admin/tech-articles/reviews/duplicates/resolutions/bulk`
- `POST /api/v1/admin/tech-articles/reviews/quality/:caseId/resolutions`
- `POST /api/v1/admin/tech-articles/reviews/quality/resolutions/bulk`

중복 액션은 `APPROVE_UNIQUE|CONFIRM_DUPLICATE`, 품질 액션은 `APPROVE|REJECT`다.
`CONFIRM_DUPLICATE`에만 `matchedArticleId`가 필요하다. 관리자 ID와 처리 시각은 서버가
JWT와 서버 시각으로 생성한다.

품질 검수 `APPROVE`가 성공하면 AI 후처리 작업이 비동기로 생성된다. 승인은 요약 완료를
의미하지 않으며 처리 상태는 `ENRICHMENT_PENDING`을 거쳐 `ENRICHED` 또는
`PROCESSING_FAILED`로 변경될 수 있다. 원래 `REVIEW_REQUIRED` 판정과 세부 품질 점수는
관리자 조회를 위해 그대로 보존된다.

Bulk 본문은 `{"items": [...]}`이며 최대 50개, ID 중복 금지다. 유효한 요청은 일부 항목이
실패해도 HTTP 200을 반환하고 입력 순서대로 다음 결과를 제공한다.

```json
{
  "results": [
    { "id": "article-1", "status": "SUCCEEDED", "data": {} },
    { "id": "article-2", "status": "FAILED", "error": { "statusCode": 409, "code": "VERSION_CONFLICT" } }
  ],
  "summary": { "total": 2, "succeeded": 1, "failed": 1 }
}
```

### 공개 정책과 수집

- `GET/PATCH /api/v1/admin/tech-articles/publication-policy`
  - PATCH: `{"policy":"IMMEDIATE|REVIEW","expectedVersion":1}`.
- `GET /api/v1/admin/tech-articles/crawl-sources`: 허용된 소스 조합과 옵션 범위.
- `POST /api/v1/admin/tech-articles/crawl-runs`: `Idempotency-Key` 헤더 필수, HTTP 202.
- `GET /api/v1/admin/tech-articles/crawl-runs`: 최신순 실행 이력과 상태·시각·재시도·종료 결과.
- `GET /api/v1/admin/tech-articles/crawl-runs/:crawlRunId`: 비동기 실행 상태 조회.

수집 본문은 등록된 `sourceId`, `sourceType`, `sectionKey`와 제한된 `crawlOptions`만 받는다.
임의 URL, 직접 정규화 제출, 저수준 job 조회, 영구 삭제는 외부 API에 없다.
관리자 요청은 서버가 `MANUAL`, 자동 스케줄 요청은 `SCHEDULED`로 기록한다. 이력과
상세 응답은 실행·소스·시각·시도 횟수·최종 통계·저장 건수 및
`error: {code, message, retryable}`만 제공한다. 요청 원문, job 결과, lease token,
수집 항목의 `rawArticle`은 관리자 응답에도 포함하지 않는다.
현재 소스 어댑터는 실행이 끝난 뒤 하나의 완료 배치를 반환하므로 실행 중 페이지·아티클
진행률은 제공하지 않는다. 대기·실행·재시도 중에는 실행 상태, 시각, 시도 횟수와 오류만
표시하며, `statistics`와 저장 항목 수는 종료 후 확정 결과로만 사용한다. 종료 통계는
`pagesVisited`, `articlesDiscovered`, `articlesExcludedByAge`, `articlesAttempted`,
`articlesSucceeded`, `articlesFailed` 여섯 항목이다. `maximumArticleCount`는 발견 총량이
아니라 상한이므로 진행률의 분모로 사용하지 않는다.

GitHub Trending은 `github-trending / WEB_CRAWL / REPOSITORIES` 조합만 허용한다.
`maximumArticleCount`는 1~3, `maximumPageCount`는 1, `followPagination`은 false다.
카탈로그는 이 소스에 `maximumArticleCount`와 `requestTimeoutMs`만 노출한다.
Trending 순위·기간·star/fork는 내부 crawl/discovery 기록에만 보존하며 현재
관리자·공개 아티클 응답에는 투영하지 않는다. 수집 관측 시각은 원문 게시일이 없는
이 소스의 `originalPublishedAt`으로 투영한다. 이 메타데이터들은 README 기반
콘텐츠에 접두 정보로 삽입하지 않는다.
