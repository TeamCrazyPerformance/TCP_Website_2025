#!/usr/bin/env node
/**
 * TCP 기술 아티클 — 프론트엔드 전용 목(mock) API 서버
 *
 * 목적: MySQL / Python 파이프라인 / NestJS 없이 React 화면만 더미 데이터로 확인하기.
 * 의존성 없음(Node 18+ 내장 모듈만 사용). 데이터는 메모리에만 있고 재시작하면 초기화됩니다.
 *
 *   node mock-tech-articles-api.mjs            # 기본 포트 3000
 *   PORT=4000 node mock-tech-articles-api.mjs  # 포트 변경
 *   MOCK_HOST=0.0.0.0 node mock-tech-articles-api.mjs  # 명시적으로 외부 접근 허용
 *
 * 주의: 실제 API 계약의 "표시에 필요한 부분"만 흉내 냅니다. 검증·권한·동시성은 없습니다.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.MOCK_HOST || "localhost";
const ARTICLE_COUNT = Number(process.env.MOCK_ARTICLE_COUNT || 72);

/* ------------------------------------------------------------------ *
 * 결정론적 난수 (실행할 때마다 같은 더미 데이터가 나오도록)
 * ------------------------------------------------------------------ */
let seed = 20260820;
const rand = () =>
  (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickN = (list, n) => {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length)
    out.push(...pool.splice(Math.floor(rand() * pool.length), 1));
  return out;
};
const intBetween = (min, max) => min + Math.floor(rand() * (max - min + 1));

/* ------------------------------------------------------------------ *
 * 고정 어휘 — 프론트엔드 TAG_CLASS_NAMES와 철자가 정확히 일치해야 합니다
 * ------------------------------------------------------------------ */
const TAGS = [
  "AI",
  "애플리케이션 개발",
  "모바일",
  "프로그래밍 언어",
  "데이터",
  "클라우드",
  "DevOps",
  "보안",
  "네트워크",
  "소프트웨어 아키텍처",
  "개발자 도구",
  "소프트웨어 품질",
  "오픈소스",
  "개발 조직",
  "산업 동향",
];

const SOURCES = [
  {
    id: "cloudflare-blog",
    name: "Cloudflare Blog",
    type: "RSS",
    domain: "blog.cloudflare.com",
    path: "/rss",
  },
  {
    id: "infoq",
    name: "InfoQ",
    type: "RSS",
    domain: "www.infoq.com",
    path: "/rss/news",
  },
  {
    id: "sdtimes",
    name: "SD Times",
    type: "RSS",
    domain: "sdtimes.com",
    path: "/feed",
  },
];

const LANGS = [
  { code: "en", label: "영어" },
  { code: "ko", label: "한국어" },
];

const TITLES = [
  [
    "엣지 런타임의 콜드 스타트를 40% 줄인 방법",
    "How we cut edge cold starts by 40%",
  ],
  [
    "대규모 Kafka 클러스터 운영에서 배운 것",
    "Lessons from running Kafka at scale",
  ],
  [
    "쿠버네티스 1.34 스케줄러 변경점 정리",
    "What changed in the Kubernetes 1.34 scheduler",
  ],
  [
    "Rust 비동기 클로저 안정화가 바꾸는 것",
    "Stabilized async closures in Rust",
  ],
  [
    "LLM 추론 비용을 절반으로 줄인 캐싱 전략",
    "Halving LLM inference cost with caching",
  ],
  [
    "PostgreSQL 18의 논리적 복제 개선",
    "Logical replication improvements in PostgreSQL 18",
  ],
  [
    "제로 트러스트 네트워크 도입 6개월 회고",
    "Six months of zero trust networking",
  ],
  [
    "모노레포에서 빌드 시간을 지키는 방법",
    "Keeping build times sane in a monorepo",
  ],
  ["React 서버 컴포넌트 실전 도입기", "React Server Components in production"],
  [
    "관측 가능성 비용을 통제하는 샘플링 설계",
    "Designing sampling to control observability cost",
  ],
  [
    "WASM으로 플러그인 시스템을 다시 만들기",
    "Rebuilding our plugin system on WASM",
  ],
  [
    "점진적 타입 마이그레이션 3년의 기록",
    "Three years of gradual type migration",
  ],
  ["장애 대응 훈련을 습관으로 만드는 법", "Making incident drills a habit"],
  ["모바일 앱 시작 시간 예산 관리하기", "Budgeting mobile app startup time"],
  [
    "오픈소스 유지보수자의 번아웃 다루기",
    "Handling maintainer burnout in open source",
  ],
  ["gRPC에서 HTTP/3로 옮기며 배운 것", "What we learned moving gRPC to HTTP/3"],
  [
    "벡터 데이터베이스 선택 기준 정리",
    "Criteria for choosing a vector database",
  ],
  ["CI 캐시 적중률을 90%로 끌어올리기", "Pushing CI cache hit rate to 90%"],
  ["설계 문서를 실제로 읽게 만드는 방법", "Getting design docs actually read"],
  [
    "공급망 보안을 위한 SBOM 실전 적용",
    "Applying SBOM for supply chain security",
  ],
];

const SUMMARIES = [
  "운영 환경에서 직접 측정한 수치를 바탕으로 개선 과정을 단계별로 설명합니다.",
  "도입 전후의 지표 변화와 예상하지 못했던 부작용까지 함께 정리했습니다.",
  "작은 팀이 큰 시스템을 다룰 때 선택할 수 있는 현실적인 절충안을 다룹니다.",
  "이론보다 실제 장애 사례에서 출발해 대응 방법을 역순으로 추적합니다.",
  "비슷한 결정을 앞둔 팀이 바로 참고할 수 있도록 체크리스트를 덧붙였습니다.",
  "성능 개선의 대부분이 특정 한 지점에서 나왔다는 점을 데이터로 보여줍니다.",
];

const markdown = (title) => `### 무엇이 달라졌나

${pick(SUMMARIES)}

- 변경 범위는 서비스 경계 안쪽으로 제한했습니다
- 롤백 경로를 먼저 확보한 뒤 단계적으로 적용했습니다
- 측정 지표는 배포 전 2주, 배포 후 4주를 비교했습니다

### 도입할 때 확인할 점

1. 기존 구성과의 호환성을 스테이징에서 최소 한 주기 관찰합니다.
2. 관측 지표 이름이 바뀌므로 대시보드 수정이 필요합니다.
3. 팀 내 온콜 문서를 함께 갱신해야 혼선이 없습니다.

> \`${title}\` 는 데모용 더미 본문입니다. 실제 수집 결과가 아닙니다.`;

