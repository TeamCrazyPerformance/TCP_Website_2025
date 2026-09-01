#!/usr/bin/env node
/**
 * TCP 웹사이트 — 프론트엔드 전용 목(mock) API 서버
 *
 * 목적: MySQL / Python 파이프라인 / NestJS 없이 React 화면을 더미 데이터로 확인하기.
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
const ARTICLE_COUNT = Number(process.env.MOCK_ARTICLE_COUNT || 130);
const PUBLIC_ARTICLE_COUNT = Math.min(
  Number(process.env.MOCK_PUBLIC_ARTICLE_COUNT || 106),
  ARTICLE_COUNT,
);

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
  {
    id: "tailscale-blog",
    name: "Tailscale Blog",
    type: "RSS",
    domain: "tailscale.com",
    path: "/blog",
  },
  {
    id: "github-trending",
    name: "GitHub Trending",
    type: "HTML",
    domain: "github.com",
    path: "/trending",
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

// Representative fixtures keep the first page close to production; the
// deterministic generator fills the remaining items.
const PRODUCTION_LIKE_ARTICLES = [
  {
    articleId: "article-20260831-000040",
    title: "DoorDash의 Flux, 클라우드 기반 에이전트로 13만 건의 엔지니어링 작업 처리",
    oneLineSummary:
      "DoorDash가 엔지니어링 에이전트 작업 부하를 클라우드 플랫폼 Flux로 이전하여 단일 월에 13만 건의 작업을 자동화합니다.",
    tags: ["AI", "클라우드", "개발자 도구"],
    sourceId: "infoq",
    articleUrl: "https://www.infoq.com/news/2026/08/doordash-flux-cloud-agent",
    originalPublishedAt: "2026-08-31T14:28:00.000Z",
    collectedAt: "2026-08-31T15:00:00.000Z",
    detailPoints: [
      "DoorDash는 개별 노트북의 성능과 보안 한계를 해결하기 위해 Flux 클라우드 플랫폼을 개발했습니다.",
      "Flux는 한 달 동안 13만 건의 엔지니어링 작업과 주당 2만 5천 건 이상의 코드 리뷰를 지원했습니다.",
      "클라우드 샌드박스와 MCP 게이트웨이를 통해 에이전트 작업을 격리하고 접근 정책을 집행합니다.",
    ],
  },
  {
    articleId: "article-20260831-000047",
    title: "Tailscale을 활용한 애플리케이션 구축: tsnet, API 및 자동화된 공유",
    oneLineSummary:
      "Tailscale은 tsnet 라이브러리와 Tailnets API를 통해 애플리케이션 내부에 보안 연결을 직접 내장하고 네트워크 프로비저닝을 자동화할 수 있는 기능을 제공합니다.",
    tags: ["네트워크", "개발자 도구", "클라우드"],
    sourceId: "tailscale-blog",
    originalPublishedAt: "2026-08-31T12:10:00.000Z",
    collectedAt: "2026-08-31T15:05:00.000Z",
  },
  {
    articleId: "article-20260831-000046",
    title: "Tailcat: Tailscale의 WireGuard, NAT 탐색 및 DERP를 위한 오픈소스 CLI",
    oneLineSummary:
      "Tailscale 개발진이 Tailscale 제어 plane 없이 데이터 plane만 사용할 수 있는 오픈소스 CLI 도구 tailcat을 공개합니다.",
    tags: ["오픈소스", "개발자 도구", "네트워크"],
    sourceId: "tailscale-blog",
    originalPublishedAt: "2026-08-31T11:40:00.000Z",
    collectedAt: "2026-08-31T15:10:00.000Z",
  },
  {
    articleId: "article-20260831-000041",
    title: "자바 뉴스 라운드업: GraalVM, Jakarta Data, JNoSQL, Azul Payara, WildFly, Quarkus, Atmosphere",
    oneLineSummary:
      "JDK 28의 JEP 542가 대상 지정 단계로 격상되었으며 GraalVM, Quarkus, WildFly 등 다양한 자바 생태계 기술의 최신 버전이 공개되었습니다.",
    tags: ["프로그래밍 언어", "애플리케이션 개발", "클라우드"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-31T10:30:00.000Z",
    collectedAt: "2026-08-31T15:15:00.000Z",
  },
  {
    articleId: "article-20260831-000045",
    title: "Workload Identity Federation을 통한 GCP의 장기 자격 증명 제거",
    oneLineSummary:
      "Workload Identity Federation은 외부 워크로드의 GCP 인증에서 장기 서비스 계정 키를 제거하여 자격 증명 노출과 운영 부담을 줄여줍니다.",
    tags: ["보안", "클라우드", "DevOps"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-31T09:50:00.000Z",
    collectedAt: "2026-08-31T15:20:00.000Z",
  },
  {
    articleId: "article-20260831-000042",
    title: "Foundry Model Router, 2개 지역에서 28개 지역으로 확장 및 모델 풀 갱신",
    oneLineSummary:
      "Microsoft가 Foundry Models의 모델 라우터를 28개 지역으로 확장하고 지원 모델 풀을 갱신했습니다.",
    tags: ["AI", "클라우드", "산업 동향"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-31T09:10:00.000Z",
    collectedAt: "2026-08-31T15:25:00.000Z",
  },
  {
    articleId: "article-20260831-000043",
    title: "FlexGanttFX 오픈소스화",
    oneLineSummary:
      "Dirk Lemmerman이 15년 만에 자원 스케줄링 프레임워크 FlexGanttFX를 AGPL 라이선스로 오픈소스로 공개합니다.",
    tags: ["오픈소스", "애플리케이션 개발"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-31T08:40:00.000Z",
    collectedAt: "2026-08-31T15:30:00.000Z",
  },
  {
    articleId: "article-20260831-000044",
    title: "Cloudflare, AI 에이전트와 개발자의 커스텀 데이터 검색을 지원하는 AI Search 확장",
    oneLineSummary:
      "Cloudflare가 AI 에이전트와 애플리케이션이 커스텀 데이터를 쉽게 검색할 수 있도록 지원하는 통합 검색 서비스인 AI Search를 확장합니다.",
    tags: ["AI", "클라우드", "개발자 도구"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-31T08:00:00.000Z",
    collectedAt: "2026-08-31T15:35:00.000Z",
  },
  {
    articleId: "article-20260830-000003",
    title: "Lakr233/vphone-cli",
    oneLineSummary:
      "vphone-cli 도구는 Apple Silicon 맥에서 Virtualization.framework을 활용해 가상 아이폰을 부팅하고 관리합니다.",
    tags: ["애플리케이션 개발", "개발자 도구", "모바일"],
    sourceId: "github-trending",
    articleUrl: "https://github.com/Lakr233/vphone-cli",
    originalPublishedAt: "2026-08-31T03:00:00.000Z",
    collectedAt: "2026-08-31T15:40:00.000Z",
  },
  {
    articleId: "article-20260830-000002",
    title: "THU-MAIC/OpenMAIC",
    oneLineSummary:
      "OpenMAIC v1.0.0이 출시되어 에이전트 기반 커리큘럼 계획 및 제작을 지원하는 Pro 워크벤치와 서버 기반 세션 관리 기능이 추가되었습니다.",
    tags: ["AI", "애플리케이션 개발", "오픈소스"],
    sourceId: "github-trending",
    articleUrl: "https://github.com/THU-MAIC/OpenMAIC",
    originalPublishedAt: "2026-08-31T02:20:00.000Z",
    collectedAt: "2026-08-31T15:45:00.000Z",
  },
  {
    articleId: "article-20260830-000001",
    title: "AWS, 비동기 코딩 에이전트를 위한 Kiro Crew 오픈소스 공개",
    oneLineSummary:
      "Amazon이 인시던트 조사와 PR 모니터링 등의 비동기 코딩 작업을 처리할 수 있는 오픈소스 에이전트 시스템 Kiro Crew를 공개했습니다.",
    tags: ["AI", "개발자 도구", "오픈소스"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-30T12:00:00.000Z",
    collectedAt: "2026-08-30T14:00:00.000Z",
  },
  {
    articleId: "article-20260829-000001",
    title: "Cloudflare Workers, 인바운드 TCP 지원 및 첫 번째 프로토콜로 gRPC 도입",
    oneLineSummary:
      "Cloudflare Workers가 인바운드 TCP 연결을 지원하며, 이를 기반으로 한 gRPC 지원 기능을 프라이빗 베타로 출시했습니다.",
    tags: ["클라우드", "애플리케이션 개발", "네트워크"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-29T12:00:00.000Z",
    collectedAt: "2026-08-29T14:00:00.000Z",
  },
  {
    articleId: "article-20260829-000002",
    title: "FreeToken: 동적 공동 실행을 통한 소비자 하드웨어에서의 프론티어 MoE 추론",
    oneLineSummary:
      "UC 버클리와 MIT 연구진이 공개한 오픈소스 추론 엔진 FreeToken은 동적 공동 실행을 통해 소비자 하드웨어에서 프론티어 MoE 모델을 실행합니다.",
    tags: ["AI", "클라우드", "오픈소스"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-29T11:00:00.000Z",
    collectedAt: "2026-08-29T14:10:00.000Z",
  },
  {
    articleId: "article-20260829-000003",
    title: "AI가 의도대로 작동하는지 확인하기: 질의응답",
    oneLineSummary:
      "사우스웍스의 최고기술책임자 조니 할리페는 AI가 코드 생성과 실행에는 뛰어나지만 문제 해결과 판단에는 한계가 있으며 개발자의 역할이 정의와 검증 중심으로 이동한다고 설명합니다.",
    tags: ["AI", "개발자 도구", "소프트웨어 아키텍처"],
    sourceId: "sdtimes",
    originalPublishedAt: "2026-08-29T10:00:00.000Z",
    collectedAt: "2026-08-29T14:20:00.000Z",
  },
  {
    articleId: "article-20260828-000012",
    title: "K-Dense-AI/scientific-agent-skills",
    oneLineSummary:
      "K-Dense-AI는 오픈 Agent Skills 표준을 지원하는 163개의 검증된 과학 및 연구 스킬 라이브러리를 제공합니다.",
    tags: ["AI", "개발자 도구", "오픈소스"],
    sourceId: "github-trending",
    articleUrl: "https://github.com/K-Dense-AI/scientific-agent-skills",
    originalPublishedAt: "2026-08-29T03:00:00.000Z",
    collectedAt: "2026-08-29T06:00:00.000Z",
  },
  {
    articleId: "article-20260828-000003",
    title: "Uber, 대규모 모노레포를 위한 Git 운영 서비스 GitFarm 구축",
    oneLineSummary:
      "Uber가 대규모 모노레포를 위해 개발한 Git as a Service 플랫폼 GitFarm은 클라이언트 측 리소스 사용량을 80% 이상 줄였습니다.",
    tags: ["애플리케이션 개발", "DevOps"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-28T12:00:00.000Z",
    collectedAt: "2026-08-28T14:00:00.000Z",
  },
  {
    articleId: "article-20260831-000006",
    title: "Tailscale 및 Control D: tailnet을 위한 DNS 필터링",
    oneLineSummary:
      "Tailscale 고객은 Tailscale 영업 팀을 통해 Control D의 DNS 필터링 솔루션을 구매하여 tailnet에 통합할 수 있습니다.",
    tags: ["네트워크", "보안", "클라우드"],
    sourceId: "tailscale-blog",
    originalPublishedAt: "2026-08-28T11:00:00.000Z",
    collectedAt: "2026-08-28T14:10:00.000Z",
  },
  {
    articleId: "article-20260828-000001",
    title: "BotBase for Operators: Cloudflare 봇 디렉토리 등록 및 관리를 위한 투명성 강화",
    oneLineSummary:
      "Cloudflare가 봇 운영자를 위한 BotBase for Operators를 출시하여 제출 상태 확인과 정보 수정 기능을 제공합니다.",
    tags: ["애플리케이션 개발", "보안", "산업 동향"],
    sourceId: "cloudflare-blog",
    originalPublishedAt: "2026-08-28T10:00:00.000Z",
    collectedAt: "2026-08-28T14:20:00.000Z",
  },
  {
    articleId: "article-20260828-000004",
    title: "AKS, 새로운 NAP 가이드를 통해 노드 중단을 더욱 예측 가능하게 만들고자 함",
    oneLineSummary:
      "Microsoft가 공개한 AKS NAP 가이드는 자동화된 노드 통합 시 애플리케이션 가용성과 인프라 효율성을 균형 있게 유지하는 방법을 제시합니다.",
    tags: ["클라우드", "개발 조직", "소프트웨어 품질"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-28T09:00:00.000Z",
    collectedAt: "2026-08-28T14:30:00.000Z",
  },
  {
    articleId: "article-20260828-000011",
    title: "Spring Boot에서의 양자 후 암호화: 이번 스프린트에 적용 가능한 4가지 패턴",
    oneLineSummary:
      "Spring Boot 환경에서 JDK 24와 PqcStarterLib를 활용해 PQC 페이로드 암호화, 문서 서명, 토큰 인증을 구현합니다.",
    tags: ["AI", "애플리케이션 개발", "보안"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-28T08:00:00.000Z",
    collectedAt: "2026-08-28T14:40:00.000Z",
  },
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

const productionLikeMarkdown = (article) => {
  const points = article.detailPoints || [
    article.oneLineSummary,
    "원문의 핵심 변화와 개발자가 확인해야 할 영향을 간결하게 정리했습니다.",
    "세부 구현과 적용 조건은 연결된 원문에서 확인할 수 있습니다.",
  ];
  return `### 주요 내용\n\n${points.map((point) => `- ${point}`).join("\n")}`;
};

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
    // 요약기의 maximumTagCount 기본값이 3 입니다(contracts/models.py).
    // 4개짜리 목 데이터는 실제로 나올 수 없는 화면을 만들어 냅니다.
    tags: pickN(TAGS, intBetween(1, 3)),
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

PRODUCTION_LIKE_ARTICLES.forEach((fixture, index) => {
  const article = articles[index];
  if (!article) return;
  const source = SOURCES.find((item) => item.id === fixture.sourceId);
  const articleUrl =
    fixture.articleUrl ||
    `https://${source.domain}${source.path}/${fixture.articleId}`;
  Object.assign(article, {
    articleId: fixture.articleId,
    title: fixture.title,
    originalTitle: fixture.title,
    oneLineSummary: fixture.oneLineSummary,
    summaryMarkdown: productionLikeMarkdown(fixture),
    tags: fixture.tags,
    source: {
      id: source.id,
      name: source.name,
      type: source.type,
      domain: source.domain,
      path: source.path,
      articleUrl,
    },
    canonicalUrl: articleUrl,
    originalLanguage: LANGS[0],
    originalPublishedAt: fixture.originalPublishedAt,
    collectedAt: fixture.collectedAt,
    crawledAt: fixture.collectedAt,
    normalizedAt: fixture.collectedAt,
  });
});

// Keep 106 public items; the remainder exercise pre-public review states.
const NON_PUBLIC_STATES = REACHABLE_STATES.filter(
  ([, , publicationStatus]) => publicationStatus !== "PUBLISHED",
);
articles.forEach((article, index) => {
  if (index < PUBLIC_ARTICLE_COUNT) {
    article.processingStatus = "ENRICHED";
    article.reviewStatus = "APPROVED";
    article.publicationStatus = "PUBLISHED";
    article.publishedAt = article.normalizedAt;
    return;
  }
  const [processingStatus, reviewStatus, publicationStatus] =
    NON_PUBLIC_STATES[(index - PUBLIC_ARTICLE_COUNT) % NON_PUBLIC_STATES.length];
  article.processingStatus = processingStatus;
  article.reviewStatus = reviewStatus;
  article.publicationStatus = publicationStatus;
  article.publishedAt = null;
});

// NEW 배지가 로컬에서 보이도록 공개된 아티클 몇 건의 수집 시각을 최근으로
// 맞춘다. 목 데이터의 기준 시각은 고정이라 그냥 두면 전부 12시간을 넘긴다.
articles
  .filter(
    (a) =>
      a.processingStatus === "ENRICHED" && a.publicationStatus === "PUBLISHED",
  )
  .slice(0, 9)
  .forEach((a, index) => {
    a.collectedAt = new Date(
      Date.now() - (index + 1) * 3600 * 1000,
    ).toISOString();
  });

articles
  .filter(
    (a) =>
      a.processingStatus === "ENRICHED" && a.publicationStatus === "PUBLISHED",
  )
  .slice(9)
  .forEach((a, index) => {
    a.collectedAt = new Date(
      Date.now() - (48 + index) * 3600 * 1000,
    ).toISOString();
  });

// 실제 파이프라인은 품질 평가 결과를 저장할 때 처음으로 점수를 기록한다.
// INGESTED 는 자동 품질 평가 전 단계이므로 점수와 판정값이 없다.
articles
  .filter((article) => article.processingStatus === "INGESTED")
  .forEach((article) => {
    article.valueScore = null;
  });

const LAST_CRAWLED_AT = new Date(Date.now() - 8 * 3600 * 1000).toISOString();

const evaluationOf = (article) => {
  const overall = article.valueScore;
  if (typeof overall !== "number") return null;
  const dimensions = {
    relevance: Math.min(100, overall + 4),
    timeliness: Math.max(0, overall - 3),
    sourceReliability: Math.min(100, overall + 1),
  };
  const decision =
    overall >= 70 ? "PASS" : overall >= 45 ? "REVIEW_REQUIRED" : "REJECT";
  const axes = [
    ["relevance", "개발 관련성", 0.45],
    ["timeliness", "시의성", 0.3],
    ["sourceReliability", "출처 신뢰도", 0.25],
  ].map(([key, label, weight]) => ({
    key,
    label,
    value: dimensions[key],
    weight,
    contribution: Number((dimensions[key] * weight).toFixed(2)),
  }));
  return {
    schemaVersion: "2.0",
    evaluatorVersion: "mock-v2",
    policyVersion: "quality-policy-v1",
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
    score: {
      overall,
      scale: { min: 0, max: 100 },
      axes,
      dimensions,
    },
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

const publicListItem = (a) => ({
  id: a.articleId,
  title: a.title,
  oneLineSummary: a.oneLineSummary,
  tags: a.tags,
  source: { name: a.source.name, domain: a.source.domain },
  originalPublishedAt: a.originalPublishedAt,
  isNew: isNewArticle(a.collectedAt),
});

const publicDetailItem = (a) => ({
  id: a.articleId,
  title: a.title,
  oneLineSummary: a.oneLineSummary,
  summaryMarkdown: a.summaryMarkdown,
  tags: a.tags,
  source: {
    name: a.source.name,
    domain: a.source.domain,
    path: a.source.path,
    articleUrl: a.source.articleUrl,
  },
  originalLanguage: a.originalLanguage,
  originalPublishedAt: a.originalPublishedAt,
  collectedAt: a.collectedAt,
});

const publicValueScoreOf = (article) => {
  const score = evaluationOf(article)?.score;
  if (!score) return null;
  return {
    overall: score.overall,
    scale: score.scale,
    breakdown: score.axes.map(({ label, contribution }) => ({
      label,
      contribution,
    })),
  };
};

const NEW_ARTICLE_WINDOW_HOURS = 24;
const isNewArticle = (collectedAt) => {
  if (!collectedAt) return false;
  const t = new Date(collectedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_ARTICLE_WINDOW_HOURS * 3600 * 1000;
};

// 공개 화면 소스 선택기. 파이프라인 catalog.PUBLIC_SOURCE_CATALOG 와 같은 모양.
const PUBLIC_SOURCES = [
  {
    id: "cloudflare-blog",
    name: "Cloudflare Blog",
    domain: "blog.cloudflare.com",
    category: "기술 블로그",
  },
  { id: "infoq", name: "InfoQ", domain: "infoq.com", category: "업계 뉴스" },
  {
    id: "sdtimes",
    name: "SD Times",
    domain: "sdtimes.com",
    category: "업계 뉴스",
  },
  {
    id: "tailscale-blog",
    name: "Tailscale Blog",
    domain: "tailscale.com",
    category: "기술 블로그",
  },
  {
    id: "github-trending",
    name: "GitHub Trending",
    domain: "github.com",
    category: "저장소",
  },
];

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

// 아티클별 조회수. 실제로는 파이프라인 MySQL 의 article_view_counts 입니다.
const viewCounts = new Map();
const viewCountsOf = (id) =>
  viewCounts.get(id) || { member: 0, guest: 0, lastViewedAt: null };

// 조회수가 화면에 보이도록 몇 건 시드한다. 비회원 열람이 회원 열람보다 많은
// 아티클을 하나 넣어 두 숫자를 나눠 보여주는 이유가 드러나게 한다.
articles.slice(0, 5).forEach((a, index) => {
  viewCounts.set(a.articleId, {
    member: [42, 17, 8, 3, 0][index],
    guest: [5, 2, 0, 61, 1][index],
    lastViewedAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
  });
});

const adminItem = (a) => ({
  ...a,
  viewCounts: viewCountsOf(a.articleId),
  evaluation: evaluationOf(a),
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
    const evaluation = evaluationOf(a);
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
 * 사이트 공용 화면 더미 데이터
 * ------------------------------------------------------------------ */
