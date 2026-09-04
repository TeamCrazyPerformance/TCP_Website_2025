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
    id: "github-trending",
    name: "GitHub Trending",
    type: "HTML",
    domain: "github.com",
    path: "/trending",
  },
  {
    id: "tailscale-blog",
    name: "Tailscale Blog",
    type: "RSS",
    domain: "tailscale.com",
    path: "/blog",
  },
  {
    id: "rust-blog",
    name: "Rust Blog",
    type: "RSS",
    domain: "blog.rust-lang.org",
    path: "/feed.xml",
  },
  {
    id: "hugging-face-blog",
    name: "Hugging Face Blog",
    type: "RSS",
    domain: "huggingface.co",
    path: "/blog",
  },
  {
    id: "deepmind-blog",
    name: "Google DeepMind Blog",
    type: "RSS",
    domain: "blog.google",
    path: "/technology/google-deepmind",
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
    articleId: "article-20260903-000008",
    title: "NousResearch/hermes-agent",
    oneLineSummary:
      "Nous Research에서 자체 학습 루프와 다채널 게이트웨이를 지원하는 자가 개선형 AI 에이전트인 Hermes Agent를 공개합니다.",
    tags: ["AI", "개발자 도구", "오픈소스"],
    sourceId: "github-trending",
    articleUrl: "https://github.com/NousResearch/hermes-agent",
    originalPublishedAt: "2026-09-03T15:05:10.521Z",
    collectedAt: "2026-09-03T15:09:45.288Z",
  },
  {
    articleId: "article-20260903-000004",
    title:
      "JFrog, AI 시대 소프트웨어 공급망을 위한 DevGovOps 및 연속적 규정 준수 기능 공개",
    oneLineSummary:
      "JFrog가 AI 시대의 소프트웨어 공급망 거버넌스를 자동화하는 AppTrust의 DevGovOps 기능을 공개합니다.",
    tags: ["DevOps", "보안", "산업 동향"],
    sourceId: "sdtimes",
    originalPublishedAt: "2026-09-03T14:45:25.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
  },
  {
    articleId: "article-20260903-000002",
    title:
      "pnpm 12, Rust 기반으로 패키지 매니저 재작성해 pnpm 11 워크플로우 유지하며 설치 속도 개선",
    oneLineSummary:
      "pnpm이 버전 12에서 Rust 기반 네이티브 재작성을 통해 pnpm 11의 명령어와 레이아웃을 유지하면서 설치 속도를 대폭 개선합니다.",
    tags: ["프로그래밍 언어", "개발자 도구", "오픈소스"],
    sourceId: "infoq",
    articleUrl: "https://www.infoq.com/news/2026/09/pnpm-12-rust",
    originalPublishedAt: "2026-09-03T11:23:00.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
    detailPoints: [
      "pnpm 12는 TypeScript와 Node.js 구현을 네이티브 Rust로 교체하면서 pnpm 11의 명령어와 잠금 파일 형식을 그대로 유지한다.",
      "캐시와 node_modules가 존재하는 반복 설치의 경우 Rust 버전은 472밀리초에서 15밀리초로 실행 시간이 단축되었다.",
      "Vercel의 대규모 Turborepo 워크스페이스 독립 테스트 결과 6가지 시나리오에서 중간 설치 시간이 64.4%에서 90.5% 단축되었다.",
    ],
  },
  {
    articleId: "article-20260903-000003",
    title:
      "Cohere, 복잡한 문서에서 효율적인 멀티모달 정보 추출을 지원하는 Parse 5 공개",
    oneLineSummary:
      "Cohere가 복잡한 기업 문서를 구조화된 Markdown으로 변환하는 23억 파라미터 규모의 멀티모달 모델 Parse 5를 출시합니다.",
    tags: ["AI", "데이터", "개발자 도구"],
    sourceId: "infoq",
    originalPublishedAt: "2026-09-03T06:06:00.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
  },
  {
    articleId: "article-20260903-000012",
    title: "코딩 에이전트를 위한 자체 소유 메모리 레이어, funes 공개",
    oneLineSummary:
      "오픈소스 도구인 funes는 코딩 에이전트의 로컬 세션 흔적을 인덱싱하여 여러 에이전트와 기기 간에 공유할 수 있는 영구 메모리 계층을 제공합니다.",
    tags: ["AI", "개발자 도구", "오픈소스"],
    sourceId: "hugging-face-blog",
    originalPublishedAt: "2026-09-03T00:00:00.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
  },
  {
    articleId: "article-20260903-000011",
    title: "350M 모델을 위한 100회의 GRPO 단계를 통한 구조화된 출력 성능 향상",
    oneLineSummary:
      "연구진은 GRPO와 TRL 라이브러리로 LFM2.5-350M 모델을 미세 조정하여 IFStruct 벤치마크 점수를 22.6%에서 29.7%로 향상시켰습니다.",
    tags: ["AI", "프로그래밍 언어", "개발자 도구"],
    sourceId: "hugging-face-blog",
    originalPublishedAt: "2026-09-03T00:00:00.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
  },
  {
    articleId: "article-20260902-000002",
    title:
      "OpenAI, 지속적인 상태 유지 음성 상호작용을 위한 GPT-Live 아키텍처 상세 공개",
    oneLineSummary:
      "OpenAI가 지연 시간에 민감한 미디어 처리와 애플리케이션 로직을 분리하여 지속적인 음성 상호작용을 지원하는 GPT-Live 아키텍처를 공개합니다.",
    tags: ["AI", "소프트웨어 아키텍처", "산업 동향"],
    sourceId: "infoq",
    originalPublishedAt: "2026-09-02T12:20:00.000Z",
    collectedAt: "2026-09-02T15:00:00.000Z",
  },
  {
    articleId: "article-20260902-000003",
    title: "Cloudflare, 사용자가 거부할 수 있는 선택적 OAuth 스코프 추가",
    oneLineSummary:
      "Cloudflare가 사용자가 동의 화면에서 개별 권한을 선택 해제할 수 있는 선택적 OAuth 스코프를 추가합니다.",
    tags: ["보안", "개발자 도구", "산업 동향"],
    sourceId: "infoq",
    originalPublishedAt: "2026-09-02T09:07:00.000Z",
    collectedAt: "2026-09-02T15:00:00.000Z",
  },
  {
    articleId: "article-20260903-000015",
    title: "정부와 기업을 위한 사전 능동형 사이버 방어",
    oneLineSummary:
      "Google이 정부와 신뢰할 수 있는 파트너에게 최첨단 Gemini 모델과 CodeMender를 제공하는 Fairwind Program을 출시합니다.",
    tags: ["AI", "클라우드", "보안"],
    sourceId: "deepmind-blog",
    originalPublishedAt: "2026-09-02T00:00:00.000Z",
    collectedAt: "2026-09-03T15:00:22.302Z",
  },
  {
    articleId: "article-20260902-000012",
    title: "BenchMIRT: LLM 벤치마크는 실제로 무엇을 측정하는가?",
    oneLineSummary:
      "Ai2Comms 연구진이 개별 프롬프트 수준에서 LLM 벤치마크를 감사하고 여러 역량을 분리하는 다차원 문항 반응 이론 방법인 BenchMIRT를 공개합니다.",
    tags: ["AI", "소프트웨어 품질", "산업 동향"],
    sourceId: "hugging-face-blog",
    originalPublishedAt: "2026-09-01T19:54:26.000Z",
    collectedAt: "2026-09-02T15:00:00.000Z",
  },
  {
    articleId: "article-20260901-000009",
    title: "Imbad0202/academic-research-skills",
    oneLineSummary:
      "Claude Code를 위한 학술 연구 스위트가 v3.8로 업데이트되어 인용 신뢰성 감사 및 강제 차단 게이트를 제공합니다.",
    tags: ["AI", "소프트웨어 품질", "개발자 도구"],
    sourceId: "github-trending",
    articleUrl: "https://github.com/Imbad0202/academic-research-skills",
    originalPublishedAt: "2026-09-01T15:00:57.533Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260901-000001",
    title: "Zstandard와 Pingora를 활용한 캐시 스토리지 페타바이트 절감 방안",
    oneLineSummary:
      "Cloudflare가 Zstandard를 Pingora에 통합하여 캐시 용량을 확장하는 캐시 트랜스코딩 프로토타입을 개발했습니다.",
    tags: ["클라우드", "개발자 도구", "산업 동향"],
    sourceId: "cloudflare-blog",
    originalPublishedAt: "2026-09-01T12:59:00.000Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260901-000003",
    title: "HCP Terraform, AI 기반 인프라를 위한 제어 평면으로 자리매김",
    oneLineSummary:
      "HashiCorp는 AI 에이전트가 인프라 코드를 자율적으로 생성하고 실행할 때 HCP Terraform을 통해 거버넌스와 제어를 제공합니다.",
    tags: ["클라우드", "DevOps", "산업 동향"],
    sourceId: "infoq",
    originalPublishedAt: "2026-09-01T12:00:00.000Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260902-000013",
    title:
      "Hugging Face, 브라우저 로컬 AI 성능 개선을 위한 200개 이상의 WebGPU 커널 공개",
    oneLineSummary:
      "Hugging Face가 브라우저 내 AI 추론 성능 향상을 위한 최적화된 WebGPU 커널 라이브러리인 @huggingface/kernels를 공개했습니다.",
    tags: ["AI", "개발자 도구", "오픈소스"],
    sourceId: "hugging-face-blog",
    originalPublishedAt: "2026-09-01T00:00:00.000Z",
    collectedAt: "2026-09-02T15:00:00.000Z",
  },
  {
    articleId: "article-20260901-000010",
    title: "rustup 1.29.1 버전 발표",
    oneLineSummary:
      "rustup 팀이 동시성 개선과 신규 기능 및 버그 수정을 포함한 rustup 1.29.1 버전을 발표합니다.",
    tags: ["프로그래밍 언어", "개발자 도구", "오픈소스"],
    sourceId: "rust-blog",
    originalPublishedAt: "2026-09-01T00:00:00.000Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260901-000005",
    title:
      "첫 번째 FHE 애플리케이션 구축하기: 보이지 않는 데이터 연산을 위한 실용적 체크리스트",
    oneLineSummary:
      "완전동형암호 애플리케이션 개발을 위한 아키텍처 설계와 연산 제약 관리 절차를 설명합니다.",
    tags: ["애플리케이션 개발", "보안", "오픈소스"],
    sourceId: "sdtimes",
    originalPublishedAt: "2026-08-31T17:34:04.000Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260901-000006",
    title: "AI가 드러낸 오픈소스 생태계의 취약점 조치 격차",
    oneLineSummary:
      "인공지능 모델이 취약점을 빠르게 발견하면서 유지보수 역량을 압도하고 오픈소스 생태계의 조치 격차를 심화시키고 있습니다.",
    tags: ["AI", "보안", "산업 동향"],
    sourceId: "sdtimes",
    originalPublishedAt: "2026-08-31T16:38:13.000Z",
    collectedAt: "2026-09-01T15:30:00.000Z",
  },
  {
    articleId: "article-20260831-000040",
    title:
      "DoorDash의 Flux, 클라우드 기반 에이전트로 13만 건의 엔지니어링 작업 처리",
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
    title:
      "Tailcat: Tailscale의 WireGuard, NAT 탐색 및 DERP를 위한 오픈소스 CLI",
    oneLineSummary:
      "Tailscale 개발진이 Tailscale 제어 plane 없이 데이터 plane만 사용할 수 있는 오픈소스 CLI 도구 tailcat을 공개합니다.",
    tags: ["오픈소스", "개발자 도구", "네트워크"],
    sourceId: "tailscale-blog",
    originalPublishedAt: "2026-08-31T11:40:00.000Z",
    collectedAt: "2026-08-31T15:10:00.000Z",
  },
  {
    articleId: "article-20260831-000041",
    title:
      "자바 뉴스 라운드업: GraalVM, Jakarta Data, JNoSQL, Azul Payara, WildFly, Quarkus, Atmosphere",
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
    title:
      "Foundry Model Router, 2개 지역에서 28개 지역으로 확장 및 모델 풀 갱신",
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
    title:
      "Cloudflare, AI 에이전트와 개발자의 커스텀 데이터 검색을 지원하는 AI Search 확장",
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
    title:
      "Cloudflare Workers, 인바운드 TCP 지원 및 첫 번째 프로토콜로 gRPC 도입",
    oneLineSummary:
      "Cloudflare Workers가 인바운드 TCP 연결을 지원하며, 이를 기반으로 한 gRPC 지원 기능을 프라이빗 베타로 출시했습니다.",
    tags: ["클라우드", "애플리케이션 개발", "네트워크"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-29T12:00:00.000Z",
    collectedAt: "2026-08-29T14:00:00.000Z",
  },
  {
    articleId: "article-20260829-000002",
    title:
      "FreeToken: 동적 공동 실행을 통한 소비자 하드웨어에서의 프론티어 MoE 추론",
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
    title:
      "BotBase for Operators: Cloudflare 봇 디렉토리 등록 및 관리를 위한 투명성 강화",
    oneLineSummary:
      "Cloudflare가 봇 운영자를 위한 BotBase for Operators를 출시하여 제출 상태 확인과 정보 수정 기능을 제공합니다.",
    tags: ["애플리케이션 개발", "보안", "산업 동향"],
    sourceId: "cloudflare-blog",
    originalPublishedAt: "2026-08-28T10:00:00.000Z",
    collectedAt: "2026-08-28T14:20:00.000Z",
  },
  {
    articleId: "article-20260828-000004",
    title:
      "AKS, 새로운 NAP 가이드를 통해 노드 중단을 더욱 예측 가능하게 만들고자 함",
    oneLineSummary:
      "Microsoft가 공개한 AKS NAP 가이드는 자동화된 노드 통합 시 애플리케이션 가용성과 인프라 효율성을 균형 있게 유지하는 방법을 제시합니다.",
    tags: ["클라우드", "개발 조직", "소프트웨어 품질"],
    sourceId: "infoq",
    originalPublishedAt: "2026-08-28T09:00:00.000Z",
    collectedAt: "2026-08-28T14:30:00.000Z",
  },
  {
    articleId: "article-20260828-000011",
    title:
      "Spring Boot에서의 양자 후 암호화: 이번 스프린트에 적용 가능한 4가지 패턴",
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
    NON_PUBLIC_STATES[
      (index - PUBLIC_ARTICLE_COUNT) % NON_PUBLIC_STATES.length
    ];
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
  isNew: isNewArticle(a.collectedAt, a.originalPublishedAt),
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
const isNewArticle = (collectedAt, originalPublishedAt) => {
  if (!collectedAt || !originalPublishedAt) return false;
  const collectedTime = new Date(collectedAt).getTime();
  const publishedTime = new Date(originalPublishedAt).getTime();
  if (Number.isNaN(collectedTime) || Number.isNaN(publishedTime)) return false;
  const windowMs = NEW_ARTICLE_WINDOW_HOURS * 3600 * 1000;
  const collectedAge = Date.now() - collectedTime;
  const publishedAge = Date.now() - publishedTime;
  return collectedAge < windowMs && publishedAge < windowMs;
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
  {
    id: "rust-blog",
    name: "Rust Blog",
    domain: "blog.rust-lang.org",
    category: "기술 블로그",
  },
  {
    id: "hugging-face-blog",
    name: "Hugging Face Blog",
    domain: "huggingface.co",
    category: "AI",
  },
  {
    id: "deepmind-blog",
    name: "Google DeepMind Blog",
    domain: "deepmind.google",
    category: "AI",
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
  qualityReview: (() => {
    const review = qualityCases.find((item) => item.articleId === a.articleId);
    return review
      ? { caseId: review.caseId, caseVersion: review.caseVersion }
      : null;
  })(),
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
    id: 12,
    title: "[안내] 2026학년도 2학기 개강총회/파티",
    summary: "2026학년도 2학기 개강총회/파티 일정 안내예요.",
    contents: `🎉 안녕하세요 TCP 여러분, 2학기 개강을 맞이하여 개강총회 및 개강파티를 진행해요.

일시: 9월 8일(화) 18:30
장소: 추후 안내

❓ 2학기 개강총회는 무엇을 하는 자리인가요?
2학기 개강총회는 동아리가 2학기를 공식적으로 시작하는 시간이에요.
MT/해커톤/현직자 세미나 등 2학기 일정 안내, 스터디 안내, 프로젝트 성과공유 등이 이루어져요.

❓ 개강파티는 무엇을 하는 자리인가요?
개강총회 이후에 진행되며, 저녁을 먹으면서 TCP의 여러 사람들을 만나는 자리예요.`,
    author: { name: "이준수" },
    publishAt: "2026-09-03T00:00:00.000Z",
    createdAt: "2026-09-03T06:57:48.225Z",
    updatedAt: "2026-09-03T15:25:45.424Z",
    views: 3,
  },
  {
    id: 11,
    title: "[공지] Tech Articles 서비스 시작 안내",
    summary: "최신 개발 뉴스를 제공하는 Tech Articles 서비스가 시작됐어요.",
    contents: `안녕하세요, TCP 여러분
TCP 여름방학 웹서비스 주니어 팀에서 진행한 **'Tech Articles' 페이지 개발 완료** 및 페이지 추가가 완료되어 안내해 드려요.

Tech Articles 페이지는 최신 개발 및 기술 뉴스를 한곳에 모아놓은 페이지에요.
매일같이 바뀌는 개발 트렌드를 따라가기 힘드시지 않으셨나요? 바쁜 학업과 프로젝트 일정 속에서 유용한 글을 일일이 찾아보는 것 자체가 꽤 번거로운 일이었을 텐데요.
'Tech Articles' 페이지는 **검증된 개발 뉴스를 자체 알고리즘으로 필터링 후 요약 및 제공**해요. 따라서, 보다 쉽고 빠르게 선별된 개발 소식을 접할 수 있어요.

❗**주요 기능**❗

📌 **기술 트렌드 통합 제공**
*GitHub Trending, InfoQ, SD Times, Cloudflare Blog* 등 검증된 기술 블로그와 커뮤니티의 기사를 한눈에 확인할 수 있어요.

📌 **AI 요약 제공**
원문을 모두 읽지 않아도 핵심을 파악할 수 있도록 AI 기반 요약을 제공해드려요. 원문 링크도 제공되어 있기 때문에 필요 시 원문을 확인할 수도 있어요.

📌 **고가치 기사 선별**
아무 기사나 제공하는 것이 아닌 이 기사가 최신 정보인지, 개발자에게 도움이 될만한 정보인지 점수를 부여해서 가치가 높은 기사만 선별해서 제공해드려요. 책정한 점수도 제공하므로 참고기준으로 삼을 수 있어요.

다양한 기술 동향을 파악하고 학습하는 데 유용하게 활용하실 수 있어요.
사용 중 발견된 버그나 개선 의견이 있다면 언제든 문의해 주세요.

📧 문의사항은 아래 이메일로 부탁드려요.
Tech Articles 프론트엔드 담당 박준우   02346nn@naver.com

※ 현재 Article 점수 책정 시스템에 미흡한 부분이 있어서 점검 중이에요. ※`,
    author: { name: "김재민" },
    publishAt: "2026-08-23T00:00:00.000Z",
    createdAt: "2026-08-23T08:43:13.545Z",
    updatedAt: "2026-09-03T15:25:47.926Z",
    views: 44,
  },
  {
    id: 10,
    title: "[안내] TCP - EC 연합 스터디",
    summary: "2026학년도 1학기에 TCP와 EC가 연합해서 진행하는 스터디 안내에요.",
    contents: `**TCP-EC 연합 스터디 안내**

1. **C 스터디**
스터디 진행 주체: EC
신청 방법: https://endless-creation.com/ > 회원가입 > "지원하기" > "C스터디 모집(공개)"
지원 마감일시: 03월 22일(일) 24시

2. **AI 스터디**
스터디 진행 주체: EC
신청 방법: https://endless-creation.com/ > 회원가입 > "지원하기" > "AI스터디(공개)"
지원 마감일시: 03월 22일(일) 24시

3. **인간 시대의 끝이 도래했다**
스터디 진행 주체: TCP
신청 방법: https://teamcrazyperformance.com/ > 회원가입 > "Study" > "인간 시대의 끝이 도래했다" > "스터디 참여"
지원 마감일시: 05월 29일 (무제한)
스터디 개요: 산업구조를 바꾸고 있는 인공지능을 개발자 관점에서 이해하고, 활용하는 방법, 최신 인공지능 트렌드 강의

4. **2026학년도 TCP 보안 스터디**
스터디 진행 주체: TCP
지원 마감일시: 03월 31일(화) 24시
스터디 개요: 보안 분야에 관심을 가진 학생들에게 Dreamhack을 통한 보안에 대한 기본지식과 스터디 환경 제공

5. **2026 웹 개발 스터디**
스터디 진행 주체: TCP
지원 마감일시: 03월 31일(화) 24시
스터디 개요: 웹 개발에 대한 전반적인 지식 습득 및 웹 프로젝트 진행`,
    author: { name: "이준수" },
    publishAt: "2026-03-21T00:00:00.000Z",
    createdAt: "2026-03-21T09:58:10.975Z",
    updatedAt: "2026-09-03T15:28:30.311Z",
    views: 84,
  },
  {
    id: 9,
    title: "[안내] 2026학년도 1학기 개강총회/파티",
    summary: "2026학년도 1학기 개강총회/파티 일정 안내예요.",
    contents: `🎉 안녕하세요 TCP 여러분, 1학기 개강을 맞이하여 개강총회 및 개강파티를 진행해요.

**일시: 3월 18일(수) 18:10**
**장소: 미래관 202호**

❓ 개강총회는 무엇을 하는 자리인가요?
개강총회는 **동아리가 한 학기를 공식적으로 시작하는 시간**이에요.
TCP 소개, 작년 활동 리캡, 연간일정, 회비 안내, 스터디 안내, TCP 커뮤니케이션 채널 안내 등이 이루어져요.

❓ 개강파티는 무엇을 하는 자리인가요?
개강총회 이후에 진행되며, 저녁을 먹으면서 **TCP의 여러 사람들과 친해지는 자리**예요.`,
    author: { name: "이준수" },
    publishAt: "2026-03-15T00:00:00.000Z",
    createdAt: "2026-03-15T05:44:17.406Z",
    updatedAt: "2026-09-03T06:51:34.430Z",
    views: 50,
  },
  {
    id: 8,
    title: "[모집] TCP 웹서비스 운영팀 모집 안내",
    summary:
      "TCP 웹서비스를 함께 관리하고 발전시켜 나갈 5명의 운영진을 찾고 있어요.",
    contents: `# 🚀 TCP 웹서비스 운영팀 모집 안내

안녕하세요! TCP 웹서비스 운영팀에서 웹서비스를 체계적으로 관리하고 발전시켜 나갈 **5명의 운영진**을 찾고 있어요.

경력있는 신입을 요구하는 지금! TCP는 보유 인프라를 바탕으로 **지식은 있지만 경력은 없는 신입도 학기중에 부담 없이 경력을 쌓을 수 있는 환경**을 제공하고자 해요.

---

## 운영진 모집 대상

**기존 TCP 부원이 아니어도 지원 가능해요!** (서비스 기획 & 운영 매니저 제외)
운영진으로 선발되시면 **TCP 정회원 자격이 자동으로 부여**돼요.

---

# 모집 역할

## 1. 🏗️ 서버 인프라 매니저 (Infrastructure Manager)
**"우리 서비스가 사는 튼튼한 집을 지어요"**

### 🛠️ 이런 기술을 사용해요 (Tech Stack)
*   **OS/Server**: Proxmox VE, Ubuntu Linux
*   **Network**: IPTables, Nginx (Reverse Proxy), SSL/TLS
*   **Tools**: Shell Script (Bash), SSH

## 2. ⚙️ 백엔드 & DB 개발자 (Backend Developer)
**"눈에 보이지 않는 중요한 기능과 소중한 데이터를 책임져요"**

### 🛠️ 이런 기술을 사용해요 (Tech Stack)
*   **Language**: TypeScript, Node.js
*   **Framework**: NestJS
*   **Database**: PostgreSQL, TypeORM
*   **Infra**: Docker, Docker Compose

## 3. 프론트엔드 개발자 (Frontend Developer)
**"사용자가 만나는 첫 화면을 아름답게 만들어요"**

### 🛠️ 이런 기술을 사용해요 (Tech Stack)
*   **Language**: JavaScript (ES6+)
*   **Framework / Library**: React 19, React Router 7
*   **Build / Dev Tools**: Create React App (react-scripts 5), npm

## 4. 🖌️ [신설 운영직] UI/UX 디자이너 (UI/UX Designer)
## 5. [TCP 부원만 지원 가능]👩‍💼 서비스 기획 & 운영 매니저 (Service Manager & CPO)

---

## 운영팀 활동 및 혜택
*   **활동비 전액 면제**
*   **TCP인프라실 활용 가능**
*   **정기 회의 참여 의무** (매주 1회)
*   **의무 활동 기간** 최소 한 학기(6개월)

## 모집 일정
- 모집 기간: 2월 13일(금) 00시 ~ 3월 11일(수) 24시
- 면접 기간: 3월 9일(월) ~ 3월 15일(일)
- 합격자 발표: 3월 15일(일) 개별 공지

TCP와 함께 성장할 여러분을 기다립니다! 🚀`,
    author: { name: "이준수" },
    publishAt: "2026-02-17T00:00:00.000Z",
    createdAt: "2026-02-17T06:08:03.855Z",
    updatedAt: "2026-08-23T08:54:36.689Z",
    views: 82,
  },
  {
    id: 6,
    title: "[안내] TCP 웹사이트 사용 안내",
    summary: "TCP 웹사이트를 소개해요.",
    contents: `❓ 웹사이트에서 무엇을 할 수 있나요?

📄**페이지 소개**
- **메인 페이지** - TCP에 대한 간략한 소개와 활동 사진이 있어요.
- **About 페이지** - TCP에 대한 상세한 소개와 지도(예정)가 있어요.
- **Members 페이지** - TCP의 활동멤버들과 졸업멤버들이 있어요. 같은 관심사를 가진 부원을 찾아봐요!
- **Recruitment 페이지** - TCP 신입부원 모집을 받아요. 입부 안내와 FAQ(예정)가 있어요.
- **Announcement 페이지** - TCP부원들을 위한 각종 공지사항이 올라오는 페이지에요, 중요한 정보가 올라올 수 있으니 꼭 확인해주세요!

- 📰 **Tech Articles 페이지** - 매일 따끈따끈한 IT 최신 소식들 중 고가치 정보들만 선별하여 올려드려요!
- 📓 **Study 페이지** - TCP부원분들은 이 페이지를 통해 스터디 진행상황과 스터디 자료에 접근할 수 있어요.
- 👥 **Find Your Team 페이지** - TCP 부원이 아니더라도 회원가입만 하면 사용할 수 있어요. 프로젝트, 대회 출전 등 마음이 맞는 사람들을 모아서 팀을 구성해 보세요.
- 🙋‍♂️ **마이페이지** 프로필 정보를 수정하고 멤버스 카드에 노출되는 정보를 선택할 수 있어요.

이 밖에도 웹페이지를 돌아다니다가 어떤 입력을 하면 **숨겨진 페이지**를 찾을지도 몰라요!`,
    author: { name: "이준수" },
    publishAt: "2026-02-13T00:00:00.000Z",
    createdAt: "2026-02-13T12:29:46.199Z",
    updatedAt: "2026-08-23T07:35:35.062Z",
    views: 93,
  },
  {
    id: 1,
    title: "[모집] TCP 2026학년도 1학기 신입부원 & 웹서비스 운영팀 모집 안내",
    summary:
      "TCP(Team Crazy Performance)에서 2026학년도 1학기 신입부원과 웹서비스 운영팀을 모집해요.",
    contents: `🙇 안녕하세요, 컴퓨터공학과 학술 동아리 TCP(Team Crazy Performance)에서 2026학년도 1학기 신입부원분들과 운영진분들을 모집해요.

- TCP는 **다양한 관심사를 가진 사람들**이 **개발과 탐구라는 공통점**으로 서로 모여서 **자유롭게 함께 성장**하는 동아리예요.
무언가를 만들고 사랑하고 남들과 공유하는 걸 좋아하는 모두를 환영해요!

- TCP는 **여러분이 만들어가는 동아리**예요. 신입생인지 4학년인지, 재학생인지 복학생인지, 컴퓨터공학과 학생인지 타과 학생인지, 교수님인지 학생인지 관계없이 누구나 와서 스터디를 개설하고 참여할 수 있어요.

### 📝 2026년도 1학기 활동 계획

🗓️ **TCP 공통 일정**

- 1학기 개강총회/파티 - 이번 학기 동아리 활동을 어떻게, 누구랑, 어떤 방식으로 할 지 알려주는 첫 공식 모임이에요.
- 동아리 MT - 중간고사 직후인 5월 전후에 가는 친목회예요.
- 1학기 종강총회/파티 - 이번 학기 우리가 뭘 했고, 뭘 남겼는지 정리하는 마무리 모임이에요.

1️⃣ **TCP 메인 스터디**

- 개발자 튜토리얼
- 인간 시대의 끝이 도래했다
- 동아리 연합 C 스터디

2️⃣ **TCP 서브 스터디**

- 웹 개발 스터디
- 컴퓨터공학개론 스터디
- 보안 스터디 (웹 / 시스템 해킹)
- 머신러닝 스터디 (핸즈온 머신러닝 3판 사용)

### 📅 신입부원 모집 일정

- 공식 모집 기간: 2월 13일(금) 00시 ~ 3월 11일(수) 24시
- 면접 기간: 3월 9일(월) ~ 3월 15일(일)
- 합격자 발표: 3월 15일(일) 개별 공지

☎️ 모집 관련이나 TCP 관련 문의사항은 아래 연락처로 부탁드려요.

- 회장 박연오
- 부회장 김영진`,
    author: { name: "관리자" },
    publishAt: "2026-02-11T00:00:00.000Z",
    createdAt: "2026-02-11T14:40:25.251Z",
    updatedAt: "2026-09-02T06:06:12.849Z",
    views: 112,
  },
];

const demoStudies = [
  {
    id: 18,
    study_name: "👶 2026 개발자 튜토리얼",
    start_year: 2026,
    study_description: `2026학년도 신입생분들과 신입부원분들, 개발자를 이해하고 싶으신 분들, 컴퓨터 산업 전반을 이해하고 싶으신 분들을 위한 개발자 튜토리얼 스터디입니다.

1주차 03.20\tOT, 컴퓨팅과 하드웨어 이해 및 교과연계도 분석
2주차 03.26\t컴퓨터와 프로그램의 이해, VSCode
3주차 04.02\tmarkdown, notion, git github, opensource, cli gui, json
4주차 04.09\t리눅스와 OS
중간고사 전주 04.13-04.17 없음
중간고사 주간 04.20-05.01 없음
5주차 05.07\t웹서비스의 이해
6주차 05.14\t-
7주차 05.21\t가상화 (VM / Clustering, docker과 proxmox)
8주차 05.28\tAI 맛보기 및 개발자 튜토리얼 뒷풀이
기말고사 전주 06.01-06.05 없음
기말고사 기간 06.08-06.17 없음

스터디 공지: https://open.kakao.com/o/gaZ5fmmi`,
    tag: "개발자 튜토리얼,신입생,컴퓨터공학개론",
    recruit_count: 30,
    period: "2026.03 ~ 2026.05",
    apply_deadline: "2026-03-31T23:59:59+09:00",
    place: "미래관 202호",
    way: "매주 금요일 오후 6시",
    cycle: "주 1회",
    is_public: false,
    leader: { user_id: "demo-member-37", name: "이준수" },
    members: [
      { user_id: "demo-member-37", name: "이준수", role: "LEADER" },
      { user_id: "demo-member-36", name: "박연오", role: "MEMBER" },
    ],
  },
  {
    id: 19,
    study_name: "🤖 인간 시대의 끝이 도래했다",
    start_year: 2026,
    study_description: `산업구조를 바꾸고 있는 인공지능을 개발자 관점에서 이해하고 활용하는 방법, 최신 인공지능 트렌드 강의

1주차\t03.21\tOT, AI산업현황, 인공신경망 역사 및 이론
2주차\t03.28\tLarge Language Model (LLM) Part 1
3주차\t04.04\tLarge Language Model (LLM) Part 2
4주차\t04.11\tDiffusion Model
중간고사 전주 04.13-04.17 없음
중간고사 주간 04.20-05.01 없음
5주차\t05.09\t다양한 AI 모델과 AI Pipeline / Orchestration
6주차\t05.16\tMCP와 LLM Agent, Antigravity와 OpenClaw, Mirofish

스터디 공지: https://open.kakao.com/o/gu8jhmmi`,
    tag: "AI,LLM,머신러닝",
    recruit_count: 25,
    period: "2026.03 ~ 2026.05",
    apply_deadline: "2026-05-29T23:59:59+09:00",
    place: "미래관 202호",
    way: "매주 토요일 오후 2시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-member-37", name: "이준수" },
    members: [
      { user_id: "demo-member-37", name: "이준수", role: "LEADER" },
      { user_id: "demo-member-38", name: "반재민", role: "MEMBER" },
    ],
  },
  {
    id: 21,
    study_name: "2026학년도 TCP 보안 스터디",
    start_year: 2026,
    study_description: `보안 분야에 관심을 가진 학생들에게 Dreamhack을 통한 보안에 대한 기본지식과 스터디 환경 제공

https://discord.gg/U7Z9ymaMYj
저희 스터디에서 사용할 디스코드 링크입니다. 다들 참여해주세요!`,
    tag: "보안,Dreamhack,웹해킹",
    recruit_count: 20,
    period: "2026.03 ~ 2026.06",
    apply_deadline: "2026-03-31T23:59:59+09:00",
    place: "미래관 310호",
    way: "매주 화요일 오후 7시",
    cycle: "주 1회",
    is_public: true,
    leader: { user_id: "demo-member-39", name: "김영진" },
    members: [
      { user_id: "demo-member-39", name: "김영진", role: "LEADER" },
      { user_id: "demo-member-30", name: "김태형", role: "MEMBER" },
    ],
  },
  {
    id: 22,
    study_name: "2026 웹 개발 스터디",
    start_year: 2026,
    study_description: "웹 개발에 대한 전반적인 지식 습득 및 웹 프로젝트 진행",
    tag: "웹,프론트엔드,백엔드",
    recruit_count: 15,
    period: "2026.03 ~ 2026.06",
    apply_deadline: "2026-03-31T23:59:59+09:00",
    place: "미래관 312호",
    way: "매주 목요일 오후 7시",
    cycle: "주 1회",
    is_public: false,
    leader: { user_id: "demo-member-36", name: "박연오" },
    members: [{ user_id: "demo-member-36", name: "박연오", role: "LEADER" }],
  },
  {
    id: 23,
    study_name: "2026 머신러닝 스터디",
    start_year: 2026,
    study_description:
      "머신러닝에 대해 관심 있는 사람들끼리 모여 같이 머신러닝에 대해 공부하고 학습진행도 및 성과를 공유하는 스터디입니다. 학습교재는 Hands On Machine Learning (3판) 입니다. ",
    tag: "머신러닝,Python,핸즈온",
    recruit_count: 12,
    period: "2026.03 ~ 2026.06",
    apply_deadline: "2026-03-31T23:59:59+09:00",
    place: "온라인",
    way: "매주 월요일 오후 8시",
    cycle: "주 1회",
    is_public: false,
    leader: { user_id: "demo-member-38", name: "반재민" },
    members: [{ user_id: "demo-member-38", name: "반재민", role: "LEADER" }],
  },
];

const demoMembers = [
  ["추민기", "휴학", null, []],
  ["박준범", "휴학", "", []],
  ["김정완", "졸업", "게임 개발 공부중입니다!", [], null],
  ["정세영", "재학", null, []],
  [
    "김용래",
    "졸업",
    "AI 드리븐 개발중",
    ["React", "Typescript"],
    "현 와드(캐치테이블) 프론트엔드 개발자",
  ],
  [
    "고경남",
    "졸업",
    "커피챗 언제든 환영합니다~",
    ["Java", "Spring Boot"],
    "네이버 백엔드 개발자",
  ],
  [
    "김경준",
    "졸업",
    "넥슨에서 게임 기획자로 일하고 있는 김경준입니다. 게임에 관심이 있거나 도움이 필요하시면 언제든 편하게 연락 주세요!",
    ["Unity", "데이터분석"],
    "현 넥슨코리아 메이플스토리m 중국실 플레이유닛 게임기획자",
  ],
  [
    "신수민",
    "졸업",
    "같이 해킹해요",
    ["보안"],
    "현 Theori, Security Researcher",
  ],
  ["윤지수", "졸업", "", [], "Product Engineer @Cutback. ex-toss,naver,kakao"],
  [
    "함태영",
    "졸업",
    "",
    ["BE", "AI", "ML", "BigData", "Quant Trading"],
    "LG CNS 근무",
  ],
  ["관리자", "휴학", "System Administrator", ["ALL"]],
  [
    "이사빈",
    "졸업",
    "인간-AI 상호작용을 연구하는 대학원생입니다. 아직 인간과의 상호작용이 더 어려워요..😂",
    ["LLM", "HCI(Human-Computer Interaction)"],
    "현 인간중심 인공지능 연구실 석사과정 (서울과학기술대학교 인공지능응용학과)",
  ],
  [
    "조현수",
    "졸업",
    "문화 예술{🅰️} / IT /뇌과학🧬💡",
    ["Overall coding of DATA & interpretation of concept{notion}"],
    "한양대 융합전자공학과 석/박사(뇌과학 중심/휴학 상태일 수 있음)",
  ],
  [
    "설기현",
    "졸업",
    "대전의 등대도 밝습니다.",
    ["Computer Vision", "Multimodal", "AI Safety"],
    "현 KAIST EE 대학원, 석사",
  ],
  ["마정훈", "휴학", null, []],
  [
    "박동혁",
    "졸업",
    "취약점 분석과 임베디드 보안을 공부하고 있습니다",
    ["Cybersecurity"],
  ],
  [
    "서바울",
    "졸업",
    "모바일로봇 개발자",
    ["C++", "C#", "Python", "JavaScript", "React", "Docker", "ROS2"],
  ],
  ["신용준", "재학", null, []],
  ["최유찬", "재학", "", []],
  ["서준수", "재학", "안녕하세요!", []],
  [
    "위현서",
    "재학",
    "23학번 컴공 위현서입니다. C++ 위주로 공부하였고 보안에 관심있습니다",
    ["C++"],
  ],
  [
    "임동원",
    "재학",
    "보안과 개발에 관심이 있는 재학생입니다! 스터디 활발하게 참여하도록 하겠습니다!",
    [],
  ],
  ["이석환", "재학", "", [], "서울과학기술대학교"],
  ["고다연", "재학", "안녕하세요!", ["Python", "AI"]],
  ["박재우", "재학", "열심히 공부하겠습니다 ㅠㅠ", []],
  ["김현진", "재학", "", []],
  [
    "최승훈",
    "졸업",
    "데이터 불균형 문제의 해결 방법을 연구하고 있습니다.\n가볍게 인사 나눌 수 있는 기회가 있으면 좋겠습니다 :)",
    ["Python", "Medical AI", "PyTorch"],
    "Medical AI 연구실 (과기대 컴퓨터공학과)",
  ],
  [
    "안태우",
    "휴학",
    "반갑습니다. TCP 부원 안태우입니다.\n\n꿈을 펼치기 위해 동아리 및 활동 열심히 하며, 재미있게 활동해보겠습니다.",
    [
      "React",
      "JavaScript",
      "TypeScript",
      "Node.js",
      "Python",
      "MySQL",
      "Flutter",
      "Unity",
      "CSS",
      "TailwindCSS",
      "AI",
      "PyTorch",
      "Hugging Face",
      "Docker",
      "AWS",
    ],
    "공군",
  ],
  ["유지민", "재학", "안녕하세요..", [], "서울과학기술대학교"],
  [
    "김태형",
    "재학",
    "보안(특히 IR/DF)에 관심을 두고 공부하는 복학생입니다. 많이 부족하지만 같이 공부해보실 분은 같이 해봐요!",
    ["C", "C++", "Python", "volatility3", "autopsy"],
  ],
  ["강형준", "재학", "", []],
  [
    "이형진",
    "휴학",
    "",
    [
      "JavaScript",
      "React",
      "Python",
      "Java",
      "Spring",
      "AI",
      "TensorFlow",
      "PyTorch",
      "Hugging Face",
      "DevOps",
      "Kubernetes",
      "Docker",
      "AWS",
    ],
  ],
  ["김은주", "재학", null, []],
  ["윤태완", "재학", null, []],
  [
    "박연오",
    "재학",
    "TCP 회장 박연오입니다. CIS Lab에서 학부연구생으로 활동하고 있습니다.",
    [
      "React",
      "JavaScript",
      "Python",
      "C++",
      "Java",
      "Flutter",
      "TailwindCSS",
      "AI",
      "PyTorch",
    ],
    "CIS Lab",
  ],
  [
    "이준수",
    "재학",
    "안녕하세요, 하드웨어, IoT, Local LLM, 에이전트, 자동화, 서버 등에 관심이 많고 현재는 신호처리 연구하고 있습니다. 😁",
    [
      "C",
      "Python",
      "AI",
      "Docker",
      "Network",
      "IoT",
      "Linux",
      "Esp32",
      "Automation",
      "n8n",
      "LLM",
      "3Dprinting",
      "Proxmox",
      "Server",
      "Agent",
    ],
    "TCP 웹서비스 운영팀장 및 개인정보보호책임자",
  ],
  ["반재민", "재학", ":)", ["Hugging Face", "AI"], "Daint Lab"],
  [
    "김영진",
    "재학",
    "이창훈 교수님 연구실에서 학부연구생으로 활동하고 있습니다. 보안 관련해서 궁금한게 있으시면 언제든 편하게 연락주세요!",
    ["C", "AI", "Cryptography", "Digital Forensic"],
    "CIS Lab",
  ],
].map(
  (
    [name, education_status, self_description, tech_stack, current_company],
    index,
  ) => ({
    id: `demo-member-${index + 1}`,
    name,
    education_status,
    self_description,
    tech_stack,
    profile_image:
      education_status === "졸업"
        ? "/profiles/default_graduate_profile_image.webp"
        : "/profiles/default_profile_image.webp",
    github_username: null,
    portfolio_link: null,
    current_company: current_company ?? null,
  }),
);

const demoTeams = [
  {
    id: 6,
    title: "2026 NYPC Master Track",
    category: "공모전",
    status: "closed",
    periodStart: "2026-06-29",
    periodEnd: "2026-07-08",
    deadline: "2026-07-01",
    description: "2026 Nexon Young Programmers Cup Master Track",
    techStack: "C++, Python",
    tag: "",
    executionType: "online",
    selectionProc: "지원서 검토 후 안내",
    contact: "02346nn@naver.com",
    goals: "본선 진출(예선 상위 20등)",
    projectImage: "/teams/team-1782973419318-532601049.jpg",
    link: "https://new.nypc.co.kr/ko/",
    createdAt: "2026-06-28T05:05:46.007Z",
    updatedAt: "2026-09-03T15:26:21.935Z",
    leader: {
      id: "5cd6b3d6-ca63-4924-9539-293c6345be52",
      name: "박준우",
      profile_image: "default_admin_profile_image.webp",
    },
    roles: [
      {
        id: 11,
        roleName: "전략/아키텍처 리드",
        recruitCount: 1,
        currentCount: 0,
      },
      {
        id: 12,
        roleName: "실험/테스트 담당",
        recruitCount: 2,
        currentCount: 0,
      },
      {
        id: 13,
        roleName: "기록/분석/운영 담당",
        recruitCount: 1,
        currentCount: 0,
      },
    ],
  },
  {
    id: 5,
    title: "KAKAO Agentic Player 10",
    category: "공모전",
    status: "closed",
    periodStart: "2026-06-25",
    periodEnd: "2026-07-07",
    deadline: "2026-06-25",
    description:
      "카카오에서 진행하는 PlayMCP 서버 개발 공모전입니다.\n아래 링크를 참고 부탁드립니다.",
    techStack: "",
    tag: null,
    executionType: "online",
    selectionProc: "사전 협의",
    contact: "cshooon@seoultech.ac.kr",
    goals: "",
    projectImage: "/teams/team-1782386233045-762874554.jpg",
    link: "https://b.kakao.com/views/PlayMCP/AGENTIC_PlAYER_10",
    createdAt: "2026-06-25T11:17:13.187Z",
    updatedAt: "2026-06-25T11:19:20.996Z",
    leader: {
      id: "1e1822d8-0da4-4589-a863-73b0b390ca25",
      name: "최승훈",
      profile_image: "1e1822d8-0da4-4589-a863-73b0b390ca25.jpg",
    },
    roles: [{ id: 10, roleName: "개발자", recruitCount: 1, currentCount: 0 }],
  },
  {
    id: 4,
    title: "2026 Summer TCP 웹서비스 주니어팀",
    category: "프로젝트",
    status: "closed",
    periodStart: "2026-06-22",
    periodEnd: "2026-08-31",
    deadline: "2026-06-22",
    description: `2026 여름방학에 진행되는 TCP 웹서비스 주니어 팀원 모집이에요.

개발자 튜토리얼[https://teamcrazyperformance.com/study/18]을 완료하신 분들 대상이에요.`,
    techStack: "HTML, CSS, JS, React, NextJS, TypeScript, PostgreSQL, etc",
    tag: "",
    executionType: "online",
    selectionProc: "사전선발",
    contact: "junsulee119@gmail.com",
    goals: "TCP 웹서비스 결제 페이지 및 기능 개발",
    projectImage: "/teams/team-1781846023780-3093665.jpg",
    link: "https://github.com/TeamCrazyPerformance/TCP_Website_2025",
    createdAt: "2026-06-19T05:13:44.039Z",
    updatedAt: "2026-06-25T11:19:42.753Z",
    leader: {
      id: "92729ac7-428d-4f7e-9124-fd85f911637a",
      name: "이준수",
      profile_image: "92729ac7-428d-4f7e-9124-fd85f911637a.jpg",
    },
    roles: [
      {
        id: 9,
        roleName: "TCP 웹서비스 주니어 개발자",
        recruitCount: 4,
        currentCount: 0,
      },
    ],
  },
  {
    id: 3,
    title: "TCP Website 운영팀 모집",
    category: "프로젝트",
    status: "closed",
    periodStart: "2026-03-15",
    periodEnd: "2026-08-31",
    deadline: "2026-03-11",
    description: `TCP 웹서비스를 함께 체계적으로 관리하고 발전시켜 나갈 5명의 운영진을 모집합니다.

상세 안내:  하단 관련 링크 참조`,
    techStack: "",
    tag: "초보환영, 프론트엔드, 백엔드, 서버, 디자이너, 기획",
    executionType: "hybrid",
    selectionProc: "상세 안내 참조",
    contact: "junsulee119@gmail.com",
    goals: "6개월간의 협업 진행",
    projectImage: "/teams/team-1773132843950-804881416.jpg",
    link: "https://teamcrazyperformance.com/announcement/8",
    createdAt: "2026-02-17T06:52:59.884Z",
    updatedAt: "2026-06-25T11:19:44.534Z",
    leader: {
      id: "92729ac7-428d-4f7e-9124-fd85f911637a",
      name: "이준수",
      profile_image: "92729ac7-428d-4f7e-9124-fd85f911637a.jpg",
    },
    roles: [
      {
        id: 4,
        roleName: "서버 인프라 매니저 (Infrastructure Manager)",
        recruitCount: 1,
        currentCount: 0,
      },
      {
        id: 5,
        roleName: "백엔드 & DB 개발자 (Backend Developer)",
        recruitCount: 1,
        currentCount: 0,
      },
      {
        id: 6,
        roleName: "프론트엔드 개발자 (Frontend Developer)",
        recruitCount: 1,
        currentCount: 0,
      },
      {
        id: 7,
        roleName: "[신설 운영직] UI/UX 디자이너 (UI/UX Designer)",
        recruitCount: 1,
        currentCount: 0,
      },
      {
        id: 8,
        roleName:
          "[TCP 부원만 지원 가능]👩‍💼 서비스 기획 & 운영 매니저 (Service Manager & CPO)",
        recruitCount: 1,
        currentCount: 0,
      },
    ],
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
      { totalMembers: 147, awards: 30, projects: 60, employmentRate: 85 },
    ];
  }
  if (method === "GET" && pathname === "/api/v1/main/activity-images") {
    return [
      200,
      {
        competition: "/activities/competition.jpg",
        study: "/activities/study.jpg",
        mt: "/activities/mt.jpg",
        tags: {
          competition: ["TCP-EC-NL 해커톤"],
          study: ["CS 현직자 세미나", "재학생 발표", "@taewoo_an"],
          mt: ["2025 TCP MT"],
        },
      },
    ];
  }
  if (method === "GET" && pathname === "/api/v1/recruitment/status") {
    return [
      200,
      {
        is_application_enabled: true,
        start_date: "2026-09-01T00:00:00.000Z",
        end_date: "2026-09-07T23:59:59.999Z",
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
  if (method === "GET" && pathname === `${ADMIN_BASE}/reviews/rejected`) {
    const rows = articles
      .filter((article) => article.processingStatus === "QUALITY_REJECTED")
      .filter((article) => !keyword || article.title.includes(keyword))
      .map((article) => ({
        ...adminItem(article),
        reason:
          evaluationOf(article).reason || "품질 기준 미달로 종료되었습니다.",
        signals: evaluationOf(article).signals,
        queuedAt: article.updatedAt,
      }));
    return [200, paginate(rows, page, pageSize)];
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

  if (method === "POST" && pathname.endsWith("/reprocessing")) {
    const articleId = decodeURIComponent(
      pathname.slice(
        ADMIN_BASE.length + 1,
        pathname.length - "/reprocessing".length,
      ),
    );
    const article = articles.find((item) => item.articleId === articleId);
    if (!article)
      return [404, { statusCode: 404, message: "아티클을 찾을 수 없습니다." }];
    if (body?.expectedRecordVersion !== article.recordVersion)
      return [
        409,
        { statusCode: 409, code: "VERSION_CONFLICT", message: "버전 충돌" },
      ];

    const action = body?.action;
    if (
      (action === "APPROVE_QUALITY" &&
        article.processingStatus !== "QUALITY_REJECTED") ||
      (action === "RETRY" && article.processingStatus !== "PROCESSING_FAILED")
    ) {
      return [
        422,
        {
          statusCode: 422,
          code: "INVALID_ARTICLE_ACTION",
          message: "현재 처리 상태에서는 요청한 작업을 실행할 수 없습니다.",
        },
      ];
    }

    if (action === "APPROVE_QUALITY") {
      article.reviewStatus = "APPROVED";
      resolvedApprovals.add(article.articleId);
    }
    article.processingStatus = "ENRICHMENT_PENDING";
    article.updatedAt = new Date().toISOString();
    article.recordVersion += 1;
    return [
      200,
      {
        articleId,
        action,
        processingStatus: article.processingStatus,
        reviewStatus: article.reviewStatus,
        recordVersion: article.recordVersion,
        stage: "ENRICHMENT",
      },
    ];
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