/* ------------------------------------------------------------------ *
 * 더미 아티클 생성
 * ------------------------------------------------------------------ */
// 파이프라인이 실제로 만들 수 있는 상태 조합만 쓴다.
// 세 축을 따로 뽑아 섞으면 도달 불가능한 조합이 나오고, 화면 오류로 오인하게 된다.
//
// 도달 경로 (tech-article-pipeline/core/.../persistence/mysql.py)
//   최초 적재                     INGESTED            / NOT_REQUIRED
//   품질 PASS                     ENRICHMENT_PENDING  / NOT_REQUIRED
//   품질 REVIEW_REQUIRED          QUALITY_EVALUATED   / PENDING
//   품질 REJECT                   QUALITY_REJECTED    / NOT_REQUIRED
//   검토 승인                     ENRICHMENT_PENDING  / APPROVED
//   검토 반려                     QUALITY_REJECTED    / REJECTED
//   AI 요약 완료 + 즉시 공개 정책  ENRICHED            / NOT_REQUIRED / PUBLISHED
//   AI 요약 완료 + 검토 후 공개    ENRICHED            / PENDING      / UNPUBLISHED
//   공개 액션                     publicationStatus 만 변경
//
// 미사용 값: IN_REVIEW, CHANGES_REQUESTED, SCHEDULED (DB 제약에는 있으나 기록 경로 없음)
const REACHABLE_STATES = [
  ["ENRICHED", "NOT_REQUIRED", "PUBLISHED"],
  ["ENRICHED", "NOT_REQUIRED", "HIDDEN"],
  ["ENRICHED", "NOT_REQUIRED", "ARCHIVED"],
  ["ENRICHED", "PENDING", "UNPUBLISHED"],
  ["ENRICHED", "APPROVED", "PUBLISHED"],
  ["ENRICHMENT_PENDING", "NOT_REQUIRED", "UNPUBLISHED"],
  ["ENRICHMENT_PENDING", "APPROVED", "UNPUBLISHED"],
  ["QUALITY_EVALUATED", "PENDING", "UNPUBLISHED"],
  ["QUALITY_REJECTED", "NOT_REQUIRED", "UNPUBLISHED"],
  ["QUALITY_REJECTED", "REJECTED", "UNPUBLISHED"],
  ["INGESTED", "NOT_REQUIRED", "UNPUBLISHED"],
  // 실패는 직전 상태를 유지한 채 처리 단계만 바뀐다
  ["PROCESSING_FAILED", "NOT_REQUIRED", "UNPUBLISHED"],
];

const iso = (daysAgo, hourOffset = 0) =>
  new Date(
    Date.UTC(2026, 7, 20, 3, 0, 0) - daysAgo * 86400000 + hourOffset * 3600000,
  ).toISOString();

const articles = Array.from({ length: ARTICLE_COUNT }, (_, index) => {
  const [title, originalTitle] = TITLES[index % TITLES.length];
  const suffix =
    index >= TITLES.length
      ? ` (${Math.floor(index / TITLES.length) + 1}편)`
      : "";
  const source = pick(SOURCES);
  // 라운드로빈으로 배정해 모든 상태 조합이 최소 한 번씩 화면에 나오도록 한다.
  // 앞 6건은 공개 목록이 비어 보이지 않도록 공개 상태로 고정한다.
  const [processingStatus, reviewStatus, publicationStatus] =
    index < 6
      ? REACHABLE_STATES[0]
      : REACHABLE_STATES[index % REACHABLE_STATES.length];
  const daysAgo = index * 0.7 + 0.2;

  return {
    articleId: `article-2026081${(index % 9) + 1}-${String(index + 1).padStart(4, "0")}`,
    recordVersion: intBetween(1, 6),
    title: title + suffix,
    originalTitle,
    authors: pickN(
      ["김도현", "박지훈", "이서연", "Sarah Kim", "Marco Rossi"],
      intBetween(1, 2),
    ),
    oneLineSummary: pick(SUMMARIES),
    summaryMarkdown: markdown(originalTitle),
    tags: pickN(TAGS, intBetween(2, 4)),
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
      domain: source.domain,
      path: `${source.path}/${index + 1}`,
      articleUrl: `https://${source.domain}/demo/${index + 1}`,
    },
    canonicalUrl: `https://${source.domain}/demo/${index + 1}`,
    originalLanguage: index % 5 === 0 ? LANGS[1] : LANGS[0],
    valueScore: intBetween(41, 98),
    originalPublishedAt: iso(daysAgo),
    collectedAt: iso(daysAgo, 2),
    crawledAt: iso(daysAgo, 2),
    normalizedAt: iso(daysAgo, 2.5),
    processingStatus,
    duplicateStatus: "UNIQUE",
    reviewStatus,
    publicationStatus,
    publishedAt: publicationStatus === "PUBLISHED" ? iso(daysAgo, 3) : null,
    createdAt: iso(daysAgo, 2),
    updatedAt: iso(daysAgo, 3),
  };
});

// 세 검수 큐가 비어 보이지 않도록 일부 아티클의 상태를 명시적으로 고정한다
articles.slice(24, 30).forEach((a) => {
  a.processingStatus = "ENRICHED";
  a.reviewStatus = "PENDING";
  a.publicationStatus = "UNPUBLISHED";
  a.publishedAt = null;
});
articles.slice(30, 36).forEach((a) => {
  a.processingStatus = "QUALITY_EVALUATED";
  a.reviewStatus = "PENDING";
  a.publicationStatus = "UNPUBLISHED";
  a.publishedAt = null;
});
// 공개 목록이 2페이지 이상이 되도록 공개 아티클을 충분히 확보한다
articles.slice(36, 48).forEach((a) => {
  a.processingStatus = "ENRICHED";
  a.reviewStatus = "APPROVED";
  a.publicationStatus = "PUBLISHED";
  a.publishedAt = a.normalizedAt;
});

// 실제 파이프라인은 품질 평가 결과를 저장할 때 처음으로 점수를 기록한다.
// INGESTED 는 자동 품질 평가 전 단계이므로 점수와 판정값이 없다.
articles
  .filter((article) => article.processingStatus === "INGESTED")
  .forEach((article) => {
    article.valueScore = null;
  });

