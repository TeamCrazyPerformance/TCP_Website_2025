(() => {
  "use strict";

  const view = document.body.dataset.adminView || "inventory";
  const app = document.querySelector("#adminApp");
  const PAGE_SIZE = { inventory: 5, duplicates: 4, reviews: 4 };
  let toastTimer = 0;
  let confirmHandler = null;
  let confirmCancelHandler = null;

  const articleSeeds = [
    {
      id: "art_01JZ8F4S3K2A",
      crawlId: "crawl_01JZ8F2C9R6M",
      title: "Node.js 이벤트 루프 지연을 추적해 API 응답 병목 찾기",
      oneLine: "이벤트 루프 지연과 비동기 작업 시간을 함께 측정해 평균 응답 시간만으로 발견하기 어려운 병목을 분석합니다.",
      summary: "## 핵심 내용\n\nNode.js 서비스의 느린 응답을 조사할 때 평균 응답 시간만 보면 원인을 놓치기 쉽습니다. 이 글은 이벤트 루프 지연과 작업별 실행 시간을 함께 기록해 병목 구간을 좁히는 절차를 설명합니다.\n\n## 실무 적용\n\n- 지연 분포를 백분위수로 관찰합니다.\n- 외부 I/O와 CPU 집약 작업을 분리해서 측정합니다.\n- 변경 전후의 동일한 트래픽 구간을 비교합니다.",
      tags: ["백엔드", "클라우드/DevOps", "데이터/DB", "언어/프레임워크"],
      source: "Backend Notes",
      sourceId: "src_backend_notes",
      sourceType: "RSS",
      sourcePath: "/engineering/node",
      language: "영어 (en)",
      score: 82,
      original: "2026-08-07T09:10:00+09:00",
      crawled: "2026-08-07T09:34:00+09:00",
      publication: "PUBLISHED",
      review: "APPROVED",
    },
    {
      id: "art_01JZ7W9MN4QH",
      crawlId: "crawl_01JZ7W5X8B9K",
      title: "RAG 품질을 높이는 검색 파이프라인 평가 지표 설계",
      oneLine: "검색 정확도와 답변 충실도를 나누어 측정하고 실제 질문을 회귀 테스트로 구성하는 과정을 소개합니다.",
      summary: "## 평가 기준 분리\n\n검색 단계와 생성 단계를 하나의 점수로 합치지 않고, 검색 적합도·근거 충실도·답변 완결성을 각각 측정합니다.\n\n## 권장 절차\n\n1. 실제 사용자 질문에서 대표 표본을 만듭니다.\n2. 검색 실패와 생성 실패를 별도로 분류합니다.\n3. 변경 때마다 같은 표본으로 회귀 테스트를 실행합니다.",
      tags: ["AI/ML", "데이터/DB", "백엔드"],
      source: "ML Systems Review",
      sourceId: "src_ml_systems_review",
      sourceType: "WEB_CRAWL",
      sourcePath: "/rag/evaluation",
      language: "영어 (en)",
      score: 91,
      original: "2026-08-06T15:20:00+09:00",
      crawled: "2026-08-06T16:02:00+09:00",
      publication: "PUBLISHED",
      review: "NOT_REQUIRED",
    },
    {
      id: "art_01JZ6Q1DC8NV",
      crawlId: "crawl_01JZ6PY9G5TF",
      title: "React 애플리케이션의 불필요한 리렌더링을 줄이는 네 가지 점검법",
      oneLine: "React DevTools와 컴포넌트 경계를 활용해 반복 렌더링의 원인을 찾고 개선 효과를 검증합니다.",
      summary: "## 무엇을 먼저 볼 것인가\n\n렌더링 횟수 자체보다 사용자가 체감하는 지연과 연결된 컴포넌트를 먼저 확인합니다. props 참조 안정성, Context 범위, 비싼 계산을 차례로 점검합니다.\n\n- 프로파일러로 기준값 기록\n- 컴포넌트 경계 조정\n- 같은 시나리오로 개선 효과 확인",
      tags: ["프론트엔드", "언어/프레임워크"],
      source: "Frontend Lab",
      sourceId: "src_frontend_lab",
      sourceType: "RSS",
      sourcePath: "/react/performance",
      language: "한국어 (ko)",
      score: 78,
      original: "2026-08-05T11:40:00+09:00",
      crawled: "2026-08-05T12:05:00+09:00",
      publication: "HIDDEN",
      review: "APPROVED",
    },
    {
      id: "art_01JZ5J7VK3PE",
      crawlId: "crawl_01JZ5J2M6L7A",
      title: "Kubernetes 비용을 줄이기 전에 확인할 리소스 요청·제한 설정",
      oneLine: "CPU와 메모리 요청값이 실제 사용량과 다를 때의 문제를 살피고 안전한 조정 순서를 설명합니다.",
      summary: "## 비용보다 먼저 안정성\n\n리소스 요청값을 낮추기 전에 스로틀링, OOM 종료, 노드 축출 가능성을 함께 살펴야 합니다. 관측 기간을 충분히 확보하고 워크로드별로 단계적으로 조정하는 방법을 제안합니다.",
      tags: ["클라우드/DevOps", "백엔드", "아키텍처"],
      source: "Cloud Operations Journal",
      sourceId: "src_cloud_ops",
      sourceType: "WEB_CRAWL",
      sourcePath: "/kubernetes/cost",
      language: "영어 (en)",
      score: 86,
      original: "2026-08-04T13:00:00+09:00",
      crawled: "2026-08-04T13:31:00+09:00",
      publication: "PUBLISHED",
      review: "APPROVED",
    },
    {
      id: "art_01JZ4BD7YQ1S",
      crawlId: "crawl_01JZ4B91E8CW",
      title: "브라우저 OAuth 흐름에서 PKCE와 state를 안전하게 검증하는 방법",
      oneLine: "인증 코드 탈취와 로그인 CSRF를 방지하기 위한 PKCE, state, redirect URI 검증 순서를 살펴봅니다.",
      summary: "## 방어 지점\n\n클라이언트가 생성한 verifier와 state를 콜백 시점까지 안전하게 연결하고, 등록된 redirect URI를 정확히 비교해야 합니다. 각 값의 수명과 실패 처리 원칙도 함께 다룹니다.",
      tags: ["보안", "프론트엔드", "백엔드"],
      source: "Secure Web Engineering",
      sourceId: "src_secure_web",
      sourceType: "RSS",
      sourcePath: "/oauth/browser",
      language: "영어 (en)",
      score: 89,
      original: "2026-08-03T08:50:00+09:00",
      crawled: "2026-08-03T09:14:00+09:00",
      publication: "PUBLISHED",
      review: "NOT_REQUIRED",
    },
    {
      id: "art_01JZ3A6P4WFM",
      crawlId: "crawl_01JZ3A1B9KQS",
      title: "오프라인 우선 모바일 앱의 충돌 없는 데이터 동기화 설계",
      oneLine: "불안정한 네트워크에서도 변경을 보존하기 위한 로컬 큐와 충돌 해결 규칙의 구성 방식을 소개합니다.",
      summary: "## 오프라인을 정상 흐름으로 다루기\n\n로컬 변경을 순서가 보존된 작업으로 기록하고 서버 응답에 따라 재적용합니다. 필드별 충돌 정책과 사용자의 직접 선택이 필요한 조건을 구분합니다.",
      tags: ["모바일", "데이터/DB", "백엔드", "아키텍처"],
      source: "Mobile Craft",
      sourceId: "src_mobile_craft",
      sourceType: "WEB_CRAWL",
      sourcePath: "/sync/offline-first",
      language: "영어 (en)",
      score: 84,
      original: "2026-08-02T14:25:00+09:00",
      crawled: "2026-08-02T15:01:00+09:00",
      publication: "HIDDEN",
      review: "APPROVED",
    },
    {
      id: "art_01JZ25CF7TPR",
      crawlId: "crawl_01JZ259K2VEH",
      title: "PostgreSQL 실행 계획에서 잘못된 카디널리티 추정 찾기",
      oneLine: "실행 계획의 예상 행 수와 실제 행 수 차이를 이용해 통계 정보와 인덱스 설계 문제를 찾습니다.",
      summary: "## 실행 계획 읽기\n\n예상 행 수와 실제 행 수가 크게 벌어지는 첫 지점을 찾고, 컬럼 상관관계와 통계 최신성을 확인합니다. 인덱스를 추가하기 전에 추정 오차의 원인을 검증하는 접근입니다.",
      tags: ["데이터/DB", "백엔드"],
      source: "Database Field Notes",
      sourceId: "src_database_notes",
      sourceType: "RSS",
      sourcePath: "/postgres/query-plan",
      language: "영어 (en)",
      score: 88,
      original: "2026-08-01T10:00:00+09:00",
      crawled: "2026-08-01T10:27:00+09:00",
      publication: "PUBLISHED",
      review: "APPROVED",
    },
    {
      id: "art_01JZ18KB6LNX",
      crawlId: "crawl_01JZ184H3AQD",
      title: "웹 접근성 회귀를 막는 컴포넌트 테스트 기준 만들기",
      oneLine: "키보드 탐색과 접근 가능한 이름을 컴포넌트 테스트에 포함해 반복되는 접근성 결함을 예방합니다.",
      summary: "## 자동화할 기준\n\n정적 규칙만으로 찾기 어려운 포커스 이동과 상태 변화를 사용자 시나리오로 검증합니다. 공통 컴포넌트에 최소 기준을 적용해 제품 전반의 회귀를 줄입니다.",
      tags: ["프론트엔드"],
      source: "Inclusive Interface",
      sourceId: "src_inclusive_ui",
      sourceType: "WEB_CRAWL",
      sourcePath: "/testing/accessibility",
      language: "영어 (en)",
      score: 80,
      original: "2026-07-31T16:15:00+09:00",
      crawled: "2026-07-31T16:43:00+09:00",
      publication: "PUBLISHED",
      review: "NOT_REQUIRED",
    },
  ];

  const sharedPublicData = window.TCPTechArticlesData;
  const sharedTagLabels = new Map((sharedPublicData?.tags || []).map((tag) => [tag.id, tag.label]));
  const publicArticleSeeds = sharedPublicData?.articles?.length
    ? sharedPublicData.articles.slice(0, 8)
    : [];

  let articles = publicArticleSeeds.length
    ? publicArticleSeeds.map((article, index) => ({
        articleId: article.id,
        latestCrawlItemId: "crawl_public_" + String(index + 1).padStart(3, "0"),
        recordVersion: index + 3,
        title: article.title,
        oneLineSummary: article.oneLineSummary,
        summaryMarkdown: article.summaryMarkdown,
        tags: article.tags.map((tagId) => sharedTagLabels.get(tagId) || tagId),
        source: {
          id: article.sourceId,
          name: article.source,
          type: article.sourceType,
          path: new URL(article.originalUrl).pathname,
        },
        canonicalUrl: article.originalUrl,
        originalLanguage: article.originalLanguage.label + " (" + article.originalLanguage.code + ")",
        enrichmentLanguage: "한국어 (ko)",
        valueScore: article.score,
        originalPublishedAt: article.publishedAt,
        crawledAt: article.collectedAt,
        normalizedAt: new Date(new Date(article.collectedAt).getTime() + 120000).toISOString(),
        processingStatus: "ENRICHED",
        duplicateStatus: "UNIQUE",
        reviewStatus: index % 3 === 1 ? "NOT_REQUIRED" : "APPROVED",
        publicationStatus: index % 4 === 2 ? "HIDDEN" : "PUBLISHED",
      }))
    : articleSeeds.map((seed, index) => ({
        articleId: seed.id,
        latestCrawlItemId: seed.crawlId,
        recordVersion: index + 3,
        title: seed.title,
        oneLineSummary: seed.oneLine,
        summaryMarkdown: seed.summary,
        tags: seed.tags,
        source: { id: seed.sourceId, name: seed.source, type: seed.sourceType, path: seed.sourcePath },
        canonicalUrl: "https://example.com" + seed.sourcePath,
        originalLanguage: seed.language,
        enrichmentLanguage: "한국어 (ko)",
        valueScore: seed.score,
        originalPublishedAt: seed.original,
        crawledAt: seed.crawled,
        normalizedAt: new Date(new Date(seed.crawled).getTime() + 120000).toISOString(),
        processingStatus: "ENRICHED",
        duplicateStatus: "UNIQUE",
        reviewStatus: seed.review,
        publicationStatus: seed.publication,
      }));

  let duplicateCases = [
    {
      duplicateCaseId: "dup_01JZA9C5M2QK",
      crawlItemId: "crawl_01JZA98V7DHF",
      candidate: { title: "Node.js 이벤트 루프 지연으로 찾는 API 병목", source: "Dev Runtime Weekly", language: "영어 (en)", url: "https://example.dev/node-event-loop-lag", publishedAt: "2026-08-10T08:30:00+09:00" },
      matched: { articleId: "article-003", title: "Node.js 이벤트 루프 지연을 추적해 API 응답 병목 찾기", source: "Backend Notes", url: "https://backend-notes.example/articles/article-003" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.92,
      queuedAt: "2026-08-10T08:41:00+09:00",
    },
    {
      duplicateCaseId: "dup_01JZA7VF3LNE",
      crawlItemId: "crawl_01JZA7QH6R2B",
      candidate: { title: "RAG 평가: 검색과 생성 지표를 분리해야 하는 이유", source: "Applied AI Digest", language: "영어 (en)", url: "https://example.dev/rag-metrics", publishedAt: "2026-08-10T07:10:00+09:00" },
      matched: { articleId: "article-002", title: "RAG 품질을 높이는 검색 파이프라인 평가 지표 설계", source: "ML Systems Review", url: "https://ml-systems.example/articles/article-002" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.92,
      queuedAt: "2026-08-10T07:22:00+09:00",
    },
    {
      duplicateCaseId: "dup_01JZA5N9K8WX",
      crawlItemId: "crawl_01JZA5J4YQ3P",
      candidate: { title: "PKCE 구현 체크리스트", source: "Identity Engineering", language: "영어 (en)", url: "https://example.dev/pkce-checklist", publishedAt: "2026-08-09T21:00:00+09:00" },
      matched: { articleId: "article-005", title: "브라우저 기반 OAuth 흐름에서 PKCE와 상태값을 안전하게 검증하는 방법", source: "Secure Web Engineering", url: "https://secure-web.example/articles/article-005" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.93,
      queuedAt: "2026-08-09T21:18:00+09:00",
    },
    {
      duplicateCaseId: "dup_01JZA3D6B5RT",
      crawlItemId: "crawl_01JZA39S1CMV",
      candidate: { title: "PostgreSQL 통계 정보로 느린 쿼리 진단하기", source: "Query Craft", language: "일본어 (ja)", url: "https://example.dev/postgres-stats", publishedAt: "2026-08-09T17:45:00+09:00" },
      matched: { articleId: "article-008", title: "수십억 행 테이블에서 PostgreSQL 인덱스를 무중단으로 교체하기", source: "Database Field Notes", url: "https://db-field-notes.example/articles/article-008" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.93,
      queuedAt: "2026-08-09T18:03:00+09:00",
    },
    {
      duplicateCaseId: "dup_01JZ9Z8T4AQP",
      crawlItemId: "crawl_01JZ9Z3F7HLM",
      candidate: { title: "Kubernetes requests와 limits 최적화", source: "Platform Today", language: "한국어 (ko)", url: "https://example.dev/k8s-resources", publishedAt: "2026-08-09T12:05:00+09:00" },
      matched: { articleId: "article-004", title: "Kubernetes 비용을 줄이기 전에 확인할 리소스 요청·제한 설정", source: "Cloud Operations Journal", url: "https://cloud-operations.example/articles/article-004" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.94,
      queuedAt: "2026-08-09T12:19:00+09:00",
    },
    {
      duplicateCaseId: "dup_01JZ9X2E6NCF",
      crawlItemId: "crawl_01JZ9WZ8B4DK",
      candidate: { title: "모바일 데이터 동기화 충돌 해결 패턴", source: "App Architecture", language: "영어 (en)", url: "https://example.dev/mobile-sync", publishedAt: "2026-08-09T09:30:00+09:00" },
      matched: { articleId: "article-007", title: "오프라인 우선 모바일 앱의 충돌 없는 데이터 동기화 설계", source: "Mobile Craft", url: "https://mobile-craft.example/articles/article-007" },
      matchType: "JACCARD",
      jaccardCoefficient: 0.94,
      queuedAt: "2026-08-09T09:47:00+09:00",
    },
  ];

  let reviewTasks = [
    {
      reviewTaskId: "revq_01JZB6Q8H2MN",
      reviewType: "quality",
      articleId: "art_01JZB6K3V7AC",
      title: "LLM 에이전트 평가에서 도구 호출 성공률만 보면 안 되는 이유",
      source: "Agent Systems Lab",
      sourceId: "src_agent_systems",
      sourceType: "RSS",
      sourcePath: "/eval/tool-use",
      language: "영어 (en)",
      valueScore: 68,
      reason: "기술적 깊이는 충분하지만 핵심 사례가 특정 상용 도구에 치우쳐 있어 편집 기준 확인이 필요합니다.",
      signals: ["기술 깊이 82", "실무 활용성 74", "홍보성 위험 63"],
      queuedAt: "2026-08-10T11:12:00+09:00",
      originalPublishedAt: "2026-08-10T10:40:00+09:00",
      crawledAt: "2026-08-10T10:58:00+09:00",
    },
    {
      reviewTaskId: "revq_01JZB4M5R9KL",
      reviewType: "quality",
      articleId: "art_01JZB4H7E3DP",
      title: "멀티 리전 캐시 무효화 전략 비교",
      source: "Distributed Notes",
      sourceId: "src_distributed_notes",
      sourceType: "WEB_CRAWL",
      sourcePath: "/cache/invalidation",
      language: "영어 (en)",
      valueScore: 72,
      reason: "여러 전략을 비교하지만 장애 시나리오의 검증 근거가 일부 부족합니다.",
      signals: ["기술 깊이 76", "근거 충실도 61", "최신성 80"],
      queuedAt: "2026-08-10T10:22:00+09:00",
      originalPublishedAt: "2026-08-10T09:30:00+09:00",
      crawledAt: "2026-08-10T09:55:00+09:00",
    },
    {
      reviewTaskId: "revq_01JZB2A4N8TX",
      reviewType: "quality",
      articleId: "art_01JZB25F6QSW",
      title: "프론트엔드 모노레포를 도입하기 전 확인할 운영 비용",
      source: "Web Platform Review",
      sourceId: "src_web_platform",
      sourceType: "RSS",
      sourcePath: "/monorepo/operations",
      language: "한국어 (ko)",
      valueScore: 66,
      reason: "주제는 유용하지만 기존 자료와 비교해 새로운 정보의 비중이 경계값에 있습니다.",
      signals: ["신규성 54", "실무 활용성 79", "구성 완결성 69"],
      queuedAt: "2026-08-10T09:18:00+09:00",
      originalPublishedAt: "2026-08-10T08:45:00+09:00",
      crawledAt: "2026-08-10T09:02:00+09:00",
    },
    {
      reviewTaskId: "revq_01JZAZ5C2LHM",
      reviewType: "quality",
      articleId: "art_01JZAZ1V4RPK",
      title: "웹소켓 재연결 로직에서 메시지 순서를 보장하는 방법",
      source: "Realtime Engineering",
      sourceId: "src_realtime",
      sourceType: "WEB_CRAWL",
      sourcePath: "/websocket/reconnect",
      language: "영어 (en)",
      valueScore: 71,
      reason: "코드 예시는 구체적이지만 서버 측 멱등성 조건에 대한 설명이 짧습니다.",
      signals: ["기술 깊이 75", "재현 가능성 83", "완결성 58"],
      queuedAt: "2026-08-10T08:04:00+09:00",
      originalPublishedAt: "2026-08-10T07:22:00+09:00",
      crawledAt: "2026-08-10T07:46:00+09:00",
    },
    {
      reviewTaskId: "revp_01JZB8V6K4QF",
      reviewType: "publication",
      articleId: "art_01JZB8Q2M7CY",
      title: "타입 안전한 이벤트 스키마로 마이크로서비스 변경 관리하기",
      source: "Service Architecture",
      sourceId: "src_service_arch",
      sourceType: "RSS",
      sourcePath: "/events/schema",
      language: "영어 (en)",
      valueScore: 87,
      reason: "검토 후 공개 정책에 따라 최종 공개 승인을 기다리고 있습니다.",
      oneLineSummary: "이벤트 스키마 버전과 호환성 규칙을 코드로 관리해 서비스 간 변경으로 인한 장애를 줄이는 방법을 설명합니다.",
      summaryMarkdown: "## 변경을 계약으로 관리하기\n\n이벤트 생산자와 소비자가 같은 스키마 저장소를 기준으로 호환성을 검사하도록 구성합니다. 배포 전에 하위 호환성 위반을 차단하고 단계적으로 소비자를 전환합니다.\n\n- 스키마 버전 규칙\n- CI 호환성 검사\n- 소비자 전환 순서",
      tags: ["백엔드", "클라우드/DevOps", "아키텍처"],
      queuedAt: "2026-08-10T12:15:00+09:00",
      originalPublishedAt: "2026-08-10T11:30:00+09:00",
      crawledAt: "2026-08-10T11:52:00+09:00",
    },
    {
      reviewTaskId: "revp_01JZB7H9D3WS",
      reviewType: "publication",
      articleId: "art_01JZB7C1F8NA",
      title: "CSS 컨테이너 쿼리로 재사용 가능한 대시보드 위젯 만들기",
      source: "Modern CSS Notes",
      sourceId: "src_modern_css",
      sourceType: "WEB_CRAWL",
      sourcePath: "/css/container-query",
      language: "영어 (en)",
      valueScore: 81,
      reason: "검토 후 공개 정책에 따라 최종 공개 승인을 기다리고 있습니다.",
      oneLineSummary: "화면 전체가 아니라 컴포넌트가 놓인 공간을 기준으로 반응하는 대시보드 위젯 구성법을 소개합니다.",
      summaryMarkdown: "## 컴포넌트 기준 반응형 설계\n\n컨테이너 크기에 따라 위젯 내부 배치를 전환하면 같은 컴포넌트를 사이드바와 메인 영역에서 함께 사용할 수 있습니다. 접근성과 폴백을 포함한 적용 순서를 다룹니다.",
      tags: ["프론트엔드", "언어/프레임워크"],
      queuedAt: "2026-08-10T11:38:00+09:00",
      originalPublishedAt: "2026-08-10T10:58:00+09:00",
      crawledAt: "2026-08-10T11:17:00+09:00",
    },
    {
      reviewTaskId: "revp_01JZB1F5T6XE",
      reviewType: "publication",
      articleId: "art_01JZB19P4KRG",
      title: "Passkey 도입 전 계정 복구 정책부터 설계해야 하는 이유",
      source: "Identity Practice",
      sourceId: "src_identity_practice",
      sourceType: "RSS",
      sourcePath: "/passkey/recovery",
      language: "영어 (en)",
      valueScore: 90,
      reason: "검토 후 공개 정책에 따라 최종 공개 승인을 기다리고 있습니다.",
      oneLineSummary: "Passkey 분실과 기기 교체를 고려한 계정 복구 수단과 보안 검증 단계를 먼저 설계해야 한다고 설명합니다.",
      summaryMarkdown: "## 복구가 인증보다 약해지지 않게\n\n복구 채널의 위험도를 분류하고 고위험 계정에는 대기 시간과 추가 검증을 적용합니다. 기기 교체와 조직 계정 이관 시나리오도 함께 제시합니다.",
      tags: ["보안", "백엔드"],
      queuedAt: "2026-08-10T08:43:00+09:00",
      originalPublishedAt: "2026-08-10T08:00:00+09:00",
      crawledAt: "2026-08-10T08:19:00+09:00",
    },
    {
      reviewTaskId: "revp_01JZAY8W5BLC",
      reviewType: "publication",
      articleId: "art_01JZAY3Q9MHF",
      title: "데이터 파이프라인의 늦게 도착한 이벤트 처리 기준",
      source: "Data Reliability",
      sourceId: "src_data_reliability",
      sourceType: "WEB_CRAWL",
      sourcePath: "/stream/late-events",
      language: "영어 (en)",
      valueScore: 85,
      reason: "검토 후 공개 정책에 따라 최종 공개 승인을 기다리고 있습니다.",
      oneLineSummary: "워터마크와 허용 지연 시간을 정의해 늦게 도착한 이벤트를 재집계하고 결과 변경을 추적하는 방법을 설명합니다.",
      summaryMarkdown: "## 지연을 데이터 계약에 포함하기\n\n이벤트 시간과 처리 시간을 분리하고, 허용 지연 범위를 넘긴 데이터의 처리 정책을 명시합니다. 재집계가 사용자 지표에 미치는 영향도 기록합니다.",
      tags: ["데이터/DB", "백엔드"],
      queuedAt: "2026-08-10T07:25:00+09:00",
      originalPublishedAt: "2026-08-10T06:42:00+09:00",
      crawledAt: "2026-08-10T07:03:00+09:00",
    },
  ];

  const state = {
    page: 1,
    query: "",
    filter: "all",
    sort: "newest",
    reviewType: new URLSearchParams(window.location.search).get("type") === "publication" ? "publication" : "quality",
    selected: new Set(),
    policy: "review",
  };

  const ADMIN_STORE_KEY = "tcp-tech-articles-admin-v9";
  const ADMIN_STORE_VERSION = 1;

  function restoreAdminStore() {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(ADMIN_STORE_KEY) || "null");
      if (!stored || stored.version !== ADMIN_STORE_VERSION) return;
      if (Array.isArray(stored.articles)) articles = stored.articles;
      if (Array.isArray(stored.duplicateCases)) duplicateCases = stored.duplicateCases;
      if (Array.isArray(stored.reviewTasks)) reviewTasks = stored.reviewTasks;
      if (["immediate", "review"].includes(stored.policy)) state.policy = stored.policy;
    } catch {
      // file:// 환경 등에서 저장소 사용이 제한되면 현재 화면의 메모리 상태만 사용한다.
    }
  }

  function persistAdminStore() {
    try {
      window.sessionStorage.setItem(
        ADMIN_STORE_KEY,
        JSON.stringify({
          version: ADMIN_STORE_VERSION,
          articles,
          duplicateCases,
          reviewTasks,
          policy: state.policy,
        }),
      );
    } catch {
      // 저장소가 없어도 목업의 현재 화면 조작은 계속 동작한다.
    }
  }

  restoreAdminStore();

  const viewConfig = {
    inventory: {
      eyebrow: "ARTICLE INVENTORY",
      title: "전체 아티클",
      description: "중복 검사와 품질 처리를 마친 아티클의 공개 상태와 최종 콘텐츠를 관리합니다.",
      listTitle: "아티클 목록",
    },
    duplicates: {
      eyebrow: "POSSIBLE DUPLICATE",
      title: "중복 의심 검토 큐",
      description: "Jaccard 계수 0.92 이상으로 POSSIBLE_DUPLICATE 판정을 받은 수집 후보를 기존 아티클과 비교해 처리합니다.",
      listTitle: "판정 대기 후보",
    },
    reviews: {
      eyebrow: "ARTICLE REVIEW",
      title: "아티클 검토 큐",
      description: "품질 경계 사례와 검토 후 공개 정책에 따라 승인을 기다리는 아티클을 구분해 검토합니다.",
      listTitle: "검토 대기 아티클",
    },
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatShortDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>");
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let listType = "";
    const closeList = () => {
      if (listType) output.push("</" + listType + ">");
      listType = "";
    };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) {
        closeList();
        return;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+\.\s+(.+)$/);
      if (heading) {
        closeList();
        const level = Math.min(5, heading[1].length + 2);
        output.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
      } else if (bullet) {
        if (listType !== "ul") {
          closeList();
          listType = "ul";
          output.push("<ul>");
        }
        output.push("<li>" + inlineMarkdown(bullet[1]) + "</li>");
      } else if (ordered) {
        if (listType !== "ol") {
          closeList();
          listType = "ol";
          output.push("<ol>");
        }
        output.push("<li>" + inlineMarkdown(ordered[1]) + "</li>");
      } else {
        closeList();
        output.push("<p>" + inlineMarkdown(line) + "</p>");
      }
    });
    closeList();
    return output.join("");
  }

  function badge(label, className) {
    return "<span class='status-badge " + className + "'>" + escapeHtml(label) + "</span>";
  }

  function tagsHtml(tags) {
    return (tags || []).map((tag) => "<span class='article-tag'>" + escapeHtml(tag) + "</span>").join("");
  }

  function sidebarLink(route, key, icon, label, badgeId, count) {
    const active = view === key;
    return (
      "<a class='sidebar-sub-link" + (active ? " is-active" : "") + "' href='" + route + "'" +
      (active ? " aria-current='page'" : "") + ">" +
      "<i class='fas " + icon + "' aria-hidden='true'></i><span>" + label + "</span>" +
      (badgeId ? "<strong id='" + badgeId + "' class='sidebar-count'>" + count + "</strong>" : "") +
      "</a>"
    );
  }

  function renderShell() {
    return [
      "<div class='admin-shell'>",
      "<div class='admin-sidebar-backdrop' data-sidebar-backdrop hidden></div>",
      "<aside id='adminSidebar' class='admin-sidebar sidebar' aria-label='관리자 사이드바'>",
      "<div class='admin-brand'><a class='admin-brand-link' href='./article-admin.html' aria-label='TCP 관리자 홈'>",
      "<span class='admin-brand-logo'><img src='../../web/src/logo.svg' alt='' /></span>",
      "<span class='admin-brand-copy'><strong class='orbitron gradient-text'>TCP</strong><span>Admin Panel</span></span>",
      "</a></div>",
      "<nav class='admin-navigation' aria-label='관리자 메뉴'>",
      "<section class='sidebar-group' aria-labelledby='sidebarDashboardLabel'>",
      "<h2 id='sidebarDashboardLabel' class='sidebar-group-label'>Dashboard</h2>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-home' aria-hidden='true'></i><span>Overview</span></a>",
      "</section>",
      "<section class='sidebar-group' aria-labelledby='sidebarPageLabel'>",
      "<h2 id='sidebarPageLabel' class='sidebar-group-label'>Page Management</h2>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-file-alt' aria-hidden='true'></i><span>Main Page</span></a>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-bullhorn' aria-hidden='true'></i><span>Recruitment Page</span></a>",
      "<div class='sidebar-section-title'><i class='fas fa-layer-group' aria-hidden='true'></i><span>Tech Articles</span></div>",
      "<div class='sidebar-subnav'>",
      sidebarLink("./article-admin.html", "inventory", "fa-newspaper", "전체 아티클", "", articles.length),
      sidebarLink("./duplicate-review.html", "duplicates", "fa-code-compare", "중복 의심 검토", "duplicateQueueCount", duplicateCases.length),
      sidebarLink("./article-review.html", "reviews", "fa-user-check", "아티클 검토", "articleReviewCount", reviewTasks.length),
      "</div>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-book' aria-hidden='true'></i><span>Study Group Page</span></a>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-project-diagram' aria-hidden='true'></i><span>Project Team Page</span></a>",
      "</section>",
      "<section class='sidebar-group' aria-labelledby='sidebarAccountLabel'>",
      "<h2 id='sidebarAccountLabel' class='sidebar-group-label'>Account Management</h2>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-user-shield' aria-hidden='true'></i><span>Manage Permissions</span></a>",
      "<a class='sidebar-link' href='#' data-demo-link><i class='fas fa-database' aria-hidden='true'></i><span>Modify Information</span></a>",
      "</section>",
      "</nav></aside>",
      "<div class='admin-workspace'>",
      "<header class='admin-topbar'><div class='admin-topbar-inner'>",
      "<button id='sidebarToggle' class='sidebar-toggle' type='button' aria-label='관리자 메뉴 열기' aria-controls='adminSidebar' aria-expanded='false'><i class='fas fa-bars' aria-hidden='true'></i></button>",
      "<h1 class='admin-page-title orbitron'>Tech Articles</h1>",
      "<div class='admin-account-actions'>",
      "<a class='admin-home-link' href='./index.html' aria-label='Tech Articles 공개 페이지 보기' title='공개 페이지 보기'><i class='fas fa-home' aria-hidden='true'></i></a>",
      "<span class='admin-user-name'>Admin</span>",
      "<button class='admin-logout-button' type='button' data-demo-action>로그아웃</button>",
      "</div></div></header>",
      "<main id='adminMain' class='admin-main' tabindex='-1'><div id='adminMainInner' class='admin-main-inner'></div></main>",
      "</div></div>",
      "<dialog id='detailDialog' class='admin-dialog admin-dialog-wide' aria-labelledby='detailDialogTitle'>",
      "<div class='dialog-panel'><header class='dialog-header'><div><p id='detailDialogEyebrow' class='section-eyebrow orbitron'>DETAIL</p><h2 id='detailDialogTitle'>상세 정보</h2></div>",
      "<button class='dialog-close-button' type='button' data-close-detail aria-label='상세 정보 닫기'><i class='fas fa-xmark' aria-hidden='true'></i></button></header>",
      "<div id='detailDialogContent' class='detail-dialog-content'></div>",
      "<footer id='detailDialogActions' class='admin-dialog-actions' hidden></footer></div></dialog>",
      "<dialog id='confirmDialog' class='admin-dialog confirm-dialog' aria-labelledby='confirmDialogTitle' aria-describedby='confirmDialogDescription'>",
      "<div class='dialog-panel'><div id='confirmDialogIcon' class='confirm-dialog-icon'><i class='fas fa-shield-halved' aria-hidden='true'></i></div>",
      "<h2 id='confirmDialogTitle'>작업을 진행할까요?</h2><p id='confirmDialogDescription'>선택한 작업을 확인해 주세요.</p>",
      "<div class='dialog-actions'><button class='btn-secondary' type='button' data-cancel-confirm>취소</button><button id='confirmDialogButton' class='btn-primary' type='button'>확인</button></div>",
      "</div></dialog>",
      "<div id='toast' class='toast' role='status' aria-live='polite' aria-atomic='true' hidden><i class='fas fa-circle-info' aria-hidden='true'></i><p></p></div>",
    ].join("");
  }

  function showToast(message, iconClass) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.querySelector("i").className = "fas " + (iconClass || "fa-circle-info");
    toast.querySelector("p").textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function askConfirmation(options) {
    const dialog = document.querySelector("#confirmDialog");
    const icon = document.querySelector("#confirmDialogIcon");
    const button = document.querySelector("#confirmDialogButton");
    const tone = options.tone || (options.danger ? "danger" : "primary");
    document.querySelector("#confirmDialogTitle").textContent = options.title;
    document.querySelector("#confirmDialogDescription").textContent = options.description;
    button.textContent = options.confirmLabel || "확인";
    button.className = tone === "danger" ? "btn-danger" : tone === "success" ? "btn-success" : "btn-primary";
    icon.className = "confirm-dialog-icon" + (tone === "danger" ? " danger-icon" : tone === "success" ? " success-icon" : "");
    icon.innerHTML = tone === "danger"
      ? "<i class='fas fa-triangle-exclamation' aria-hidden='true'></i>"
      : tone === "success"
        ? "<i class='fas fa-check' aria-hidden='true'></i>"
        : "<i class='fas fa-shield-halved' aria-hidden='true'></i>";
    confirmHandler = options.onConfirm;
    confirmCancelHandler = options.onCancel || null;
    openDialog(dialog);
  }

  function syncQueueBadges() {
    const duplicateCount = document.querySelector("#duplicateQueueCount");
    const reviewCount = document.querySelector("#articleReviewCount");
    if (duplicateCount) duplicateCount.textContent = String(duplicateCases.length);
    if (reviewCount) reviewCount.textContent = String(reviewTasks.length);
  }

  function renderIntro() {
    const config = viewConfig[view];
    return [
      "<section class='admin-intro' aria-labelledby='adminViewTitle'><div>",
      "<p class='section-eyebrow orbitron'>" + config.eyebrow + "</p>",
      "<h2 id='adminViewTitle' class='gradient-text'>" + config.title + "</h2>",
      "<p>" + config.description + "</p></div>",
      "<a class='public-page-link' href='./index.html'>공개 페이지 보기<i class='fas fa-arrow-up-right-from-square' aria-hidden='true'></i></a>",
      "</section>",
    ].join("");
  }

  function statCard(icon, label, value, note, tone) {
    return [
      "<article class='widget-card queue-stat-card'>",
      "<span class='queue-stat-icon " + (tone || "") + "' aria-hidden='true'><i class='fas " + icon + "'></i></span>",
      "<div><p>" + label + "</p><strong class='orbitron'>" + value + "</strong><small>" + note + "</small></div>",
      "</article>",
    ].join("");
  }

  function renderOverview() {
    if (view === "inventory") {
      const published = articles.filter((article) => article.publicationStatus === "PUBLISHED").length;
      return [
        "<section class='admin-overview-grid' aria-label='아티클 운영 현황'>",
        "<article class='widget-card total-card'><div class='overview-card-heading'><span class='overview-icon overview-icon-blue' aria-hidden='true'><i class='fas fa-newspaper'></i></span>",
        "<div><p>총 아티클</p><p class='overview-caption'>현재 등록된 전체</p></div></div>",
        "<p class='total-article-count orbitron'>" + articles.length + "</p><p class='queue-stat-inline'>공개 " + published + " · 비공개 " + (articles.length - published) + "</p></article>",
        "<article class='widget-card policy-card'><div class='policy-heading'><div><p class='section-eyebrow orbitron'>PUBLICATION POLICY</p><h3>새 아티클 공개 정책</h3></div><span class='policy-scope-badge'>전체 적용</span></div>",
        "<form id='policyForm'><fieldset><legend class='sr-only'>새 아티클 공개 방식 선택</legend><div class='policy-options'>",
        "<label class='policy-option'><input type='radio' name='publicationPolicy' value='immediate'" + (state.policy === "immediate" ? " checked" : "") + "><span class='policy-option-content'><span class='policy-option-icon' aria-hidden='true'><i class='fas fa-bolt'></i></span><span><strong>즉시 공개</strong><small>처리가 끝난 새 아티클을 바로 공개</small></span></span></label>",
        "<label class='policy-option'><input type='radio' name='publicationPolicy' value='review'" + (state.policy === "review" ? " checked" : "") + "><span class='policy-option-content'><span class='policy-option-icon' aria-hidden='true'><i class='fas fa-user-check'></i></span><span><strong>검토 후 공개</strong><small>공개 검토 큐에서 승인 및 공개</small></span></span></label>",
        "</div></fieldset><div class='policy-footer'><p class='policy-description'>" +
        (state.policy === "review"
          ? "앞으로 등록되는 새 아티클은 AI 요약 완료 후 <strong>공개 검토 큐</strong>로 이동합니다."
          : "앞으로 등록되는 새 아티클은 모든 처리가 정상 완료되면 <strong>즉시 공개</strong>됩니다.") +
        "</p><button class='btn-primary btn-small' type='submit'><i class='fas fa-floppy-disk' aria-hidden='true'></i>정책 저장</button></div></form></article>",
        "</section>",
      ].join("");
    }

    if (view === "duplicates") {
      return [
        "<section class='queue-overview-grid queue-overview-grid-single' aria-label='중복 의심 큐 현황'>",
        statCard("fa-code-compare", "판정 대기", duplicateCases.length, "POSSIBLE_DUPLICATE", "tone-purple"),
        "</section>",
      ].join("");
    }

    const quality = reviewTasks.filter((item) => item.reviewType === "quality").length;
    const publication = reviewTasks.filter((item) => item.reviewType === "publication").length;
    return [
      "<section class='queue-overview-grid queue-overview-grid-two' aria-label='아티클 검토 큐 현황'>",
      statCard("fa-scale-balanced", "품질 검토", quality, "REVIEW_REQUIRED", "tone-warning"),
      statCard("fa-eye", "공개 검토", publication, "정책에 따른 공개 승인", "tone-purple"),
      "</section>",
    ].join("");
  }

  function renderReviewTabs() {
    if (view !== "reviews") return "";
    const qualityCount = reviewTasks.filter((item) => item.reviewType === "quality").length;
    const publicationCount = reviewTasks.filter((item) => item.reviewType === "publication").length;
    return [
      "<div class='review-tabs' aria-label='검토 유형 필터'>",
      "<button id='qualityTab' class='review-tab" + (state.reviewType === "quality" ? " is-active" : "") + "' type='button' aria-pressed='" + (state.reviewType === "quality") + "' data-review-tab='quality'><i class='fas fa-scale-balanced' aria-hidden='true'></i>품질 검토<span>" + qualityCount + "</span></button>",
      "<button id='publicationTab' class='review-tab" + (state.reviewType === "publication" ? " is-active" : "") + "' type='button' aria-pressed='" + (state.reviewType === "publication") + "' data-review-tab='publication'><i class='fas fa-eye' aria-hidden='true'></i>공개 검토<span>" + publicationCount + "</span></button>",
      "</div>",
      "<p class='review-tab-help'>" +
      (state.reviewType === "quality"
        ? "품질 평가 경계값에 있어 사람의 판단이 필요한 아티클입니다. 이 단계에는 AI 요약이 아직 없습니다."
        : "AI 요약까지 완료됐지만 ‘검토 후 공개’ 정책에 따라 최종 승인을 기다리는 아티클입니다.") +
      "</p>",
    ].join("");
  }

  function renderFilterCard() {
    let filterLabel = "상태";
    let filterOptions = "";
    let placeholder = "제목, 요약, 출처에서 검색";

    if (view === "inventory") {
      filterLabel = "공개 상태";
      filterOptions = "<option value='all'>모든 공개 상태</option><option value='published'>공개</option><option value='hidden'>비공개</option>";
    } else if (view === "duplicates") {
      filterLabel = "검토 기준";
      placeholder = "후보 제목, 기존 아티클, 출처에서 검색";
      filterOptions = "<option value='all'>Jaccard 계수 0.92 이상</option>";
    } else {
      filterLabel = "수집 방식";
      placeholder = "제목, 출처, 검토 사유에서 검색";
      filterOptions = "<option value='all'>모든 수집 방식</option><option value='rss'>RSS</option><option value='web-crawl'>WEB_CRAWL</option>";
    }

    return [
      "<section class='widget-card filter-card' aria-labelledby='filterTitle'><div class='section-heading-row'><div><p class='section-eyebrow orbitron'>SEARCH &amp; FILTER</p><h3 id='filterTitle'>검색 및 필터</h3></div>",
      "<button class='btn-secondary btn-small' type='button' data-reset-filters><i class='fas fa-rotate-left' aria-hidden='true'></i>필터 초기화</button></div>",
      "<form class='filter-grid' role='search'><div class='form-field form-field-search'><label for='queryInput'>검색</label><div class='input-with-icon'><i class='fas fa-magnifying-glass' aria-hidden='true'></i>",
      "<input id='queryInput' class='form-input' type='search' autocomplete='off' value='" + escapeHtml(state.query) + "' placeholder='" + placeholder + "'></div></div>",
      "<div class='form-field'><label for='recordFilter'>" + filterLabel + "</label><select id='recordFilter' class='form-input'>" + filterOptions + "</select></div>",
      "<div class='form-field'><label for='sortSelect'>정렬</label><select id='sortSelect' class='form-input'><option value='newest'>최근 대기·등록순</option>" +
      (view === "inventory" ? "<option value='score-desc'>가치 점수 높은순</option><option value='score-asc'>가치 점수 낮은순</option>" : "") +
      (view === "duplicates" ? "<option value='jaccard-desc'>Jaccard 계수 높은순</option>" : "") +
      "</select></div></form></section>",
    ].join("");
  }

  function renderBulkButtons() {
    if (view === "inventory") {
      return "<button class='bulk-action-button' type='button' data-bulk-action='publish'><i class='fas fa-eye' aria-hidden='true'></i>공개</button><button class='bulk-action-button' type='button' data-bulk-action='hide'><i class='fas fa-eye-slash' aria-hidden='true'></i>비공개</button><button class='bulk-action-button danger' type='button' data-bulk-action='delete'><i class='fas fa-trash-can' aria-hidden='true'></i>영구 삭제</button>";
    }
    if (view === "duplicates") {
      return "<button class='bulk-action-button success' type='button' data-bulk-action='mark-unique'><i class='fas fa-check' aria-hidden='true'></i>Unique</button><button class='bulk-action-button danger' type='button' data-bulk-action='mark-duplicate'><i class='fas fa-link' aria-hidden='true'></i>Duplicate</button>";
    }
    if (state.reviewType === "publication") {
      return "<button class='bulk-action-button success' type='button' data-bulk-action='approve-publication'><i class='fas fa-check' aria-hidden='true'></i>승인 및 공개</button>";
    }
    return "<button class='bulk-action-button success' type='button' data-bulk-action='pass-quality'><i class='fas fa-check' aria-hidden='true'></i>품질 통과</button><button class='bulk-action-button danger' type='button' data-bulk-action='reject-quality'><i class='fas fa-ban' aria-hidden='true'></i>품질 탈락</button>";
  }

  function tableHead() {
    const selectAll = "<th class='selection-column' scope='col'><input id='selectCurrentPage' class='selection-checkbox' type='checkbox' aria-label='현재 페이지 전체 선택'></th>";
    if (view === "inventory") {
      return selectAll + "<th scope='col'>아티클</th><th scope='col'>출처 · 언어</th><th scope='col'>가치 점수</th><th scope='col'>원문 게시 · 수집</th><th scope='col'>검토 상태</th><th scope='col'>공개 설정</th><th scope='col'>작업</th>";
    }
    if (view === "duplicates") {
      return selectAll + "<th scope='col'>수집 후보</th><th scope='col'>기존 아티클</th><th scope='col'>검토 기준</th><th scope='col'>Jaccard 계수</th><th scope='col'>대기 시각</th><th scope='col'>작업</th>";
    }
    return selectAll + "<th scope='col'>아티클</th><th scope='col'>출처 · 언어</th><th scope='col'>검토 유형</th><th scope='col'>검토 사유</th><th scope='col'>가치 점수</th><th scope='col'>대기 시각</th><th scope='col'>작업</th>";
  }

  function renderManagement() {
    return [
      "<section class='article-management-section' aria-labelledby='recordListTitle'>",
      "<div class='list-heading-row'><div><p class='section-eyebrow orbitron'>QUEUE &amp; RECORDS</p><h3 id='recordListTitle'>" + viewConfig[view].listTitle + "</h3></div>",
      "<p id='resultCount' class='result-count' role='status' aria-live='polite'></p></div>",
      "<div id='selectionBar' class='selection-action-bar' hidden><div><strong id='selectionCount'>0개 선택됨</strong><span>현재 페이지에서 선택한 항목에만 적용됩니다.</span></div><div class='selection-actions'>" +
      renderBulkButtons() +
      "<button class='bulk-clear-button' type='button' data-clear-selection><i class='fas fa-xmark' aria-hidden='true'></i>선택 해제</button></div></div>",
      "<div class='widget-card article-table-card'><div class='article-table-wrap'><table class='article-table admin-v9-table'><caption class='sr-only'>" + viewConfig[view].listTitle + " 및 관리 작업</caption>",
      "<thead><tr>" + tableHead() + "</tr></thead><tbody id='recordTableBody'></tbody></table></div></div>",
      "<div id='recordCardList' class='article-card-list'></div>",
      "<nav id='pagination' class='admin-pagination' aria-label='목록 페이지 이동'></nav>",
      "</section>",
    ].join("");
  }

  function renderView() {
    const main = document.querySelector("#adminMainInner");
    main.innerHTML = renderIntro() + renderOverview() + renderReviewTabs() + renderFilterCard() + renderManagement();
    const filter = main.querySelector("#recordFilter");
    const sort = main.querySelector("#sortSelect");
    if (filter) filter.value = state.filter;
    if (sort) sort.value = state.sort;
    renderList();
  }

  function recordId(record) {
    if (view === "inventory") return record.articleId;
    if (view === "duplicates") return record.duplicateCaseId;
    return record.reviewTaskId;
  }

  function recordsForView() {
    if (view === "inventory") return articles;
    if (view === "duplicates") return duplicateCases;
    return reviewTasks.filter((item) => item.reviewType === state.reviewType);
  }

  function searchableText(record) {
    if (view === "inventory") {
      return [record.title, record.oneLineSummary, record.source.name, record.tags.join(" ")].join(" ");
    }
    if (view === "duplicates") {
      return [
        record.candidate.title,
        record.candidate.source,
        record.matched.title,
        record.matched.source,
        "Jaccard 계수 0.92 이상",
        record.jaccardCoefficient ?? "",
      ].join(" ");
    }
    return [record.title, record.source, record.reason].join(" ");
  }

  function filteredRecords() {
    const query = state.query.trim().toLocaleLowerCase("ko");
    let result = recordsForView().filter((record) => !query || searchableText(record).toLocaleLowerCase("ko").includes(query));

    if (view === "inventory") {
      if (state.filter === "published") result = result.filter((item) => item.publicationStatus === "PUBLISHED");
      if (state.filter === "hidden") result = result.filter((item) => item.publicationStatus === "HIDDEN");
      if (state.sort === "score-desc") result.sort((a, b) => b.valueScore - a.valueScore);
      else if (state.sort === "score-asc") result.sort((a, b) => a.valueScore - b.valueScore);
      else result.sort((a, b) => new Date(b.crawledAt) - new Date(a.crawledAt));
    } else if (view === "duplicates") {
      if (state.filter === "jaccard") result = result.filter((item) => item.matchType === "JACCARD");
      if (state.sort === "jaccard-desc") {
        result.sort((a, b) => (b.jaccardCoefficient ?? -1) - (a.jaccardCoefficient ?? -1));
      }
      else result.sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
    } else {
      if (state.filter === "rss") result = result.filter((item) => item.sourceType === "RSS");
      if (state.filter === "web-crawl") result = result.filter((item) => item.sourceType === "WEB_CRAWL");
      result.sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
    }
    return result;
  }

  function currentPageRecords() {
    const filtered = filteredRecords();
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE[view]));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * PAGE_SIZE[view];
    return filtered.slice(start, start + PAGE_SIZE[view]);
  }

  function inventoryRow(article) {
    const id = escapeHtml(article.articleId);
    const published = article.publicationStatus === "PUBLISHED";
    return [
      "<tr data-record-row='" + id + "'>",
      "<td class='selection-column'><input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(article.title) + " 선택'></td>",
      "<td class='admin-article-cell'><span class='admin-article-id'>" + id + "</span><p class='admin-article-title'>" + escapeHtml(article.title) + "</p><p class='admin-article-summary'>" + escapeHtml(article.oneLineSummary) + "</p><div class='admin-article-tags'>" + tagsHtml(article.tags) + "</div></td>",
      "<td class='admin-source-cell'><strong>" + escapeHtml(article.source.name) + "</strong><span class='source-language'><i class='fas fa-language' aria-hidden='true'></i>" + escapeHtml(article.originalLanguage) + "</span></td>",
      "<td><span class='admin-score'>" + article.valueScore + "</span></td>",
      "<td class='admin-date-cell'><span>원문 게시</span><strong>" + formatShortDate(article.originalPublishedAt) + "</strong><span>수집 완료</span><strong>" + formatShortDate(article.crawledAt) + "</strong></td>",
      "<td>" + badge(article.reviewStatus === "APPROVED" ? "검토 승인" : "검토 불필요", article.reviewStatus === "APPROVED" ? "status-published" : "status-hidden") + "</td>",
      "<td><label class='publish-control'><span class='switch'><input type='checkbox' data-publication-toggle='" + id + "'" + (published ? " checked" : "") + " aria-label='" + escapeHtml(article.title) + " 공개 설정'><span class='switch-track'></span></span><span>" + (published ? "공개" : "비공개") + "</span></label></td>",
      "<td><div class='row-actions'><button class='row-action' type='button' data-record-action='detail' data-record-id='" + id + "'><i class='fas fa-circle-info' aria-hidden='true'></i>상세</button><button class='row-action danger' type='button' data-record-action='delete' data-record-id='" + id + "'><i class='fas fa-trash-can' aria-hidden='true'></i>영구 삭제</button></div></td>",
      "</tr>",
    ].join("");
  }

  function duplicateRow(item) {
    const id = escapeHtml(item.duplicateCaseId);
    const methodLabel = "Jaccard 계수 0.92 이상";
    const jaccardValue = item.jaccardCoefficient.toFixed(2);
    return [
      "<tr data-record-row='" + id + "'>",
      "<td class='selection-column'><input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(item.candidate.title) + " 선택'></td>",
      "<td class='admin-article-cell'><span class='admin-article-id'>" + escapeHtml(item.crawlItemId) + "</span><p class='admin-article-title'>" + escapeHtml(item.candidate.title) + "</p><p class='admin-article-summary'>" + escapeHtml(item.candidate.source) + " · " + escapeHtml(item.candidate.language) + "</p></td>",
      "<td class='duplicate-match-cell'><span class='admin-article-id'>" + escapeHtml(item.matched.articleId) + "</span><strong>" + escapeHtml(item.matched.title) + "</strong><small>" + escapeHtml(item.matched.source) + "</small></td>",
      "<td class='duplicate-method-cell'><span class='duplicate-method-badge'><i class='fas fa-calculator' aria-hidden='true'></i>" + methodLabel + "</span></td>",
      "<td><span class='jaccard-score'>" + jaccardValue + "</span></td>",
      "<td class='admin-date-cell'><strong>" + formatDate(item.queuedAt) + "</strong></td>",
      "<td><div class='row-actions'><button class='row-action primary-row-action' type='button' data-record-action='detail' data-record-id='" + id + "'><i class='fas fa-code-compare' aria-hidden='true'></i>비교·판정</button></div></td>",
      "</tr>",
    ].join("");
  }

  function reviewRow(item) {
    const id = escapeHtml(item.reviewTaskId);
    const isQuality = item.reviewType === "quality";
    return [
      "<tr data-record-row='" + id + "'>",
      "<td class='selection-column'><input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(item.title) + " 선택'></td>",
      "<td class='admin-article-cell'><span class='admin-article-id'>" + escapeHtml(item.articleId) + "</span><p class='admin-article-title'>" + escapeHtml(item.title) + "</p><p class='admin-article-summary'>" + (isQuality ? "AI 요약 생성 전" : escapeHtml(item.oneLineSummary)) + "</p></td>",
      "<td class='admin-source-cell'><strong>" + escapeHtml(item.source) + "</strong><span class='source-language'><i class='fas fa-language' aria-hidden='true'></i>" + escapeHtml(item.language) + "</span></td>",
      "<td>" + badge(isQuality ? "품질 검토" : "공개 검토", isQuality ? "status-pending" : "status-processing") + "</td>",
      "<td class='review-reason-cell'><p>" + escapeHtml(item.reason) + "</p></td>",
      "<td><span class='admin-score'>" + item.valueScore + "</span></td>",
      "<td class='admin-date-cell'><strong>" + formatDate(item.queuedAt) + "</strong></td>",
      "<td><div class='row-actions'><button class='row-action primary-row-action' type='button' data-record-action='detail' data-record-id='" + id + "'><i class='fas fa-magnifying-glass' aria-hidden='true'></i>검토</button></div></td>",
      "</tr>",
    ].join("");
  }

  function inventoryCard(article) {
    const id = escapeHtml(article.articleId);
    const published = article.publicationStatus === "PUBLISHED";
    return [
      "<article class='admin-mobile-card' data-record-row='" + id + "'><div class='admin-mobile-card-heading'><div><span class='admin-article-id'>" + id + "</span><h3>" + escapeHtml(article.title) + "</h3></div>",
      "<input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(article.title) + " 선택'></div>",
      "<p class='admin-mobile-card-summary'>" + escapeHtml(article.oneLineSummary) + "</p>",
      "<div class='admin-mobile-meta'><span>출처<strong>" + escapeHtml(article.source.name) + "</strong></span><span>원문 언어<strong>" + escapeHtml(article.originalLanguage) + "</strong></span><span>가치 점수<strong>" + article.valueScore + "점</strong></span><span>공개 상태<strong>" + (published ? "공개" : "비공개") + "</strong></span></div>",
      "<div class='admin-mobile-controls'><label class='publish-control'><span class='switch'><input type='checkbox' data-publication-toggle='" + id + "'" + (published ? " checked" : "") + " aria-label='" + escapeHtml(article.title) + " 공개 설정'><span class='switch-track'></span></span><span>" + (published ? "공개" : "비공개") + "</span></label>",
      "<div class='row-actions'><button class='row-action' type='button' data-record-action='detail' data-record-id='" + id + "'>상세</button><button class='row-action danger' type='button' data-record-action='delete' data-record-id='" + id + "'>영구 삭제</button></div></div></article>",
    ].join("");
  }

  function duplicateCard(item) {
    const id = escapeHtml(item.duplicateCaseId);
    const methodLabel = "Jaccard 계수 0.92 이상";
    const jaccardLabel = item.jaccardCoefficient.toFixed(2);
    return [
      "<article class='admin-mobile-card' data-record-row='" + id + "'><div class='admin-mobile-card-heading'><div><span class='admin-article-id'>" + escapeHtml(item.crawlItemId) + "</span><h3>" + escapeHtml(item.candidate.title) + "</h3></div>",
      "<input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(item.candidate.title) + " 선택'></div>",
      "<p class='admin-mobile-card-summary'>기존: " + escapeHtml(item.matched.title) + "</p>",
      "<div class='admin-mobile-meta'><span>검토 기준<strong>" + methodLabel + "</strong></span><span>Jaccard 계수<strong>" + jaccardLabel + "</strong></span></div>",
      "<div class='admin-mobile-controls'><span>" + badge("POSSIBLE_DUPLICATE", "status-pending") + "</span><button class='row-action primary-row-action' type='button' data-record-action='detail' data-record-id='" + id + "'>비교·판정</button></div></article>",
    ].join("");
  }

  function reviewCard(item) {
    const id = escapeHtml(item.reviewTaskId);
    const isQuality = item.reviewType === "quality";
    return [
      "<article class='admin-mobile-card' data-record-row='" + id + "'><div class='admin-mobile-card-heading'><div><span class='admin-article-id'>" + escapeHtml(item.articleId) + "</span><h3>" + escapeHtml(item.title) + "</h3></div>",
      "<input class='selection-checkbox' type='checkbox' data-select-record='" + id + "' aria-label='" + escapeHtml(item.title) + " 선택'></div>",
      "<p class='admin-mobile-card-summary'>" + escapeHtml(item.reason) + "</p>",
      "<div class='admin-mobile-meta'><span>검토 유형<strong>" + (isQuality ? "품질 검토" : "공개 검토") + "</strong></span><span>가치 점수<strong>" + item.valueScore + "점</strong></span></div>",
      "<div class='admin-mobile-controls'><span>" + badge(isQuality ? "REVIEW_REQUIRED" : "공개 승인 대기", isQuality ? "status-pending" : "status-processing") + "</span><button class='row-action primary-row-action' type='button' data-record-action='detail' data-record-id='" + id + "'>검토</button></div></article>",
    ].join("");
  }

  function renderPagination(total) {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE[view]));
    if (total === 0) return "";
    const buttons = [];
    buttons.push("<button class='admin-page-button' type='button' data-page='" + (state.page - 1) + "'" + (state.page === 1 ? " disabled" : "") + " aria-label='이전 페이지'><i class='fas fa-chevron-left' aria-hidden='true'></i></button>");
    for (let page = 1; page <= pageCount; page += 1) {
      buttons.push("<button class='admin-page-button' type='button' data-page='" + page + "'" + (page === state.page ? " aria-current='page'" : "") + ">" + page + "</button>");
    }
    buttons.push("<button class='admin-page-button' type='button' data-page='" + (state.page + 1) + "'" + (state.page === pageCount ? " disabled" : "") + " aria-label='다음 페이지'><i class='fas fa-chevron-right' aria-hidden='true'></i></button>");
    return buttons.join("");
  }

  function renderList() {
    const allFiltered = filteredRecords();
    const pageRecords = currentPageRecords();
    const tbody = document.querySelector("#recordTableBody");
    const cards = document.querySelector("#recordCardList");
    const pagination = document.querySelector("#pagination");
    const resultCount = document.querySelector("#resultCount");
    if (!tbody || !cards || !pagination || !resultCount) return;

    resultCount.textContent = "총 " + allFiltered.length + "건 · " + state.page + "페이지";
    if (!pageRecords.length) {
      tbody.innerHTML = "<tr><td class='admin-empty-state' colspan='8'><i class='fas fa-inbox' aria-hidden='true'></i><h3>조건에 맞는 항목이 없습니다.</h3><p>검색어 또는 필터를 변경해 보세요.</p></td></tr>";
      cards.innerHTML = "<div class='admin-empty-state'><i class='fas fa-inbox' aria-hidden='true'></i><h3>조건에 맞는 항목이 없습니다.</h3></div>";
    } else if (view === "inventory") {
      tbody.innerHTML = pageRecords.map(inventoryRow).join("");
      cards.innerHTML = pageRecords.map(inventoryCard).join("");
    } else if (view === "duplicates") {
      tbody.innerHTML = pageRecords.map(duplicateRow).join("");
      cards.innerHTML = pageRecords.map(duplicateCard).join("");
    } else {
      tbody.innerHTML = pageRecords.map(reviewRow).join("");
      cards.innerHTML = pageRecords.map(reviewCard).join("");
    }
    pagination.innerHTML = renderPagination(allFiltered.length);
    syncSelectionUI();
    syncQueueBadges();
  }

  function syncSelectionUI() {
    const pageIds = currentPageRecords().map(recordId);
    document.querySelectorAll("[data-select-record]").forEach((checkbox) => {
      checkbox.checked = state.selected.has(checkbox.dataset.selectRecord);
    });
    document.querySelectorAll("[data-record-row]").forEach((row) => {
      row.classList.toggle("is-selected", state.selected.has(row.dataset.recordRow));
    });
    const selectAll = document.querySelector("#selectCurrentPage");
    if (selectAll) {
      const selectedCount = pageIds.filter((id) => state.selected.has(id)).length;
      selectAll.checked = pageIds.length > 0 && selectedCount === pageIds.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < pageIds.length;
    }
    const bar = document.querySelector("#selectionBar");
    const count = document.querySelector("#selectionCount");
    if (bar && count) {
      bar.hidden = state.selected.size === 0;
      count.textContent = state.selected.size + "개 선택됨";
    }
  }

  function detailFact(label, value, mono) {
    return "<div class='admin-detail-fact'><span>" + escapeHtml(label) + "</span><strong" + (mono ? " class='mono-value'" : "") + ">" + escapeHtml(value || "—") + "</strong></div>";
  }

  function findRecord(id) {
    if (view === "inventory") return articles.find((item) => item.articleId === id);
    if (view === "duplicates") return duplicateCases.find((item) => item.duplicateCaseId === id);
    return reviewTasks.find((item) => item.reviewTaskId === id);
  }

  function openInventoryDetail(article) {
    const content = document.querySelector("#detailDialogContent");
    const actions = document.querySelector("#detailDialogActions");
    document.querySelector("#detailDialogEyebrow").textContent = "ARTICLE DETAILS";
    document.querySelector("#detailDialogTitle").textContent = "아티클 상세 정보";
    content.innerHTML = [
      "<article class='admin-detail-record'><span class='admin-article-id'>" + escapeHtml(article.articleId) + "</span><h3 class='admin-detail-title'>" + escapeHtml(article.title) + "</h3>",
      "<div class='admin-detail-meta'>" +
      badge(article.publicationStatus === "PUBLISHED" ? "공개" : "비공개", article.publicationStatus === "PUBLISHED" ? "status-published" : "status-hidden") +
      badge(article.reviewStatus === "APPROVED" ? "검토 승인" : "검토 불필요", article.reviewStatus === "APPROVED" ? "status-published" : "status-hidden") +
      badge(article.processingStatus, "status-processing") + "</div>",
      "<section class='admin-detail-section'><h4>한 줄 요약</h4><p class='detail-one-line-summary'>" + escapeHtml(article.oneLineSummary) + "</p></section>",
      "<section class='admin-detail-section'><h4>상세 요약</h4><div class='admin-markdown-body'>" + renderMarkdown(article.summaryMarkdown) + "</div></section>",
      "<section class='admin-detail-section detail-score-tags'><div><h4>분야 태그</h4><div class='admin-article-tags'>" + tagsHtml(article.tags) + "</div></div><div><h4>가치 점수</h4><span class='admin-score'>" + article.valueScore + "</span></div></section>",
      "<section class='admin-detail-section'><h4>원문 및 처리 정보</h4><div class='admin-detail-grid'>",
      detailFact("아티클 ID", article.articleId, true),
      detailFact("최신 수집 항목 ID", article.latestCrawlItemId, true),
      detailFact("레코드 버전", "v" + article.recordVersion),
      detailFact("소스 ID", article.source.id, true),
      detailFact("수집 방식", article.source.type),
      detailFact("원본 경로", article.source.path, true),
      detailFact("원문 언어", article.originalLanguage),
      detailFact("요약 언어", article.enrichmentLanguage),
      detailFact("원문 게시일", formatDate(article.originalPublishedAt)),
      detailFact("수집 완료", formatDate(article.crawledAt)),
      detailFact("정규화 완료", formatDate(article.normalizedAt)),
      detailFact("처리 상태", article.processingStatus),
      detailFact("중복 상태", article.duplicateStatus),
      detailFact("검토 상태", article.reviewStatus),
      detailFact("공개 상태", article.publicationStatus),
      "</div><div class='canonical-url-block'><span>Canonical URL</span><a href='" + escapeHtml(article.canonicalUrl) + "' target='_blank' rel='noopener noreferrer'>" + escapeHtml(article.canonicalUrl) + "<i class='fas fa-arrow-up-right-from-square' aria-hidden='true'></i></a></div></section></article>",
    ].join("");
    actions.hidden = false;
    actions.innerHTML = "<button class='btn-secondary' type='button' data-close-detail>닫기</button><a class='btn-primary dialog-link-button' href='" + escapeHtml(article.canonicalUrl) + "' target='_blank' rel='noopener noreferrer'><i class='fas fa-arrow-up-right-from-square' aria-hidden='true'></i>원문 보기</a>";
    openDialog(document.querySelector("#detailDialog"));
  }

  function openDuplicateDetail(item) {
    const methodLabel = "Jaccard 계수 0.92 이상";
    const jaccardLabel = item.jaccardCoefficient.toFixed(2);
    const content = document.querySelector("#detailDialogContent");
    const actions = document.querySelector("#detailDialogActions");
    document.querySelector("#detailDialogEyebrow").textContent = "DUPLICATE COMPARISON";
    document.querySelector("#detailDialogTitle").textContent = "중복 후보 비교·판정";
    content.innerHTML = [
      "<div class='case-id-row'><span>중복 검사 건</span><strong>" + escapeHtml(item.duplicateCaseId) + "</strong><span>수집 항목</span><strong>" + escapeHtml(item.crawlItemId) + "</strong></div>",
      "<div class='duplicate-comparison-grid'>",
      "<article class='comparison-card candidate-card'><span class='comparison-label'>신규 수집 후보</span><h3>" + escapeHtml(item.candidate.title) + "</h3><dl><div><dt>출처</dt><dd>" + escapeHtml(item.candidate.source) + "</dd></div><div><dt>원문 언어</dt><dd>" + escapeHtml(item.candidate.language) + "</dd></div><div><dt>원문 게시일</dt><dd>" + formatDate(item.candidate.publishedAt) + "</dd></div></dl><a href='" + escapeHtml(item.candidate.url) + "' target='_blank' rel='noopener noreferrer'>후보 원문 보기<i class='fas fa-arrow-up-right-from-square' aria-hidden='true'></i></a></article>",
      "<div class='comparison-score' aria-label='" + methodLabel + "'><span>Jaccard 계수</span><strong class='orbitron'>" + jaccardLabel + "</strong><small>기준 0.92 이상</small></div>",
      "<article class='comparison-card existing-card'><span class='comparison-label'>기존 아티클</span><span class='admin-article-id'>" + escapeHtml(item.matched.articleId) + "</span><h3>" + escapeHtml(item.matched.title) + "</h3><dl><div><dt>출처</dt><dd>" + escapeHtml(item.matched.source) + "</dd></div></dl><a href='" + escapeHtml(item.matched.url) + "' target='_blank' rel='noopener noreferrer'>기존 원문 보기<i class='fas fa-arrow-up-right-from-square' aria-hidden='true'></i></a></article>",
      "</div>",
      "<section class='admin-detail-section'><h4>중복 검사 결과</h4><div class='admin-detail-grid'>" +
      detailFact("검토 기준", methodLabel) +
      detailFact("Jaccard 계수", jaccardLabel) +
      "</div></section>",
      "<p class='decision-guidance'><i class='fas fa-circle-info' aria-hidden='true'></i>Duplicate 판정 시 기존 아티클과 연결하고 후보 처리를 종료합니다. Unique 판정 시 신규 아티클 흐름으로 이동합니다.</p>",
    ].join("");
    actions.hidden = false;
    actions.innerHTML = "<button class='btn-success' type='button' data-modal-action='unique' data-record-id='" + escapeHtml(item.duplicateCaseId) + "'><i class='fas fa-check' aria-hidden='true'></i>Unique</button><button class='btn-danger' type='button' data-modal-action='duplicate' data-record-id='" + escapeHtml(item.duplicateCaseId) + "'><i class='fas fa-link' aria-hidden='true'></i>Duplicate</button>";
    openDialog(document.querySelector("#detailDialog"));
  }

  function openReviewDetail(item) {
    const isQuality = item.reviewType === "quality";
    const content = document.querySelector("#detailDialogContent");
    const actions = document.querySelector("#detailDialogActions");
    document.querySelector("#detailDialogEyebrow").textContent = isQuality ? "QUALITY REVIEW" : "PUBLICATION REVIEW";
    document.querySelector("#detailDialogTitle").textContent = isQuality ? "품질 검토 상세" : "공개 검토 상세";

    const commonFacts = [
      detailFact("검토 작업 ID", item.reviewTaskId, true),
      detailFact("아티클 ID", item.articleId, true),
      detailFact("소스 ID", item.sourceId, true),
      detailFact("수집 방식", item.sourceType),
      detailFact("원본 경로", item.sourcePath, true),
      detailFact("원문 언어", item.language),
      detailFact("원문 게시일", formatDate(item.originalPublishedAt)),
      detailFact("수집 완료", formatDate(item.crawledAt)),
      detailFact("대기 등록", formatDate(item.queuedAt)),
    ].join("");

    if (isQuality) {
      content.innerHTML = [
        "<article class='admin-detail-record'><span class='admin-article-id'>" + escapeHtml(item.articleId) + "</span><h3 class='admin-detail-title'>" + escapeHtml(item.title) + "</h3>",
        "<div class='admin-detail-meta'>" + badge("REVIEW_REQUIRED", "status-pending") + badge("AI 요약 생성 전", "status-hidden") + "</div>",
        "<section class='quality-review-reason'><div><span class='quality-reason-icon'><i class='fas fa-scale-balanced' aria-hidden='true'></i></span><div><h4>검토 필요 사유</h4><p>" + escapeHtml(item.reason) + "</p></div></div></section>",
        "<section class='admin-detail-section quality-signals'><div class='quality-score-block'><span>가치 점수</span><strong class='orbitron'>" + item.valueScore + "</strong><small>/ 100</small></div><div><h4>품질 평가 신호</h4><ul>" + item.signals.map((signal) => "<li>" + escapeHtml(signal) + "</li>").join("") + "</ul></div></section>",
        "<section class='admin-detail-section'><h4>원문 및 처리 정보</h4><div class='admin-detail-grid'>" + commonFacts + detailFact("처리 상태", "QUALITY_EVALUATED") + detailFact("검토 유형", "QUALITY_REVIEW") + "</div></section>",
        "<p class='decision-guidance'><i class='fas fa-circle-info' aria-hidden='true'></i>품질 통과 후 AI 요약을 생성합니다. 현재 정책이 검토 후 공개이므로 요약 완료 뒤 공개 검토 큐로 이동합니다.</p></article>",
      ].join("");
      actions.innerHTML = "<button class='btn-danger' type='button' data-modal-action='reject-quality' data-record-id='" + escapeHtml(item.reviewTaskId) + "'>품질 탈락</button><button class='btn-success' type='button' data-modal-action='pass-quality' data-record-id='" + escapeHtml(item.reviewTaskId) + "'>품질 통과</button>";
    } else {
      content.innerHTML = [
        "<article class='admin-detail-record'><span class='admin-article-id'>" + escapeHtml(item.articleId) + "</span><h3 class='admin-detail-title'>" + escapeHtml(item.title) + "</h3>",
        "<div class='admin-detail-meta'>" + badge("공개 승인 대기", "status-processing") + badge("AI 요약 완료", "status-published") + "</div>",
        "<section class='admin-detail-section'><h4>한 줄 요약</h4><p class='detail-one-line-summary'>" + escapeHtml(item.oneLineSummary) + "</p></section>",
        "<section class='admin-detail-section'><h4>상세 요약</h4><div class='admin-markdown-body'>" + renderMarkdown(item.summaryMarkdown) + "</div></section>",
        "<section class='admin-detail-section detail-score-tags'><div><h4>분야 태그</h4><div class='admin-article-tags'>" + tagsHtml(item.tags) + "</div></div><div><h4>가치 점수</h4><span class='admin-score'>" + item.valueScore + "</span></div></section>",
        "<section class='admin-detail-section'><h4>원문 및 처리 정보</h4><div class='admin-detail-grid'>" + commonFacts + detailFact("처리 상태", "ENRICHED") + detailFact("검토 유형", "PUBLICATION_REVIEW") + "</div></section></article>",
      ].join("");
      actions.innerHTML = "<button class='btn-secondary' type='button' data-modal-action='request-change' data-record-id='" + escapeHtml(item.reviewTaskId) + "'>수정 요청</button><button class='btn-success' type='button' data-modal-action='approve-publication' data-record-id='" + escapeHtml(item.reviewTaskId) + "'><i class='fas fa-check' aria-hidden='true'></i>승인 및 공개</button>";
    }
    actions.hidden = false;
    openDialog(document.querySelector("#detailDialog"));
  }

  function openRecordDetail(id) {
    const record = findRecord(id);
    if (!record) {
      showToast("이미 처리됐거나 목록에서 찾을 수 없는 항목입니다.", "fa-triangle-exclamation");
      return;
    }
    if (view === "inventory") openInventoryDetail(record);
    else if (view === "duplicates") openDuplicateDetail(record);
    else openReviewDetail(record);
  }

  function clearSelection() {
    state.selected.clear();
    syncSelectionUI();
  }

  function selectedRecords() {
    return recordsForView().filter((record) => state.selected.has(recordId(record)));
  }

  function finishQueueMutation(message, iconClass) {
    state.selected.clear();
    persistAdminStore();
    closeDialog(document.querySelector("#detailDialog"));
    renderView();
    syncQueueBadges();
    showToast(message, iconClass || "fa-circle-check");
  }

  function deleteArticles(ids) {
    const removedArticleIds = new Set(ids);
    articles = articles.filter((article) => !removedArticleIds.has(article.articleId));
    duplicateCases = duplicateCases.filter((item) => !removedArticleIds.has(item.matched.articleId));
    reviewTasks = reviewTasks.filter((item) => !removedArticleIds.has(item.articleId));
    finishQueueMutation(ids.length + "개 아티클을 DB와 중복 검사 인덱스에서 영구 삭제했습니다.", "fa-trash-can");
  }

  function setPublication(ids, status) {
    articles.forEach((article) => {
      if (ids.includes(article.articleId)) article.publicationStatus = status;
    });
    finishQueueMutation(ids.length + "개 아티클을 " + (status === "PUBLISHED" ? "공개" : "비공개") + "로 변경했습니다.");
  }

  function resolveDuplicate(id, decision) {
    const item = duplicateCases.find((record) => record.duplicateCaseId === id);
    if (!item) return;
    duplicateCases = duplicateCases.filter((record) => record.duplicateCaseId !== id);
    const message = decision === "duplicate"
      ? "Duplicate로 판정하고 기존 아티클에 연결했습니다."
      : "Unique로 판정하고 신규 아티클 처리 흐름으로 전달했습니다.";
    finishQueueMutation(message, decision === "duplicate" ? "fa-link" : "fa-check");
  }

  function publishReviewedArticle(item) {
    const existing = articles.find((article) => article.articleId === item.articleId);
    if (existing) {
      existing.reviewStatus = "APPROVED";
      existing.publicationStatus = "PUBLISHED";
      existing.recordVersion += 1;
      return;
    }

    const crawledAt = item.crawledAt || new Date().toISOString();
    articles.unshift({
      articleId: item.articleId,
      latestCrawlItemId: "crawl_review_" + item.reviewTaskId.replace(/^revp_/, ""),
      recordVersion: 1,
      title: item.title,
      oneLineSummary: item.oneLineSummary,
      summaryMarkdown: item.summaryMarkdown,
      tags: item.tags || [],
      source: {
        id: item.sourceId,
        name: item.source,
        type: item.sourceType,
        path: item.sourcePath,
      },
      canonicalUrl: "https://example.com" + item.sourcePath,
      originalLanguage: item.language,
      enrichmentLanguage: "한국어 (ko)",
      valueScore: item.valueScore,
      originalPublishedAt: item.originalPublishedAt,
      crawledAt,
      normalizedAt: new Date(new Date(crawledAt).getTime() + 120000).toISOString(),
      processingStatus: "ENRICHED",
      duplicateStatus: "UNIQUE",
      reviewStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
    });
  }

  function resolveReview(id, action) {
    const item = reviewTasks.find((record) => record.reviewTaskId === id);
    if (!item) return;
    if (action === "approve-publication") publishReviewedArticle(item);
    reviewTasks = reviewTasks.filter((record) => record.reviewTaskId !== id);
    const messages = {
      "pass-quality": "품질 통과로 판정해 AI 요약 단계로 전달했습니다.",
      "reject-quality": "품질 탈락으로 처리했습니다.",
      "approve-publication": "공개를 승인했습니다.",
      "request-change": "수정 요청으로 전환했습니다.",
    };
    finishQueueMutation(messages[action], action === "reject-quality" ? "fa-ban" : "fa-circle-check");
  }

  function performBulk(action) {
    const selected = selectedRecords();
    const ids = selected.map(recordId);
    if (!ids.length) {
      showToast("먼저 현재 페이지에서 처리할 항목을 선택해 주세요.");
      return;
    }

    if (action === "publish" || action === "hide") {
      const nextStatus = action === "publish" ? "PUBLISHED" : "HIDDEN";
      askConfirmation({
        title: ids.length + "개 아티클을 " + (action === "publish" ? "공개" : "비공개") + "할까요?",
        description: "현재 페이지에서 선택한 아티클의 공개 상태만 변경합니다.",
        confirmLabel: action === "publish" ? "공개" : "비공개",
        onConfirm: () => setPublication(ids, nextStatus),
      });
      return;
    }

    if (action === "delete") {
      askConfirmation({
        title: ids.length + "개 아티클을 영구 삭제할까요?",
        description: "이 작업은 되돌릴 수 없습니다. 선택한 아티클과 연결된 처리·요약·검토 데이터가 DB에서 완전히 삭제되고 중복 검사 인덱스에서도 더 이상 활용되지 않으므로, 이후 같은 원문이 다시 수집될 수 있습니다.",
        confirmLabel: "영구 삭제",
        danger: true,
        onConfirm: () => deleteArticles(ids),
      });
      return;
    }

    if (action === "mark-unique") {
      askConfirmation({
        title: ids.length + "개 후보를 Unique로 판정할까요?",
        description: "선택한 후보를 신규 아티클 생성·품질 평가 흐름으로 전달하고 중복 의심 큐에서 종료합니다.",
        confirmLabel: "Unique",
        tone: "success",
        onConfirm: () => {
          duplicateCases = duplicateCases.filter((item) => !ids.includes(item.duplicateCaseId));
          finishQueueMutation(ids.length + "개 후보를 Unique로 판정했습니다.", "fa-check");
        },
      });
      return;
    }

    if (action === "mark-duplicate") {
      askConfirmation({
        title: ids.length + "개 후보를 Duplicate로 판정할까요?",
        description: "Jaccard 계수 0.92 이상인 선택 후보를 각각 표시된 기존 아티클에 연결하고 중복 의심 큐에서 종료합니다.",
        confirmLabel: "Duplicate",
        danger: true,
        onConfirm: () => {
          duplicateCases = duplicateCases.filter((item) => !ids.includes(item.duplicateCaseId));
          finishQueueMutation(ids.length + "개 후보를 Duplicate로 판정했습니다.", "fa-link");
        },
      });
      return;
    }

    if (action === "pass-quality" || action === "reject-quality") {
      const passing = action === "pass-quality";
      askConfirmation({
        title: ids.length + "개 아티클을 " + (passing ? "품질 통과" : "품질 탈락") + "로 판정할까요?",
        description: passing
          ? "선택한 아티클을 AI 요약 단계로 전달합니다."
          : "선택한 아티클은 후속 AI 요약과 공개 흐름으로 진행하지 않습니다.",
        confirmLabel: passing ? "품질 통과" : "품질 탈락",
        tone: passing ? "success" : "danger",
        onConfirm: () => {
          reviewTasks = reviewTasks.filter((item) => !ids.includes(item.reviewTaskId));
          finishQueueMutation(
            ids.length + "개 아티클을 " + (passing ? "품질 통과" : "품질 탈락") + "로 판정했습니다.",
            passing ? "fa-check" : "fa-ban",
          );
        },
      });
      return;
    }

    if (action === "approve-publication") {
      askConfirmation({
        title: ids.length + "개 아티클의 공개를 승인할까요?",
        description: "AI 요약이 완료된 공개 검토 항목만 즉시 공개됩니다.",
        confirmLabel: "승인 및 공개",
        tone: "success",
        onConfirm: () => {
          selected.forEach(publishReviewedArticle);
          reviewTasks = reviewTasks.filter((item) => !ids.includes(item.reviewTaskId));
          finishQueueMutation(ids.length + "개 아티클의 공개를 승인했습니다.");
        },
      });
    }
  }

  function handleModalAction(button) {
    const action = button.dataset.modalAction;
    const id = button.dataset.recordId;
    if (action === "duplicate" || action === "unique") {
      const label = action === "duplicate" ? "Duplicate" : "Unique";
      const duplicateItem = duplicateCases.find((item) => item.duplicateCaseId === id);
      const duplicateCriterion = "Jaccard 계수 " + (duplicateItem?.jaccardCoefficient?.toFixed(2) || "—") + "가 기준 0.92 이상인 후보를 기존 아티클에 연결하고 중복 처리 흐름을 종료합니다.";
      askConfirmation({
        title: label + "로 판정할까요?",
        description: action === "duplicate"
          ? duplicateCriterion
          : "후보를 UNIQUE로 판정하고 아티클 생성·품질 평가 흐름으로 전달합니다.",
        confirmLabel: label,
        tone: action === "duplicate" ? "danger" : "success",
        onConfirm: () => resolveDuplicate(id, action),
      });
      return;
    }

    const confirmation = {
      "pass-quality": ["품질 통과로 판정할까요?", "AI 요약 단계로 전달되며, 요약 완료 후 현재 공개 정책이 적용됩니다.", "품질 통과", "success"],
      "reject-quality": ["품질 탈락으로 판정할까요?", "이 아티클은 후속 AI 요약과 공개 흐름으로 진행하지 않습니다.", "품질 탈락", "danger"],
      "approve-publication": ["공개를 승인할까요?", "검토가 완료되면 아티클이 공개 페이지에 표시됩니다.", "승인 및 공개", "success"],
      "request-change": ["수정 요청으로 전환할까요?", "공개하지 않고 콘텐츠 수정이 필요한 항목으로 전환합니다.", "수정 요청", "primary"],
    }[action];
    if (!confirmation) return;
    askConfirmation({
      title: confirmation[0],
      description: confirmation[1],
      confirmLabel: confirmation[2],
      tone: confirmation[3],
      onConfirm: () => resolveReview(id, action),
    });
  }

  function resetFilters() {
    state.query = "";
    state.filter = "all";
    state.sort = "newest";
    state.page = 1;
    state.selected.clear();
    renderView();
  }

  function closeSidebar() {
    const sidebar = document.querySelector("#adminSidebar");
    const backdrop = document.querySelector("[data-sidebar-backdrop]");
    const toggle = document.querySelector("#sidebarToggle");
    sidebar.classList.remove("open");
    document.body.classList.remove("sidebar-is-open");
    backdrop.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "관리자 메뉴 열기");
  }

  function toggleSidebar() {
    const sidebar = document.querySelector("#adminSidebar");
    const backdrop = document.querySelector("[data-sidebar-backdrop]");
    const toggle = document.querySelector("#sidebarToggle");
    const open = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", open);
    document.body.classList.toggle("sidebar-is-open", open);
    backdrop.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "관리자 메뉴 닫기" : "관리자 메뉴 열기");
  }

  function handleClick(event) {
    const target = event.target;
    const demoLink = target.closest("[data-demo-link]");
    if (demoLink) {
      event.preventDefault();
      showToast("이 목업에서는 Tech Articles 관리 경로만 동작합니다.");
      return;
    }
    if (target.closest("[data-demo-action]")) {
      showToast("팀 검토용 목업에서는 로그아웃을 실행하지 않습니다.");
      return;
    }
    if (target.closest("#sidebarToggle")) {
      toggleSidebar();
      return;
    }
    if (target.closest("[data-sidebar-backdrop]")) {
      closeSidebar();
      return;
    }
    if (target.closest("[data-close-detail]")) {
      closeDialog(document.querySelector("#detailDialog"));
      return;
    }
    if (target.closest("[data-cancel-confirm]")) {
      const onCancel = confirmCancelHandler;
      confirmHandler = null;
      confirmCancelHandler = null;
      closeDialog(document.querySelector("#confirmDialog"));
      if (onCancel) onCancel();
      return;
    }
    if (target.closest("#confirmDialogButton")) {
      const handler = confirmHandler;
      confirmHandler = null;
      confirmCancelHandler = null;
      closeDialog(document.querySelector("#confirmDialog"));
      if (handler) handler();
      return;
    }

    const modalAction = target.closest("[data-modal-action]");
    if (modalAction) {
      handleModalAction(modalAction);
      return;
    }
    const reviewTab = target.closest("[data-review-tab]");
    if (reviewTab) {
      state.reviewType = reviewTab.dataset.reviewTab;
      state.page = 1;
      state.query = "";
      state.filter = "all";
      state.sort = "newest";
      state.selected.clear();
      const url = new URL(window.location.href);
      url.searchParams.set("type", state.reviewType);
      window.history.replaceState({}, "", url);
      renderView();
      return;
    }
    if (target.closest("[data-reset-filters]")) {
      resetFilters();
      return;
    }
    if (target.closest("[data-clear-selection]")) {
      clearSelection();
      return;
    }
    const pageButton = target.closest("[data-page]");
    if (pageButton && !pageButton.disabled) {
      state.page = Number(pageButton.dataset.page);
      state.selected.clear();
      renderList();
      document.querySelector("#recordListTitle")?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    const recordAction = target.closest("[data-record-action]");
    if (recordAction) {
      const id = recordAction.dataset.recordId;
      if (recordAction.dataset.recordAction === "detail") openRecordDetail(id);
      if (recordAction.dataset.recordAction === "delete") {
        const article = findRecord(id);
        askConfirmation({
          title: "아티클을 영구 삭제할까요?",
          description: article.title + " 아티클과 연결된 처리·요약·검토 데이터가 DB에서 완전히 삭제되고 중복 검사 인덱스에서도 더 이상 활용되지 않습니다. 이 작업은 되돌릴 수 없으며, 이후 같은 원문이 다시 수집될 수 있습니다.",
          confirmLabel: "영구 삭제",
          danger: true,
          onConfirm: () => deleteArticles([id]),
        });
      }
      return;
    }
    const bulkAction = target.closest("[data-bulk-action]");
    if (bulkAction) performBulk(bulkAction.dataset.bulkAction);
  }

  function handleInput(event) {
    if (event.target.id !== "queryInput") return;
    state.query = event.target.value;
    state.page = 1;
    state.selected.clear();
    renderList();
  }

  function handleChange(event) {
    const target = event.target;
    if (target.id === "recordFilter") {
      state.filter = target.value;
      state.page = 1;
      state.selected.clear();
      renderList();
      return;
    }
    if (target.id === "sortSelect") {
      state.sort = target.value;
      state.page = 1;
      state.selected.clear();
      renderList();
      return;
    }
    if (target.id === "selectCurrentPage") {
      currentPageRecords().forEach((record) => {
        const id = recordId(record);
        if (target.checked) state.selected.add(id);
        else state.selected.delete(id);
      });
      syncSelectionUI();
      return;
    }
    if (target.matches("[data-select-record]")) {
      if (target.checked) state.selected.add(target.dataset.selectRecord);
      else state.selected.delete(target.dataset.selectRecord);
      syncSelectionUI();
      return;
    }
    if (target.matches("[data-publication-toggle]")) {
      const article = articles.find((item) => item.articleId === target.dataset.publicationToggle);
      if (!article) return;
      article.publicationStatus = target.checked ? "PUBLISHED" : "HIDDEN";
      persistAdminStore();
      renderView();
      showToast(target.checked ? "아티클을 공개했습니다." : "아티클을 비공개로 변경했습니다.", target.checked ? "fa-eye" : "fa-eye-slash");
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (event.target.id !== "policyForm") return;
    const nextPolicy = new FormData(event.target).get("publicationPolicy");
    if (nextPolicy === state.policy) {
      showToast("현재 적용 중인 정책과 같습니다.");
      return;
    }
    askConfirmation({
      title: nextPolicy === "immediate" ? "즉시 공개 정책으로 변경할까요?" : "검토 후 공개 정책으로 변경할까요?",
      description: "변경한 정책은 저장 이후 새로 등록되는 아티클부터 적용됩니다.",
      confirmLabel: "정책 저장",
      onCancel: () => renderView(),
      onConfirm: () => {
        state.policy = nextPolicy;
        persistAdminStore();
        renderView();
        showToast("새 아티클 공개 정책을 저장했습니다.", "fa-shield-halved");
      },
    });
  }

  function bindInteractions() {
    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("submit", handleSubmit);
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          if (dialog.id === "confirmDialog") {
            const onCancel = confirmCancelHandler;
            confirmHandler = null;
            confirmCancelHandler = null;
            if (onCancel) onCancel();
          }
          closeDialog(dialog);
        }
      });
      dialog.addEventListener("cancel", () => {
        if (dialog.id !== "confirmDialog") return;
        const onCancel = confirmCancelHandler;
        confirmHandler = null;
        confirmCancelHandler = null;
        if (onCancel) onCancel();
      });
    });
    document.querySelector("#adminSidebar").addEventListener("click", (event) => {
      if (event.target.closest("a") && window.innerWidth <= 900) closeSidebar();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeSidebar();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.querySelector("#adminSidebar").classList.contains("open")) closeSidebar();
    });
  }

  if (app) {
    app.removeAttribute("aria-live");
    app.innerHTML = renderShell();
    bindInteractions();
    renderView();
  }
})();