const demoAnnouncements = [
  {
    id: 1,
    title: "2026년 2학기 TCP 신입 회원 모집 안내",
    summary: "지원 일정과 면접 진행 방식, 오리엔테이션 일정을 안내합니다.",
    contents: `## 신입 회원 모집을 시작합니다

TCP와 함께 프로젝트와 스터디에 참여할 신입 회원을 기다립니다.

- 지원 기간: 2026년 9월 1일 ~ 9월 12일
- 면접 기간: 2026년 9월 15일 ~ 9월 18일
- 오리엔테이션: 2026년 9월 21일

개발 경험보다 배우고 협업하려는 태도를 중요하게 봅니다.`,
    author: { name: "TCP 운영진" },
    publishAt: "2026-08-30T09:00:00+09:00",
    createdAt: "2026-08-29T18:00:00+09:00",
    views: 284,
  },
  {
    id: 2,
    title: "하반기 프로젝트 데모데이 참가팀 모집",
    summary: "12월 데모데이에서 결과물을 발표할 프로젝트 팀을 모집합니다.",
    contents: `## TCP Demo Day 2026

한 학기 동안 만든 결과물을 공유하고 피드백을 받는 자리입니다.

웹, 앱, AI, 게임 등 분야에 관계없이 참가할 수 있습니다.`,
    author: { name: "프로젝트 운영팀" },
    publishAt: "2026-08-26T14:00:00+09:00",
    createdAt: "2026-08-26T11:30:00+09:00",
    views: 167,
  },
  {
    id: 3,
    title: "9월 정기 세미나: 운영 환경에서의 관측 가능성",
    summary:
      "로그, 메트릭, 트레이싱을 활용한 장애 대응 사례를 함께 살펴봅니다.",
    contents: `## 9월 정기 세미나

실제 서비스 운영 사례를 중심으로 관측 가능성 도구를 선택하고 적용하는 과정을 소개합니다.

세미나 후에는 자유로운 네트워킹 시간이 준비되어 있습니다.`,
    author: { name: "세미나 운영팀" },
    publishAt: "2026-08-22T17:00:00+09:00",
    createdAt: "2026-08-22T13:00:00+09:00",
    views: 132,
  },
  {
    id: 4,
    title: "여름방학 해커톤 결과 및 수상팀 발표",
    summary: "48시간 동안 진행된 교내 해커톤의 수상 결과를 공개합니다.",
    contents: `## 해커톤을 마쳤습니다

참가한 모든 팀의 열정과 완성도 높은 결과물에 감사드립니다.

수상작은 다음 정기 세미나에서 다시 만나볼 수 있습니다.`,
    author: { name: "해커톤 준비위원회" },
    publishAt: "2026-08-18T12:00:00+09:00",
    createdAt: "2026-08-18T10:00:00+09:00",
    views: 219,
  },
  {
    id: 5,
    title: "GitHub Organization 저장소 운영 가이드",
    summary: "브랜치, 리뷰, 보안 설정에 관한 공통 규칙을 정리했습니다.",
    contents: `## 저장소 운영 원칙

작은 단위의 변경과 명확한 리뷰 설명을 권장합니다.

민감한 값은 저장소에 올리지 말고 프로젝트별 환경 변수로 관리해주세요.`,
    author: { name: "기술지원팀" },
    publishAt: "2026-08-12T09:30:00+09:00",
    createdAt: "2026-08-11T20:00:00+09:00",
    views: 96,
  },
  {
    id: 6,
    title: "동아리방 이용 시간 및 장비 대여 안내",
    summary: "개강 후 동아리방 운영 시간과 공용 장비 대여 절차를 안내합니다.",
    contents: `## 동아리방 이용 안내

평일 운영 시간은 오전 9시부터 오후 9시까지입니다.

공용 장비는 사용 전 운영진에게 대여 기록을 남겨주세요.`,
    author: { name: "TCP 운영진" },
    publishAt: "2026-08-05T10:00:00+09:00",
    createdAt: "2026-08-05T09:00:00+09:00",
    views: 141,
  },
];

