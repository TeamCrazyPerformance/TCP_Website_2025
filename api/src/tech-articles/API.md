# 기술 아티클 API v1

이 문서는 외부 클라이언트가 사용하는 최종 계약이다. NestJS만 외부에 노출하며 Python
파이프라인의 `/internal/v1` 경로와 서비스 토큰은 클라이언트에서 사용하지 않는다.

## 공통 규칙

- 모든 날짜는 UTC ISO 8601 문자열이다.
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

- `GET /api/v1/admin/tech-articles`: `page`, `pageSize`, `keyword`, `publicationStatus`,
  `sort=NEWEST|SCORE_DESC|SCORE_ASC`.
- `GET /api/v1/admin/tech-articles/stats`: 공개·처리 상태별 개수와 세 검수 큐 개수.
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
- `GET /api/v1/admin/tech-articles/crawl-runs/:crawlRunId`: 비동기 실행 상태 조회.

수집 본문은 등록된 `sourceId`, `sourceType`, `sectionKey`와 제한된 `crawlOptions`만 받는다.
임의 URL, 직접 정규화 제출, 저수준 job 조회, 영구 삭제는 외부 API에 없다.