const LAST_CRAWLED_AT = iso(0, -1);

const evaluationOf = (article, flat) => {
  const overall = article.valueScore;
  if (typeof overall !== "number") return null;
  const dimensions = {
    relevance: Math.min(100, overall + 4),
    timeliness: Math.max(0, overall - 3),
    sourceReliability: Math.min(100, overall + 1),
  };
  const decision =
    overall >= 70 ? "PASS" : overall >= 45 ? "REVIEW_REQUIRED" : "REJECT";
  return {
    decision,
    reason:
      decision === "PASS"
        ? "품질 기준점 이상입니다."
        : decision === "REVIEW_REQUIRED"
          ? "가치 점수가 경계 구간이라 관리자 확인이 필요합니다."
          : "품질 점수가 최소 검토 범위보다 낮습니다.",
    // 실제 스키마와 동일 (modules/quality/.../models.py 의 Signals)
    signals: {
      contentLength: 400 + overall * 12,
      language: article.originalLanguage?.code || "en",
      contentComplete: overall >= 45,
      spamSuspected: false,
      advertisementSuspected: overall < 45,
    },
    score: flat ? { overall, ...dimensions } : { overall, dimensions },
  };
};

/* ------------------------------------------------------------------ *
 * 공통 헬퍼
 * ------------------------------------------------------------------ */
const paginate = (rows, page, pageSize) => {
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: rows.slice((current - 1) * pageSize, current * pageSize),
    pagination: { totalCount, currentPage: current, totalPages, pageSize },
  };
};

const publicItem = (a) => ({
  id: a.articleId,
  title: a.title,
  oneLineSummary: a.oneLineSummary,
  tags: a.tags,
  source: a.source,
  originalLanguage: a.originalLanguage,
  originalPublishedAt: a.originalPublishedAt,
  collectedAt: a.collectedAt,
  score: a.valueScore,
});

// 관리자 승인이 실제로 있었던 아티클. 서버는 quality_review_cases 를 보지만
// 목 서버에는 그 테이블이 없어 여기에 기록합니다. review_status 를 보면 공개
// 토글이 덮어쓴 값에 속으므로 절대 그 값을 쓰지 않습니다.
const resolvedApprovals = new Set();

// 승인 뒤 요약만 실패한 건(재처리 대상)이 화면에 하나는 보이도록 고정합니다.
// 실제 서버에서는 quality_review_cases 의 RESOLVED_APPROVE 가 이 자리를 대신합니다.
for (const seed of articles
  .filter((a) => a.processingStatus === "PROCESSING_FAILED")
  .slice(0, 1)) {
  resolvedApprovals.add(seed.articleId);
}

// tech_article_pipeline.persistence.mysql.STAGE_PREDICATES 와 같은 판정입니다.
// 한쪽만 고치면 화면이 목 서버에서만 다르게 보입니다.
function articleStage(a) {
  switch (a.processingStatus) {
    case "INGESTED":
      return "INGESTED";
    case "QUALITY_EVALUATED":
      return "QUALITY_REVIEW";
    case "ENRICHMENT_PENDING":
      return "ENRICHING";
    case "QUALITY_REJECTED":
      return "QUALITY_REJECTED";
    case "ENRICHED":
      return a.reviewStatus === "PENDING" &&
        a.publicationStatus === "UNPUBLISHED"
        ? "PUBLICATION_REVIEW"
        : "COMPLETED";
    case "PROCESSING_FAILED":
      return resolvedApprovals.has(a.articleId)
        ? "FAILED_AFTER_APPROVAL"
        : "FAILED";
    default:
      return "UNKNOWN";
  }
}

const STAGE_NAMES = [
  "INGESTED",
  "QUALITY_REVIEW",
  "ENRICHING",
  "PUBLICATION_REVIEW",
  "COMPLETED",
  "FAILED_AFTER_APPROVAL",
  "FAILED",
  "QUALITY_REJECTED",
];

// 검토 상태 표시 오류. 단계 축과 별개입니다.
const APPROVED_COMPATIBLE = [
  "ENRICHMENT_PENDING",
  "ENRICHED",
  "PROCESSING_FAILED",
];
const hasStatusMismatch = (a) =>
  a.reviewStatus === "APPROVED" &&
  !APPROVED_COMPATIBLE.includes(a.processingStatus);

const adminItem = (a) => ({
  ...a,
  evaluation: evaluationOf(a, false),
  score: a.valueScore,
  stage: articleStage(a),
});

const isPublic = (a) =>
  a.processingStatus === "ENRICHED" && a.publicationStatus === "PUBLISHED";
const byNewest = (x, y) =>
  new Date(y.originalPublishedAt) - new Date(x.originalPublishedAt);

/* ------------------------------------------------------------------ *
 * 검수 큐 / 정책 / 수집 상태 (메모리 상태)
 * ------------------------------------------------------------------ */
const duplicateCases = articles.slice(10, 15).map((a, i) => {
  const matched = articles[(i + 20) % articles.length];
  return {
    reviewCaseId: `dupcase-2026081-${String(i + 1).padStart(3, "0")}`,
    caseVersion: 1,
    crawlRunId: `run-20260819-${String(i + 1).padStart(3, "0")}`,
    crawlItemId: `item-20260819-${String(i + 1).padStart(4, "0")}`,
    candidate: {
      title: a.title,
      source: a.source,
      originalLanguage: a.originalLanguage,
      originalPublishedAt: a.originalPublishedAt,
    },
    candidates: [
      {
        articleId: matched.articleId,
        matchedBy: ["CONTENT_JACCARD", "MINHASH"],
        contentJaccard: 0.8 + i * 0.03,
        minHashSimilarity: 0.78 + i * 0.03,
        titleSimilarity: 0.7 + i * 0.04,
        article: {
          articleId: matched.articleId,
          title: matched.title,
          source: matched.source,
          articleUrl: matched.canonicalUrl,
          originalLanguage: matched.originalLanguage,
          originalPublishedAt: matched.originalPublishedAt,
        },
      },
    ],
    matched:
      i === 4
        ? null
        : {
            articleId: matched.articleId,
            title: matched.title,
            source: matched.source,
            articleUrl: matched.canonicalUrl,
            originalLanguage: matched.originalLanguage,
            originalPublishedAt: matched.originalPublishedAt,
          },
    matchType: "CONTENT_JACCARD",
    jaccardCoefficient: 0.8 + i * 0.03,
    queuedAt: iso(i + 1, 5),
  };
});