const demoStudies = [
  {
    id: 1,
    study_name: "React & TypeScript 실전 스터디",
    start_year: 2026,
    study_description:
      "컴포넌트 설계부터 테스트와 배포까지 작은 서비스를 함께 완성합니다.",
    tag: "React,TypeScript,프론트엔드",
    recruit_count: 8,
    period: "2026.09 ~ 2026.11",
    apply_deadline: "2026-09-10T23:59:59+09:00",
    place: "미래관 312호",
    way: "매주 수요일 오후 7시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-leader-1", name: "김민준" },
    members: [
      { user_id: "demo-leader-1", name: "김민준", role: "LEADER" },
      { user_id: "demo-member-1", name: "이서연", role: "MEMBER" },
    ],
  },
  {
    id: 2,
    study_name: "NestJS 백엔드 아키텍처",
    start_year: 2026,
    study_description:
      "인증, 데이터 모델링, 테스트를 중심으로 확장 가능한 API를 설계합니다.",
    tag: "백엔드,NestJS,데이터베이스",
    recruit_count: 6,
    period: "2026.09 ~ 2026.12",
    apply_deadline: "2026-09-08T23:59:59+09:00",
    place: "온라인",
    way: "매주 토요일 오후 2시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-leader-2", name: "박지훈" },
    members: [
      { user_id: "demo-leader-2", name: "박지훈", role: "LEADER" },
      { user_id: "demo-member-2", name: "최예원", role: "MEMBER" },
    ],
  },
  {
    id: 3,
    study_name: "생성형 AI 논문 읽기",
    start_year: 2026,
    study_description:
      "매주 한 편의 논문을 읽고 핵심 아이디어와 재현 경험을 공유합니다.",
    tag: "AI,머신러닝,파이썬",
    recruit_count: 10,
    period: "2026.03 ~ 2026.06",
    apply_deadline: "2026-03-05T23:59:59+09:00",
    place: "미래관 세미나실",
    way: "매주 목요일 오후 6시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-leader-3", name: "한동민" },
    members: [{ user_id: "demo-leader-3", name: "한동민", role: "LEADER" }],
  },
  {
    id: 4,
    study_name: "알고리즘 문제 해결 입문",
    start_year: 2025,
    study_description:
      "자료구조 기초부터 코딩 테스트 유형별 풀이 전략까지 차근차근 학습합니다.",
    tag: "알고리즘,자료구조,입문",
    recruit_count: 12,
    period: "2025.09 ~ 2025.11",
    apply_deadline: "2025-09-05T23:59:59+09:00",
    place: "온라인",
    way: "매주 월요일 오후 8시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-leader-4", name: "정수현" },
    members: [{ user_id: "demo-leader-4", name: "정수현", role: "LEADER" }],
  },
];

const demoMembers = [
  [
    "김민준",
    "재학",
    "프론트엔드 개발과 디자인 시스템에 관심이 있습니다.",
    ["React", "TypeScript", "Node.js"],
  ],
  [
    "이서연",
    "재학",
    "사용자 문제를 데이터와 AI로 해결하는 것을 좋아합니다.",
    ["Python", "AI/ML", "Django"],
  ],
  [
    "박지훈",
    "휴학",
    "안정적인 서버와 데이터 모델을 설계합니다.",
    ["Java", "Spring", "MySQL"],
  ],
  [
    "최예원",
    "재학",
    "모바일에서 자연스러운 사용자 경험을 만듭니다.",
    ["Swift", "Flutter", "Kotlin"],
  ],
  [
    "정수현",
    "재학",
    "접근성 높은 인터페이스와 웹 성능을 연구합니다.",
    ["Vue.js", "JavaScript", "CSS"],
  ],
  [
    "한동민",
    "휴학",
    "딥러닝 모델을 실제 서비스에 적용하고 있습니다.",
    ["Python", "PyTorch", "AI/ML"],
  ],
  [
    "김명수",
    "졸업",
    "제품 중심의 프론트엔드 개발자입니다.",
    ["React", "TypeScript", "AWS"],
  ],
  [
    "박은지",
    "졸업",
    "분산 시스템과 플랫폼 엔지니어링을 다룹니다.",
    ["Java", "Spring", "Kubernetes"],
  ],
].map(([name, education_status, self_description, tech_stack], index) => ({
  id: `demo-member-${index + 1}`,
  name,
  education_status,
  self_description,
  tech_stack,
  profile_image: "/images/default_profile.webp",
  github_username: `tcp-demo-${index + 1}`,
  portfolio_link: null,
  current_company:
    education_status === "졸업"
      ? index % 2 === 0
        ? "네이버"
        : "카카오"
      : null,
}));