const qualityCases = articles
  .filter((a) => a.processingStatus === "QUALITY_EVALUATED")
  .slice(0, 6)
  .map((a, i) => {
    const evaluation = evaluationOf(a, false);
    return {
      caseId: `qcase-2026081-${String(i + 1).padStart(3, "0")}`,
      caseVersion: 1,
      articleId: a.articleId,
      title: a.title,
      source: a.source,
      sourceType: a.source.type,
      originalLanguage: a.originalLanguage,
      originalPublishedAt: a.originalPublishedAt,
      evaluation,
      valueScore: a.valueScore,
      reason: evaluation.reason,
      signals: evaluation.signals,
      queuedAt: iso(i + 1, 6),
    };
  });

const publicationQueue = () =>
  articles
    // 파이프라인의 공개 검토 큐 조건과 동일 (mysql.py _review_conditions)
    .filter(
      (a) =>
        a.processingStatus === "ENRICHED" &&
        a.reviewStatus === "PENDING" &&
        a.publicationStatus !== "PUBLISHED",
    )
    .map((a) => ({
      ...adminItem(a),
      reason: "공개 검토 승인 대기 중입니다.",
      queuedAt: a.normalizedAt,
    }));

let publicationPolicy = {
  policy: "REVIEW",
  recordVersion: 1,
  updatedAt: iso(3),
  updatedBy: "mock-admin",
};

const crawlRunTime = (minutesAgo) =>
  new Date(Date.now() - minutesAgo * 60000).toISOString();