const demoTeams = [
  {
    id: 1,
    title: "2026 AI Creativity Hackathon",
    category: "해커톤",
    status: "open",
    periodStart: "2026-09-14",
    periodEnd: "2026-09-18",
    deadline: "2026-09-08",
    description: "AI로 캠퍼스 생활의 불편을 해결할 팀원을 찾습니다.",
    techStack: "Python, FastAPI, React",
    tag: "AI, 해커톤, 초보환영",
    executionType: "hybrid",
    selectionProc: "지원서 검토 후 온라인 미팅",
    contact: "TCP Discord #team-building",
    goals: "프로토타입 완성, 데모데이 발표",
    projectImage: "/tcplogo512.png",
    link: "",
    createdAt: "2026-08-28T09:00:00+09:00",
    leader: {
      id: "demo-leader-1",
      name: "김민준",
      profile_image: "/images/default_profile.webp",
    },
    roles: [
      { roleName: "프론트엔드", recruitCount: 1 },
      { roleName: "백엔드", recruitCount: 1 },
    ],
  },
  {
    id: 2,
    title: "캠퍼스 생활 통합 앱 프로젝트",
    category: "프로젝트",
    status: "open",
    periodStart: "2026-09-21",
    periodEnd: "2026-12-18",
    deadline: "2026-09-12",
    description: "학내 공지와 일정을 한곳에서 보는 모바일 앱을 만듭니다.",
    techStack: "React Native, Supabase, Figma",
    tag: "프론트엔드, 백엔드, 초보환영",
    executionType: "offline",
    selectionProc: "포트폴리오 검토 후 인터뷰",
    contact: "TCP Discord #mobile-app",
    goals: "MVP 출시, 교내 사용자 테스트",
    projectImage: "/tcplogo512.png",
    link: "",
    createdAt: "2026-08-24T14:30:00+09:00",
    leader: {
      id: "demo-leader-2",
      name: "최예원",
      profile_image: "/images/default_profile.webp",
    },
    roles: [
      { roleName: "모바일", recruitCount: 2 },
      { roleName: "디자인", recruitCount: 1 },
    ],
  },
  {
    id: 3,
    title: "오픈소스 기여 첫걸음",
    category: "스터디",
    status: "open",
    periodStart: "2026-09-07",
    periodEnd: "2026-11-30",
    deadline: "2026-09-06",
    description: "이슈 탐색부터 첫 Pull Request까지 함께 경험합니다.",
    techStack: "Git, GitHub, JavaScript",
    tag: "오픈소스, 초보환영, 프로젝트",
    executionType: "online",
    selectionProc: "선착순 안내",
    contact: "TCP Discord #opensource",
    goals: "개인별 오픈소스 기여 1회",
    projectImage: "/tcplogo512.png",
    link: "",
    createdAt: "2026-08-20T19:00:00+09:00",
    leader: {
      id: "demo-leader-3",
      name: "정수현",
      profile_image: "/images/default_profile.webp",
    },
    roles: [{ roleName: "참여자", recruitCount: 6 }],
  },
  {
    id: 4,
    title: "ICPC 예선 대비 팀",
    category: "공모전",
    status: "closed",
    periodStart: "2026-03-10",
    periodEnd: "2026-05-30",
    deadline: "2026-03-05",
    description: "주 2회 문제 풀이와 코드 리뷰를 진행한 알고리즘 팀입니다.",
    techStack: "C++, Python",
    tag: "알고리즘, 공모전",
    executionType: "online",
    selectionProc: "간단한 코딩 테스트",
    contact: "모집 종료",
    goals: "ICPC 예선 통과",
    projectImage: "/tcplogo512.png",
    link: "",
    createdAt: "2026-02-20T18:00:00+09:00",
    leader: {
      id: "demo-leader-4",
      name: "박지훈",
      profile_image: "/images/default_profile.webp",
    },
    roles: [{ roleName: "알고리즘", recruitCount: 2 }],
  },
];

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

function handle(method, pathname, query, body, headers = {}) {
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

  /* ---------- 사이트 공용 공개 화면 ---------- */
  if (method === "GET" && pathname === "/api/v1/announcements") {
    return [200, demoAnnouncements];
  }
  if (method === "GET" && /^\/api\/v1\/announcements\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").at(-1));
    const announcement = demoAnnouncements.find((item) => item.id === id);
    return announcement
      ? [200, announcement]
      : [404, { statusCode: 404, message: "공지사항을 찾을 수 없습니다." }];
  }
  if (method === "GET" && pathname === "/api/v1/study") {
    const year = query.get("year");
    return [
      200,
      year
        ? demoStudies.filter((study) => String(study.start_year) === year)
        : demoStudies,
    ];
  }
  if (method === "GET" && /^\/api\/v1\/study\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").at(-1));
    const study = demoStudies.find((item) => item.id === id);
    return study
      ? [200, study]
      : [404, { statusCode: 404, message: "스터디를 찾을 수 없습니다." }];
  }
  if (method === "GET" && pathname === "/api/v1/members") {
    return [200, demoMembers];
  }
  if (method === "GET" && pathname === "/api/v1/teams") {
    return [200, demoTeams];
  }
  if (
    method === "GET" &&
    /^\/api\/v1\/teams\/\d+\/application-status$/.test(pathname)
  ) {
    return [200, { hasApplied: false, applicationInfo: null }];
  }

  /* ---------- 홈/헤더가 호출하는 경로들 ----------
   * 홈 화면이 실제 데이터가 있는 상태로 보이도록 최소 계약을 흉내 냅니다.
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
    return [
      200,
      {
        is_application_enabled: true,
        start_date: "2026-08-01T00:00:00.000Z",
        end_date: "2026-09-30T23:59:59.999Z",
      },
    ];
  }

  if (method === "POST" && pathname === "/api/v1/recruitment") {
    return [201, { message: "목업 지원서가 접수되었습니다." }];
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

  // 소스는 계속 늘어나므로 목록 응답이 아니라 별도 경로로 줍니다.
  // Nest 미들웨어가 가드 앞에서 부르는 경로. 회원/비회원을 나눠 셉니다.
  if (
    method === "POST" &&
    /\/view$/.test(pathname) &&
    pathname.startsWith(`${PUBLIC_BASE}/`)
  ) {
    const id = decodeURIComponent(
      pathname.slice(PUBLIC_BASE.length + 1, -"/view".length),
    );
    if (!articles.some((a) => a.articleId === id)) return [204, null];
    const current = viewCountsOf(id);
    const key = query.get("member") === "true" ? "member" : "guest";
    viewCounts.set(id, {
      ...current,
      [key]: current[key] + 1,
      lastViewedAt: new Date().toISOString(),
    });
    return [204, null];
  }

  if (method === "GET" && pathname === `${PUBLIC_BASE}/sources`) {
    const published = articles.filter(isPublic);
    return [
      200,
      {
        items: PUBLIC_SOURCES.map((source) => ({
          ...source,
          count: published.filter((a) => a.source?.id === source.id).length,
        })),
      },
    ];
  }

  if (method === "GET" && pathname === PUBLIC_BASE) {
    const selected = query.getAll("tags").filter(Boolean);
    const selectedSources = query.getAll("sources").filter(Boolean);
    const rows = articles
      .filter(isPublic)
      .filter(matches)
      .filter(
        (a) => !selected.length || a.tags.some((t) => selected.includes(t)),
      )
      .filter(
        (a) =>
          !selectedSources.length || selectedSources.includes(a.source?.id),
      )
      .sort(byNewest)
      .map(publicListItem);
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
        ...publicDetailItem(found),
        ...(headers.authorization
          ? {
              valueScore: publicValueScoreOf(found),
            }
          : {}),
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
        evaluation: evaluationOf(found), // 관리자 상세는 dimensions 중첩 형태
      },
    ];
  }

  return [
    404,
    {
      statusCode: 404,
      message: `목업 서버에 구현되지 않은 경로입니다: ${method} ${pathname}`,
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
        req.headers,
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
        `   ↑ 아직 목업 응답을 만들지 않은 경로입니다. 필요한 화면만 추가해 사용하세요.`,
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
      "  TCP 프론트엔드 목(mock) API 서버",
      "  ─────────────────────────────────────────────",
      `  주소        http://${HOST}:${PORT}`,
      `  더미 아티클  ${articles.length}건 (공개 ${publicCount}건)`,
      `  공용 화면     공지 ${demoAnnouncements.length} · 스터디 ${demoStudies.length} · 멤버 ${demoMembers.length} · 팀 ${demoTeams.length}`,
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