const demoCrawlRuns = [
  {
    crawlRunId: "crawl-demo-running-cloudflare",
    sourceId: "cloudflare-blog",
    sourceType: "RSS",
    sectionKey: "BLOG",
    trigger: "SCHEDULED",
    status: "RUNNING",
    requestedAt: crawlRunTime(3),
    createdAt: crawlRunTime(3),
    startedAt: crawlRunTime(2),
    completedAt: null,
    updatedAt: crawlRunTime(1),
    statistics: null,
    itemCount: 0,
    error: null,
    job: {
      jobId: "job-demo-running-cloudflare",
      status: "RUNNING",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-queued-infoq",
    sourceId: "infoq",
    sourceType: "WEB_CRAWL",
    sectionKey: "ENGINEERING",
    trigger: "MANUAL",
    status: "QUEUED",
    requestedAt: crawlRunTime(6),
    createdAt: crawlRunTime(6),
    startedAt: null,
    completedAt: null,
    updatedAt: crawlRunTime(6),
    statistics: null,
    itemCount: 0,
    error: null,
    job: {
      jobId: "job-demo-queued-infoq",
      status: "PENDING",
      attemptCount: 0,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-completed-infoq",
    sourceId: "infoq",
    sourceType: "RSS",
    sectionKey: "NEWS",
    trigger: "SCHEDULED",
    status: "COMPLETED",
    requestedAt: crawlRunTime(74),
    createdAt: crawlRunTime(74),
    startedAt: crawlRunTime(73),
    completedAt: crawlRunTime(68),
    updatedAt: crawlRunTime(68),
    statistics: {
      pagesVisited: 1,
      articlesDiscovered: 20,
      articlesExcludedByAge: 2,
      articlesAttempted: 18,
      articlesSucceeded: 18,
      articlesFailed: 0,
    },
    itemCount: 18,
    error: null,
    job: {
      jobId: "job-demo-completed-infoq",
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-completed-github-trending",
    sourceId: "github-trending",
    sourceType: "WEB_CRAWL",
    sectionKey: "REPOSITORIES",
    trigger: "MANUAL",
    status: "COMPLETED",
    requestedAt: crawlRunTime(46),
    createdAt: crawlRunTime(46),
    startedAt: crawlRunTime(45),
    completedAt: crawlRunTime(43),
    updatedAt: crawlRunTime(43),
    statistics: {
      pagesVisited: 4,
      articlesDiscovered: 3,
      articlesExcludedByAge: 0,
      articlesAttempted: 3,
      articlesSucceeded: 3,
      articlesFailed: 0,
    },
    itemCount: 3,
    error: null,
    job: {
      jobId: "job-demo-completed-github-trending",
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-partial-sdtimes",
    sourceId: "sdtimes",
    sourceType: "WEB_CRAWL",
    sectionKey: "NEWS",
    trigger: "MANUAL",
    status: "PARTIALLY_COMPLETED",
    requestedAt: crawlRunTime(145),
    createdAt: crawlRunTime(145),
    startedAt: crawlRunTime(144),
    completedAt: crawlRunTime(132),
    updatedAt: crawlRunTime(132),
    statistics: {
      pagesVisited: 3,
      articlesDiscovered: 15,
      articlesExcludedByAge: 0,
      articlesAttempted: 15,
      articlesSucceeded: 12,
      articlesFailed: 3,
    },
    itemCount: 15,
    error: null,
    job: {
      jobId: "job-demo-partial-sdtimes",
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-retry-infoq",
    sourceId: "infoq",
    sourceType: "WEB_CRAWL",
    sectionKey: "NEWS",
    trigger: "SCHEDULED",
    status: "RETRY",
    requestedAt: crawlRunTime(218),
    createdAt: crawlRunTime(218),
    startedAt: crawlRunTime(217),
    completedAt: null,
    updatedAt: crawlRunTime(207),
    statistics: null,
    itemCount: 0,
    error: {
      code: "UPSTREAM_TIMEOUT",
      message: "원문 서버 응답 시간이 초과되어 재시도를 기다립니다.",
      retryable: true,
    },
    job: {
      jobId: "job-demo-retry-infoq",
      status: "RETRY",
      attemptCount: 2,
      maxAttempts: 3,
      error: {
        code: "UPSTREAM_TIMEOUT",
        message: "원문 서버 응답 시간이 초과되어 재시도를 기다립니다.",
        retryable: true,
      },
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-failed-cloudflare",
    sourceId: "cloudflare-blog",
    sourceType: "RSS",
    sectionKey: "BLOG",
    trigger: "SCHEDULED",
    status: "FAILED",
    requestedAt: crawlRunTime(305),
    createdAt: crawlRunTime(305),
    startedAt: crawlRunTime(304),
    completedAt: crawlRunTime(291),
    updatedAt: crawlRunTime(291),
    statistics: null,
    itemCount: 0,
    error: {
      code: "SOURCE_UNAVAILABLE",
      message: "수집 소스가 반복해서 503 응답을 반환했습니다.",
      retryable: false,
    },
    job: {
      jobId: "job-demo-failed-cloudflare",
      status: "DEAD",
      attemptCount: 3,
      maxAttempts: 3,
      error: {
        code: "SOURCE_UNAVAILABLE",
        message: "수집 소스가 반복해서 503 응답을 반환했습니다.",
        retryable: false,
      },
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-completed-sdtimes-api",
    sourceId: "sdtimes",
    sourceType: "API",
    sectionKey: "NEWS",
    trigger: "MANUAL",
    status: "COMPLETED",
    requestedAt: crawlRunTime(495),
    createdAt: crawlRunTime(495),
    startedAt: crawlRunTime(494),
    completedAt: crawlRunTime(489),
    updatedAt: crawlRunTime(489),
    statistics: {
      pagesVisited: 1,
      articlesDiscovered: 15,
      articlesExcludedByAge: 3,
      articlesAttempted: 12,
      articlesSucceeded: 12,
      articlesFailed: 0,
    },
    itemCount: 12,
    error: null,
    job: {
      jobId: "job-demo-completed-sdtimes-api",
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
  {
    crawlRunId: "crawl-demo-completed-cloudflare",
    sourceId: "cloudflare-blog",
    sourceType: "RSS",
    sectionKey: "BLOG",
    trigger: "SCHEDULED",
    status: "COMPLETED",
    requestedAt: crawlRunTime(1510),
    createdAt: crawlRunTime(1510),
    startedAt: crawlRunTime(1509),
    completedAt: crawlRunTime(1503),
    updatedAt: crawlRunTime(1503),
    statistics: {
      pagesVisited: 1,
      articlesDiscovered: 10,
      articlesExcludedByAge: 1,
      articlesAttempted: 9,
      articlesSucceeded: 9,
      articlesFailed: 0,
    },
    itemCount: 9,
    error: null,
    job: {
      jobId: "job-demo-completed-cloudflare",
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  },
];

const demoHistoricalCrawlRuns = Array.from({ length: 15 }, (_, index) => {
  const sources = [
    { sourceId: "cloudflare-blog", sourceType: "RSS", sectionKey: "BLOG" },
    { sourceId: "infoq", sourceType: "RSS", sectionKey: "NEWS" },
    { sourceId: "sdtimes", sourceType: "API", sectionKey: "NEWS" },
  ];
  const source = sources[index % sources.length];
  const discovered = 8 + (index % 8);
  const excluded = index % 3;
  const succeeded = discovered - excluded;
  const requestedMinutesAgo = 1800 + index * 180;
  const crawlRunId = `crawl-demo-archive-${String(index + 1).padStart(2, "0")}`;
  return {
    crawlRunId,
    ...source,
    trigger: index % 2 === 0 ? "SCHEDULED" : "MANUAL",
    status: "COMPLETED",
    requestedAt: crawlRunTime(requestedMinutesAgo),
    createdAt: crawlRunTime(requestedMinutesAgo),
    startedAt: crawlRunTime(requestedMinutesAgo - 1),
    completedAt: crawlRunTime(requestedMinutesAgo - 4),
    updatedAt: crawlRunTime(requestedMinutesAgo - 4),
    statistics: {
      pagesVisited: source.sourceType === "RSS" ? 1 : 2,
      articlesDiscovered: discovered,
      articlesExcludedByAge: excluded,
      articlesAttempted: succeeded,
      articlesSucceeded: succeeded,
      articlesFailed: 0,
    },
    itemCount: succeeded,
    error: null,
    job: {
      jobId: `job-${crawlRunId}`,
      status: "SUCCEEDED",
      attemptCount: 1,
      maxAttempts: 3,
      error: null,
    },
    _demoLocked: true,
  };
});

const crawlRuns = new Map(
  [...demoCrawlRuns, ...demoHistoricalCrawlRuns].map((run) => [
    run.crawlRunId,
    run,
  ]),
);

const publicCrawlRun = (run) => {
  const { _demoLocked, _polls, ...publicRun } = run;
  return publicRun;
};

const CRAWL_SOURCES = {
  items: [
    {
      sourceId: "cloudflare-blog",
      name: "Cloudflare Blog",
      domain: "blog.cloudflare.com",
      capabilities: [{ sourceType: "RSS", sectionKey: "BLOG" }],
      crawlOptions: {
        maximumArticleCount: { default: 10, minimum: 1, maximum: 100 },
        maximumAgeHours: { default: 720, minimum: 1 },
        followPagination: { default: false },
        maximumPageCount: { default: 1, minimum: 1, maximum: 10 },
        requestTimeoutMs: { default: 15000, minimum: 1000, maximum: 60000 },
      },
    },
    {
      sourceId: "infoq",
      name: "InfoQ",
      domain: "www.infoq.com",
      capabilities: [
        { sourceType: "RSS", sectionKey: "NEWS" },
        { sourceType: "RSS", sectionKey: "ENGINEERING" },
        { sourceType: "WEB_CRAWL", sectionKey: "NEWS" },
        { sourceType: "WEB_CRAWL", sectionKey: "ENGINEERING" },
      ],
      crawlOptions: {
        maximumArticleCount: { default: 10, minimum: 1, maximum: 100 },
        maximumAgeHours: { default: 720, minimum: 1 },
        followPagination: { default: false },
        maximumPageCount: { default: 1, minimum: 1, maximum: 10 },
        requestTimeoutMs: { default: 15000, minimum: 1000, maximum: 60000 },
      },
    },
    {
      sourceId: "sdtimes",
      name: "SD Times",
      domain: "sdtimes.com",
      capabilities: [
        { sourceType: "RSS", sectionKey: "NEWS" },
        { sourceType: "WEB_CRAWL", sectionKey: "NEWS" },
        { sourceType: "API", sectionKey: "NEWS" },
      ],
      crawlOptions: {
        maximumArticleCount: { default: 10, minimum: 1, maximum: 100 },
        maximumAgeHours: { default: 720, minimum: 1 },
        followPagination: { default: false },
        maximumPageCount: { default: 1, minimum: 1, maximum: 10 },
        requestTimeoutMs: { default: 15000, minimum: 1000, maximum: 60000 },
      },
    },
    {
      sourceId: "github-trending",
      name: "GitHub Trending",
      domain: "github.com",
      capabilities: [{ sourceType: "WEB_CRAWL", sectionKey: "REPOSITORIES" }],
      crawlOptions: {
        maximumArticleCount: { default: 3, minimum: 1, maximum: 3 },
        requestTimeoutMs: { default: 15000, minimum: 1000, maximum: 60000 },
      },
    },
  ],
};

const countBy = (rows, key) =>
  rows.reduce(
    (acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] || 0) + 1 }),
    {},
  );

/* ------------------------------------------------------------------ *
 * 라우팅
 * ------------------------------------------------------------------ */
const PUBLIC_BASE = "/api/v1/tech-articles";
const ADMIN_BASE = "/api/v1/admin/tech-articles";

const bulkResult = (items, idKey) => ({
  results: items.map((item) => ({
    id: item[idKey],
    status: "SUCCEEDED",
    data: {},
  })),
  summary: { total: items.length, succeeded: items.length, failed: 0 },
});

function handle(method, pathname, query, body) {
  if (method === "POST" && pathname === "/api/v1/auth/login") {
    if (!body?.username || !body?.password) {
      return [
        400,
        { statusCode: 400, message: "아이디와 비밀번호를 입력해주세요." },
      ];
    }
    return [
      200,
      {
        access_token: "mock-admin-access-token",
        user: { id: "mock-admin", name: "데모 관리자", role: "ADMIN" },
      },
    ];
  }

  /* ---------- 기술 아티클과 무관하지만 홈/헤더가 호출하는 경로들 ----------
   * 이 서버의 목적은 기술 아티클 화면이지만, 홈 화면(/)이 마운트되면서
   * 아래 두 경로를 부르기 때문에 콘솔이 404로 시끄러워집니다. 최소한만 흉내 냅니다.
   */
  if (method === "GET" && pathname === "/api/v1/main/statistics") {
    return [
      200,
      { totalMembers: 128, projects: 42, awards: 17, employmentRate: 86 },
    ];
  }
  if (method === "GET" && pathname === "/api/v1/main/activity-images") {
    return [
      200,
      {
        competition: null,
        study: null,
        mt: null,
        tags: {
          competition: ["교내 공모전", "해커톤"],
          study: ["알고리즘", "백엔드"],
          mt: ["여름 MT"],
        },
      },
    ];
  }
  if (method === "GET" && pathname === "/api/v1/recruitment/status") {
    return [200, { isRecruiting: false, status: "CLOSED" }];
  }

  const page = Number(query.get("page") || 1);
  const pageSize = Number(query.get("pageSize") || 20);
  const keyword = (query.get("keyword") || "").trim();
  const matches = (a) =>
    !keyword ||
    a.title.includes(keyword) ||
    (a.oneLineSummary || "").includes(keyword);

  /* ---------- 공개 ---------- */
  if (method === "GET" && pathname === `${PUBLIC_BASE}/tags`) {
    return [200, { items: TAGS }];
  }

  if (method === "GET" && pathname === PUBLIC_BASE) {
    const selected = query.getAll("tags").filter(Boolean);
    const rows = articles
      .filter(isPublic)
      .filter(matches)
      .filter(
        (a) => !selected.length || a.tags.some((t) => selected.includes(t)),
      )
      .sort(byNewest)
      .map(publicItem);
    return [
      200,
      { ...paginate(rows, page, pageSize), lastCrawledAt: LAST_CRAWLED_AT },
    ];
  }

  if (method === "GET" && pathname.startsWith(`${PUBLIC_BASE}/`)) {
    const id = decodeURIComponent(pathname.slice(PUBLIC_BASE.length + 1));
    const found = articles.find((a) => a.articleId === id && isPublic(a));
    if (!found)
      return [
        404,
        {
          statusCode: 404,
          message: "공개되지 않았거나 찾을 수 없는 아티클입니다.",
        },
      ];
    return [
      200,
      {
        ...publicItem(found),
        authors: found.authors,
        summaryMarkdown: found.summaryMarkdown,
        evaluation: evaluationOf(found, true), // 공개 상세는 score가 평탄화된 형태
      },
    ];
  }

  /* ---------- 관리자: 통계 ---------- */
  if (method === "GET" && pathname === `${ADMIN_BASE}/stats`) {
    // 목록과 같은 조건으로 셉니다. 단계(stage)는 넣지 않습니다 — 넣으면 고른
    // 단계만 남고 나머지 칩이 전부 0 이 됩니다.
    const statsStatus = query.get("publicationStatus");
    const scope = articles
      .filter(matches)
      .filter((a) => !statsStatus || a.publicationStatus === statsStatus);
    const publication = countBy(scope, "publicationStatus");
    const processing = countBy(scope, "processingStatus");
    return [
      200,
      {
        totalCount: scope.length,
        publication: {
          UNPUBLISHED: 0,
          SCHEDULED: 0,
          PUBLISHED: 0,
          HIDDEN: 0,
          ARCHIVED: 0,
          ...publication,
        },
        processing,
        stages: Object.fromEntries(
          STAGE_NAMES.map((stage) => [
            stage,
            scope.filter((a) => articleStage(a) === stage).length,
          ]),
        ),
        // 단계별 최장 체류. 서버와 같이 updated_at 기준입니다.
        stageOldest: Object.fromEntries(
          STAGE_NAMES.map((stage) => {
            const rows = scope.filter((a) => articleStage(a) === stage);
            if (!rows.length) return [stage, null];
            return [stage, rows.map((a) => a.updatedAt).sort()[0]];
          }),
        ),
        statusMismatch: scope.filter(hasStatusMismatch).length,
        // 검수 큐는 다른 테이블이라 목록 필터와 무관하게 전체입니다.
        reviews: {
          duplicates: duplicateCases.length,
          quality: qualityCases.length,
          publication: publicationQueue().length,
          DUPLICATES: duplicateCases.length,
          QUALITY: qualityCases.length,
          PUBLICATION: publicationQueue().length,
        },
      },
    ];
  }

  /* ---------- 관리자: 검수 큐 ---------- */
  if (method === "GET" && pathname === `${ADMIN_BASE}/reviews/duplicates`) {
    return [200, paginate(duplicateCases, page, pageSize)];
  }
  if (method === "GET" && pathname === `${ADMIN_BASE}/reviews/quality`) {
    return [
      200,
      paginate(
        qualityCases.filter((c) => !keyword || c.title.includes(keyword)),
        page,
        pageSize,
      ),
    ];
  }
  if (method === "GET" && pathname === `${ADMIN_BASE}/reviews/publication`) {
    return [
      200,
      paginate(
        publicationQueue().filter((c) => !keyword || c.title.includes(keyword)),
        page,
        pageSize,
      ),
    ];
  }

  /* ---------- 관리자: 공개 정책 ---------- */
  if (method === "GET" && pathname === `${ADMIN_BASE}/publication-policy`) {
    return [200, publicationPolicy];
  }
  if (method === "PATCH" && pathname === `${ADMIN_BASE}/publication-policy`) {
    publicationPolicy = {
      policy: body?.policy === "IMMEDIATE" ? "IMMEDIATE" : "REVIEW",
      recordVersion: publicationPolicy.recordVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "mock-admin",
    };
    return [200, publicationPolicy];
  }

  /* ---------- 관리자: 수집 ---------- */
  if (method === "GET" && pathname === `${ADMIN_BASE}/crawl-sources`) {
    return [200, CRAWL_SOURCES];
  }
  if (method === "GET" && pathname === `${ADMIN_BASE}/crawl-runs`) {
    const status = query.get("status");
    const sourceId = query.get("sourceId");
    const trigger = query.get("trigger");
    const rows = [...crawlRuns.values()]
      .filter((run) => !status || run.status === status)
      .filter((run) => !sourceId || run.sourceId === sourceId)
      .filter((run) => !trigger || run.trigger === trigger)
      .sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
      )
      .map(publicCrawlRun);
    return [200, paginate(rows, page, pageSize)];
  }
  if (method === "POST" && pathname === `${ADMIN_BASE}/crawl-runs`) {
    const crawlRunId = `run-mock-${Date.now().toString(36)}`;
    const run = {
      crawlRunId,
      status: "QUEUED",
      jobStatus: "PENDING",
      sourceId: body?.source?.sourceId || "infoq",
      sourceType: body?.source?.sourceType || "RSS",
      sectionKey: body?.source?.sectionKey || "NEWS",
      trigger: "MANUAL",
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
      itemCount: 0,
      job: { status: "PENDING", attemptCount: 0, maxAttempts: 3 },
      items: [],
      statistics: null,
      error: null,
      _polls: 0,
    };
    crawlRuns.set(crawlRunId, run);
    return [202, publicCrawlRun(run)];
  }
  if (method === "GET" && pathname.startsWith(`${ADMIN_BASE}/crawl-runs/`)) {
    const id = decodeURIComponent(
      pathname.slice(`${ADMIN_BASE}/crawl-runs/`.length),
    );
    const run = crawlRuns.get(id);
    if (!run)
      return [
        404,
        { statusCode: 404, message: "수집 실행을 찾을 수 없습니다." },
      ];
    // 새로 요청한 실행만 폴링할 때마다 QUEUED -> RUNNING -> COMPLETED 로 진행한다.
    // 고정 더미 이력은 여러 상태를 계속 비교할 수 있도록 그대로 둔다.
    if (!run._demoLocked) run._polls += 1;
    if (!run._demoLocked && run._polls === 1) {
      Object.assign(run, {
        status: "RUNNING",
        jobStatus: "RUNNING",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        job: { status: "RUNNING", attemptCount: 1, maxAttempts: 3 },
        statistics: null,
        itemCount: 0,
      });
    } else if (!run._demoLocked && run._polls >= 2) {
      Object.assign(run, {
        status: "COMPLETED",
        jobStatus: "SUCCEEDED",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        job: { status: "SUCCEEDED", attemptCount: 1, maxAttempts: 3 },
        statistics: {
          pagesVisited: 1,
          articlesDiscovered: 12,
          articlesExcludedByAge: 1,
          articlesAttempted: 11,
          articlesSucceeded: 11,
          articlesFailed: 0,
        },
        itemCount: 11,
        items: Array.from({ length: 11 }, (_, i) => ({
          crawlItemId: `item-mock-${i + 1}`,
          crawlStatus: "SUCCESS",
          submissionId: `submission-mock-${i + 1}`,
          normalizationStatus: "SUCCESS",
        })),
      });
    }
    return [200, publicCrawlRun(run)];
  }

  /* ---------- 관리자: 게시 상태 변경 ---------- */
  if (
    method === "POST" &&
    pathname === `${ADMIN_BASE}/publication-actions/bulk`
  ) {
    const items = body?.items || [];
    items.forEach(({ articleId, action }) =>
      applyPublication(articleId, action),
    );
    return [200, bulkResult(items, "articleId")];
  }
  if (method === "POST" && pathname.endsWith("/publication-actions")) {
    const articleId = decodeURIComponent(
      pathname.slice(
        ADMIN_BASE.length + 1,
        pathname.length - "/publication-actions".length,
      ),
    );
    const updated = applyPublication(articleId, body?.action);
    if (!updated)
      return [404, { statusCode: 404, message: "아티클을 찾을 수 없습니다." }];
    return [200, updated];
  }

  /* ---------- 관리자: 검수 판정 ---------- */
  if (
    method === "POST" &&
    pathname === `${ADMIN_BASE}/reviews/duplicates/resolutions/bulk`
  ) {
    const items = body?.items || [];
    items.forEach(({ caseId }) =>
      removeCase(duplicateCases, "reviewCaseId", caseId),
    );
    return [200, bulkResult(items, "caseId")];
  }
  if (
    method === "POST" &&
    pathname === `${ADMIN_BASE}/reviews/quality/resolutions/bulk`
  ) {
    const items = body?.items || [];
    items.forEach(({ caseId }) => removeCase(qualityCases, "caseId", caseId));
    return [200, bulkResult(items, "caseId")];
  }
  if (
    method === "POST" &&
    /\/reviews\/duplicates\/[^/]+\/resolutions$/.test(pathname)
  ) {
    const caseId = decodeURIComponent(pathname.split("/").slice(-2)[0]);
    removeCase(duplicateCases, "reviewCaseId", caseId);
    return [
      200,
      {
        outcome: body?.action === "CONFIRM_DUPLICATE" ? "DUPLICATE" : "UNIQUE",
        resolution: {},
        article: {},
      },
    ];
  }
  if (
    method === "POST" &&
    /\/reviews\/quality\/[^/]+\/resolutions$/.test(pathname)
  ) {
    const caseId = decodeURIComponent(pathname.split("/").slice(-2)[0]);
    const target = qualityCases.find((c) => c.caseId === caseId);
    if (target) {
      const article = articles.find((a) => a.articleId === target.articleId);
      if (article) {
        article.processingStatus =
          body?.action === "APPROVE"
            ? "ENRICHMENT_PENDING"
            : "QUALITY_REJECTED";
        article.reviewStatus =
          body?.action === "APPROVE" ? "APPROVED" : "REJECTED";
        if (body?.action === "APPROVE")
          resolvedApprovals.add(article.articleId);
        article.recordVersion += 1;
      }
    }
    removeCase(qualityCases, "caseId", caseId);
    return [200, { caseId, status: "RESOLVED", caseVersion: 2 }];
  }

  /* ---------- 관리자: 목록 / 상세 (마지막에 둬야 위 경로들을 가로채지 않음) ---------- */
  if (method === "GET" && pathname === ADMIN_BASE) {
    const status = query.get("publicationStatus");
    const stage = query.get("stage");
    const mismatchOnly = query.get("statusMismatch") === "true";
    const sort = query.get("sort") || "NEWEST";
    // 서버와 같은 순서로 거릅니다 — 거른 뒤에 페이지를 자릅니다.
    let rows = articles
      .filter(matches)
      .filter((a) => !status || a.publicationStatus === status)
      .filter((a) => !stage || articleStage(a) === stage)
      .filter((a) => !mismatchOnly || hasStatusMismatch(a));
    if (sort === "OLDEST")
      rows = [...rows].sort(
        (x, y) => new Date(x.updatedAt) - new Date(y.updatedAt),
      );
    else if (sort === "SCORE_DESC")
      rows = [...rows].sort((x, y) => y.valueScore - x.valueScore);
    else if (sort === "SCORE_ASC")
      rows = [...rows].sort((x, y) => x.valueScore - y.valueScore);
    else rows = [...rows].sort(byNewest);
    return [200, paginate(rows.map(adminItem), page, pageSize)];
  }
  if (method === "GET" && pathname.startsWith(`${ADMIN_BASE}/`)) {
    const id = decodeURIComponent(pathname.slice(ADMIN_BASE.length + 1));
    const found = articles.find((a) => a.articleId === id);
    if (!found)
      return [404, { statusCode: 404, message: "아티클을 찾을 수 없습니다." }];
    return [
      200,
      {
        ...adminItem(found),
        latestCrawlItemId: `item-${found.articleId}`,
        evaluation: evaluationOf(found, false), // 관리자 상세는 dimensions 중첩 형태
      },
    ];
  }

  return [
    404,
    {
      statusCode: 404,
      message: `이 목 서버는 기술 아티클 화면만 흉내 냅니다. 구현되지 않은 경로: ${method} ${pathname}`,
    },
  ];
}

function applyPublication(articleId, action) {
  const article = articles.find((a) => a.articleId === articleId);
  if (!article) return null;
  const next = { PUBLISH: "PUBLISHED", HIDE: "HIDDEN", ARCHIVE: "ARCHIVED" }[
    action
  ];
  if (next) {
    article.publicationStatus = next;
    article.publishedAt =
      next === "PUBLISHED" ? new Date().toISOString() : article.publishedAt;
    // 서버 동작을 그대로 재현한다. PUBLISH 만 검토 상태를 승격시키고
    // HIDE, ARCHIVE 는 건드리지 않는다 (mysql.py apply_publication_action).
    // 승격 자체가 알려진 결함이므로 서버 수정 시 이 줄도 함께 제거한다.
    if (action === "PUBLISH") article.reviewStatus = "APPROVED";
    article.recordVersion += 1;
  }
  return {
    articleId,
    publicationStatus: article.publicationStatus,
    reviewStatus: article.reviewStatus,
    recordVersion: article.recordVersion,
  };
}

function removeCase(list, key, value) {
  const index = list.findIndex((c) => c[key] === value);
  if (index >= 0) list.splice(index, 1);
}

/* ------------------------------------------------------------------ *
 * HTTP 서버
 * ------------------------------------------------------------------ */
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 다른 포트에서 CRA dev server가 직접 호출하는 경우를 위해 CORS 허용
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key, Accept",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    let body = null;
    if (chunks.length) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        body = null;
      }
    }

    let status = 500;
    let payload = { message: "mock server error" };
    try {
      [status, payload] = handle(
        req.method,
        url.pathname,
        url.searchParams,
        body,
      );
    } catch (error) {
      status = 500;
      payload = { statusCode: 500, message: String(error?.stack || error) };
    }

    // 로그인/로그아웃 등 화면이 부수적으로 부르는 경로는 조용히 200 처리
    if (status === 404 && url.pathname.startsWith("/api/v1/auth/")) {
      status = 200;
      payload = {};
    }

    const label = status >= 400 ? "✗" : "✓";
    console.log(
      `${label} ${status} ${req.method} ${url.pathname}${url.search}`,
    );
    if (status === 404 && !url.pathname.includes("tech-articles")) {
      console.log(
        `   ↑ 기술 아티클 화면과 무관한 경로라 목을 만들지 않았습니다. 무시해도 됩니다.`,
      );
    }

    const json = JSON.stringify(payload);
    res
      .writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
      .end(json);
  });
});

server.listen(PORT, HOST, () => {
  const publicCount = articles.filter(isPublic).length;
  console.log(
    [
      "",
      "  TCP 기술 아티클 목(mock) API 서버",
      "  ─────────────────────────────────────────────",
      `  주소        http://${HOST}:${PORT}`,
      `  더미 아티클  ${articles.length}건 (공개 ${publicCount}건)`,
      `  검수 큐      중복 ${duplicateCases.length} · 품질 ${qualityCases.length} · 공개 ${publicationQueue().length}`,
      "",
      "  프론트엔드는 다른 터미널에서:",
      "    cd web && PORT=3100 npm start",
      "",
      "  Ctrl+C 로 종료. 데이터는 메모리에만 있고 재시작하면 초기화됩니다.",
      "",
    ].join("\n"),
  );
});
