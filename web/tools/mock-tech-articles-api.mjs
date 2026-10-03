#!/usr/bin/env node
/**
 * TCP website — mock API server for frontend work
 *
 * Purpose: exercise the React screens with dummy data, without MySQL, the Python
 * pipeline or NestJS. No dependencies (Node 18+ built-ins only). Data lives in
 * memory and resets on restart.
 *
 *   node mock-tech-articles-api.mjs            # default port 3000
 *   PORT=4000 node mock-tech-articles-api.mjs  # custom port
 *   MOCK_HOST=0.0.0.0 node mock-tech-articles-api.mjs  # opt in to external access
 *
 * Note: only the parts of the real contract the UI needs are mocked. No validation,
 * authorization or concurrency.
 */

import { createServer } from "node:http";
import { studyPeriodStatus } from "./study-period.mjs";
import { createSharedDemoData } from "./shared-demo-data.mjs";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.MOCK_HOST || "localhost";
const ARTICLE_COUNT = Number(process.env.MOCK_ARTICLE_COUNT || 130);
const PUBLIC_ARTICLE_COUNT = Math.min(
  Number(process.env.MOCK_PUBLIC_ARTICLE_COUNT || 106),
  ARTICLE_COUNT,
);
const LATEST_QUALITY = Object.freeze({ moduleVersion: "2.2.7" });
const LATEST_AI_SUMMARY = Object.freeze({
  moduleVersion: "1.0.0",
  model: "gemini-3.5-flash-lite",
  promptVersion: "dev-news-summary-v16",
});

/* ------------------------------------------------------------------ *
 * Deterministic RNG so every run produces the same dummy data
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
 * Fixed vocabulary — must match the frontend TAG_CLASS_NAMES exactly
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
    title: "[데모] 학술 연구 도구 모음",
    oneLineSummary:
      "Claude Code를 위한 학술 연구 스위트가 v3.8로 업데이트되어 인용 신뢰성 감사 및 강제 차단 게이트를 제공합니다.",
    tags: ["AI", "소프트웨어 품질", "개발자 도구"],
    sourceId: "github-trending",
    articleUrl: "https://example.invalid/articles/research-tools",
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
    title: "[데모] 자원 스케줄링 UI 프레임워크 공개",
    oneLineSummary:
      "가상의 개발팀이 자원 스케줄링 UI 프레임워크를 공개하는 예제입니다. 실제 인물의 활동을 나타내지 않습니다.",
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
    title: "[데모] 가상 모바일 기기 관리 도구",
    oneLineSummary:
      "vphone-cli 도구는 Apple Silicon 맥에서 Virtualization.framework을 활용해 가상 아이폰을 부팅하고 관리합니다.",
    tags: ["애플리케이션 개발", "개발자 도구", "모바일"],
    sourceId: "github-trending",
    articleUrl: "https://example.invalid/articles/mobile-device-tools",
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
      "가상의 개발팀이 AI 코드 생성 결과를 검증하는 과정을 설명하는 예제입니다. 실제 인물의 발언을 나타내지 않습니다.",
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
 * Dummy article generation
 * ------------------------------------------------------------------ */
// Only the state combinations the pipeline can actually produce.
// Picking the three axes independently yields unreachable combinations that read
// as UI bugs.
//
// Reachable paths (tech-article-pipeline/core/.../persistence/mysql.py)
//   first ingest                  INGESTED            / NOT_REQUIRED
//   quality PASS                  ENRICHMENT_PENDING  / NOT_REQUIRED
//   quality REVIEW_REQUIRED       QUALITY_EVALUATED   / PENDING
//   quality REJECT                QUALITY_REJECTED    / NOT_REQUIRED
//   review approved               ENRICHMENT_PENDING  / APPROVED
//   review rejected               QUALITY_REJECTED    / REJECTED
//   summarized, publish-now       ENRICHED            / NOT_REQUIRED / PUBLISHED
//   summarized, review-first      ENRICHED            / PENDING      / UNPUBLISHED
//   publication action            changes publicationStatus only
//
// Unused: IN_REVIEW, CHANGES_REQUESTED, SCHEDULED — allowed by the DB constraint
// but nothing writes them.
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
  // A failure keeps the previous state and only moves the processing stage
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
  // Round-robin so every state combination shows up at least once.
  // The first six are forced public so the public list is never empty.
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
      [
        "데모 작성자 01",
        "데모 작성자 02",
        "데모 작성자 03",
        "데모 작성자 04",
        "데모 작성자 05",
      ],
      intBetween(1, 2),
    ),
    oneLineSummary: pick(SUMMARIES),
    summaryMarkdown: markdown(originalTitle),
    // The summarizer's maximumTagCount defaults to 3 (contracts/models.py).
    // Mock data with four tags would render a screen that cannot occur.
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

articles.forEach((article, index) => {
  const summaryCurrent = index % 4 === 0;
  const qualityCurrent = index % 3 === 0;
  article.processingVersions = {
    qualityEvaluator:
      article.processingStatus === "ENRICHED"
        ? {
            moduleVersion: qualityCurrent
              ? LATEST_QUALITY.moduleVersion
              : "2.1.0",
            policyVersion: "quality-policy-v1",
            completedAt: article.normalizedAt,
          }
        : null,
    aiSummarizer:
      article.processingStatus === "ENRICHED"
        ? {
            ...LATEST_AI_SUMMARY,
            promptVersion: summaryCurrent
              ? LATEST_AI_SUMMARY.promptVersion
              : "dev-news-summary-v15",
            completedAt: article.updatedAt,
          }
        : null,
  };
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

// The real pipeline records a score only when it stores the quality result.
// INGESTED sits before automatic evaluation, so it has no score or decision.
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
    // Same shape as the real schema (Signals in modules/quality/.../models.py)
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
 * Shared helpers
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

// Source picker for the public screens. Same shape as the pipeline's
// catalog.PUBLIC_SOURCE_CATALOG.
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

// Articles an admin actually approved. The server reads quality_review_cases,
// but this mock has no such table so it tracks them here. Reading review_status
// would pick up whatever the publish toggle overwrote, so never use it.
const resolvedApprovals = new Set();

// Pin one article that was approved and then failed summarization, so the
// reprocessing case is always visible.
// On the real server RESOLVED_APPROVE in quality_review_cases fills this role.
for (const seed of articles
  .filter((a) => a.processingStatus === "PROCESSING_FAILED")
  .slice(0, 1)) {
  resolvedApprovals.add(seed.articleId);
}

const processingFailures = new Map(
  articles
    .filter((article) => article.processingStatus === "PROCESSING_FAILED")
    .map((article) => {
      const enrichmentFailed = resolvedApprovals.has(article.articleId);
      return [
        article.articleId,
        {
          stage: enrichmentFailed ? "ENRICHMENT" : "QUALITY",
          code: enrichmentFailed
            ? "MODEL_TIMEOUT"
            : "QUALITY_SERVICE_UNAVAILABLE",
          message: enrichmentFailed
            ? "AI 요약 모델의 응답 시간이 초과되었습니다."
            : "품질 평가 서비스에 연결하지 못했습니다.",
          retryable: true,
          attemptCount: 3,
          maxAttempts: 3,
          failedAt: article.updatedAt,
        },
      ];
    }),
);

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

// Review-status mismatch. Independent of the stage axis.
const APPROVED_COMPATIBLE = [
  "ENRICHMENT_PENDING",
  "ENRICHED",
  "PROCESSING_FAILED",
];
const hasStatusMismatch = (a) =>
  a.reviewStatus === "APPROVED" &&
  !APPROVED_COMPATIBLE.includes(a.processingStatus);

// Per-article view counts. Backed by article_view_counts in the pipeline MySQL.
const viewCounts = new Map();
const viewCountsOf = (id) =>
  viewCounts.get(id) || { member: 0, guest: 0, lastViewedAt: null };

const summaryVersionStatus = (article) => {
  if (article.processingStatus !== "ENRICHED" || !article.summaryMarkdown)
    return "NOT_ELIGIBLE";
  const applied = article.processingVersions?.aiSummarizer;
  if (!applied?.moduleVersion || !applied?.model || !applied?.promptVersion)
    return "UNTRACKED";
  return applied?.moduleVersion === LATEST_AI_SUMMARY.moduleVersion &&
    applied?.model === LATEST_AI_SUMMARY.model &&
    applied?.promptVersion === LATEST_AI_SUMMARY.promptVersion
    ? "CURRENT"
    : "OUTDATED";
};

const qualityVersionStatus = (article) => {
  if (article.processingStatus !== "ENRICHED" || !article.qualityDecision)
    return "NOT_ELIGIBLE";
  const applied = article.processingVersions?.qualityEvaluator;
  if (!applied?.moduleVersion) return "UNTRACKED";
  return applied?.moduleVersion === LATEST_QUALITY.moduleVersion
    ? "CURRENT"
    : "OUTDATED";
};

const canUpdateVersion = (status) =>
  status === "OUTDATED" || status === "UNTRACKED";

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
  qualityVersionStatus: qualityVersionStatus(a),
  qualityTarget: LATEST_QUALITY,
  summaryVersionStatus: summaryVersionStatus(a),
  summaryTarget: LATEST_AI_SUMMARY,
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
 * Review queue, policy and crawl state (in memory)
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
    // Same conditions as the pipeline's publication review queue
    // (_review_conditions in mysql.py)
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
 * Dummy data for the shared site screens
 * ------------------------------------------------------------------ */
const { demoAnnouncements, demoStudies, demoMembers, demoTeams } =
  createSharedDemoData();

/* Mixes short posts, a very long title and a link-only post so that line clamping
 * and long-URL overflow can both be checked on one screen. */
const demoStudyProgress = {
  1: [
    {
      id: 101,
      weekNo: 1,
      progressDate: "2026-09-09T00:00:00.000Z",
      title: "오리엔테이션과 개발 환경 맞추기",
      content: `## 이번 주에 한 일

- 스터디 목표와 진행 방식 합의
- Node 22 / pnpm 으로 개발 환경 통일
- 저장소 생성 및 브랜치 전략 정리

## 다음 주까지

각자 \`tsconfig.json\` 의 \`strict\` 옵션을 켜고 기존 코드에서 나는 오류를 정리해 옵니다.`,
      resources: [
        { id: 1001, name: "오리엔테이션 자료.pdf", format: "pdf" },
        { id: 1002, name: "환경설정 가이드.md", format: "md" },
      ],
    },
    {
      id: 102,
      weekNo: 2,
      progressDate: "2026-09-16T00:00:00.000Z",
      title:
        "타입스크립트 제네릭과 조건부 타입을 실제 컴포넌트 Props 설계에 적용해 보고 서로의 코드를 리뷰하는 시간을 가졌습니다",
      content: `## 다룬 내용

제네릭 컴포넌트를 직접 만들어 보며 \`extends\` 제약과 기본 타입 인자를 언제 쓰는지 정리했습니다.

조건부 타입은 유틸리티 타입을 직접 구현해 보는 방식으로 접근했고, 특히 \`ReturnType\` 과
\`Parameters\` 를 손으로 다시 만들어 보면서 \`infer\` 의 동작을 이해했습니다.

## 리뷰에서 나온 이야기

- Props 에 유니온을 쓸 때는 판별 속성을 두는 편이 낫다
- 제네릭을 남용하면 오히려 읽기 어려워진다는 의견이 많았습니다`,
      resources: [{ id: 1003, name: "제네릭 실습.pptx", format: "pptx" }],
    },
    {
      id: 103,
      weekNo: 3,
      progressDate: "2026-09-23T00:00:00.000Z",
      title: "상태 관리 라이브러리 비교",
      content: `## 참고 자료

정리해 둔 문서와 벤치마크 결과는 아래 링크에 있습니다.

https://example.com/tcp-study/react-state-management/benchmark-results-2026-09-23-with-a-very-long-slug-for-layout-testing

짧은 링크도 함께: [스터디 노션](https://example.com/notion)

## 결론

작은 화면에서는 Context 로 충분했고, 폼 상태가 많아지는 순간부터 전역 스토어가 필요해졌습니다.`,
      resources: [],
    },
    {
      id: 104,
      weekNo: 4,
      progressDate: "2026-09-30T00:00:00.000Z",
      title: "테스트 코드 작성 실습",
      content: `Testing Library 로 컴포넌트 테스트를 작성했습니다.

쿼리는 \`getByRole\` 을 우선 쓰고, 접근 가능한 이름이 없을 때만 다른 쿼리를 쓰기로 했습니다.`,
      resources: [{ id: 1004, name: "테스트 작성 규칙.docx", format: "docx" }],
    },
  ],
  2: [
    {
      id: 201,
      weekNo: 1,
      progressDate: "2026-09-12T00:00:00.000Z",
      title: "NestJS 모듈 구조 잡기",
      content: `## 이번 주

모듈 경계를 도메인 기준으로 나누고, 공용 코드는 \`common\` 으로 분리했습니다.

의존성 주입 범위를 정리하면서 순환 참조가 생기는 지점을 두 곳 찾아 고쳤습니다.`,
      resources: [{ id: 2001, name: "모듈 구조도.pdf", format: "pdf" }],
    },
    {
      id: 202,
      weekNo: 2,
      progressDate: "2026-09-19T00:00:00.000Z",
      title: "인증과 인가 구현",
      content: `JWT 발급과 갱신 흐름을 직접 구현했습니다.

Refresh Token 은 httpOnly 쿠키로 내려주고, Access Token 만 응답 본문에 담기로 했습니다.`,
      resources: [],
    },
  ],
};

/* ------------------------------------------------------------------ *
 * Routing
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

  /* ---------- Shared public screens ---------- */
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
      demoStudies
        .filter((study) => !year || String(study.start_year) === year)
        .map((study) => ({
          ...study,
          status: studyPeriodStatus(study.period),
          members_count: (study.members ?? []).filter((member) =>
            ["LEADER", "MEMBER", "NOMINEE"].includes(member.role),
          ).length,
        })),
    ];
  }
  if (method === "GET" && /^\/api\/v1\/study\/\d+\/progress$/.test(pathname)) {
    const id = Number(pathname.split("/").at(-2));
    return [200, demoStudyProgress[id] ?? []];
  }
  if (method === "GET" && /^\/api\/v1\/study\/\d+$/.test(pathname)) {
    const id = Number(pathname.split("/").at(-1));
    const study = demoStudies.find((item) => item.id === id);
    return study
      ? [
          200,
          {
            ...study,
            members_count: (study.members ?? []).filter((member) =>
              ["LEADER", "MEMBER", "NOMINEE"].includes(member.role),
            ).length,
          },
        ]
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

  /* ---------- Routes the home page and header call ----------
   * Mocks just enough of the contract for the home screen to look populated.
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
        competition: "/logo192.png",
        study: "/logo192.png",
        mt: "/logo192.png",
        tags: {
          competition: ["데모 해커톤"],
          study: ["데모 기술 세미나", "예제 발표"],
          mt: ["데모 교류 행사"],
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
    return [201, { message: "Mock 지원서가 접수되었습니다." }];
  }

  const page = Number(query.get("page") || 1);
  const pageSize = Number(query.get("pageSize") || 20);
  const keyword = (query.get("keyword") || "").trim();
  const matches = (a) =>
    !keyword ||
    a.title.includes(keyword) ||
    (a.oneLineSummary || "").includes(keyword);

  /* ---------- Public ---------- */
  if (method === "GET" && pathname === `${PUBLIC_BASE}/tags`) {
    return [200, { items: TAGS }];
  }

  // Sources keep growing, so they get their own route instead of riding the list.
  // Nest middleware calls this ahead of the guards. Counts members and guests apart.
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

  if (method === "GET" && pathname === `${ADMIN_BASE}/overview`) {
    const to = query.get("to") || new Date().toISOString().slice(0, 10);
    const fallbackFrom = new Date(`${to}T00:00:00+09:00`);
    fallbackFrom.setDate(fallbackFrom.getDate() - 13);
    const from = query.get("from") || fallbackFrom.toISOString().slice(0, 10);
    const days = [];
    for (
      let cursor = new Date(`${from}T00:00:00+09:00`);
      cursor <= new Date(`${to}T00:00:00+09:00`);
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(cursor);
      const onDate = (value) =>
        value &&
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(value)) === date;
      days.push({
        date,
        collectedCount: articles.filter((article) =>
          onDate(article.collectedAt),
        ).length,
        processedCount: articles.filter((article) =>
          onDate(article.processingVersions?.aiSummarizer?.completedAt),
        ).length,
      });
    }
    return [
      200,
      {
        qualityKeywords: {
          status: "AVAILABLE",
          warnings: [],
          loadedAt: "2026-09-06T00:00:00.000Z",
          fingerprint: "mock-keyword-snapshot",
          totalCount: 4,
          coreCount: 2,
          dynamicCount: 2,
          coreKeywords: ["python", "javascript"],
          dynamicKeywords: ["fastapi", "webgpu"],
          refreshPolicy: "READ_ONLY_DATABASE_CHECK",
          loadedVersion: "mock-keyword-version",
          loadedActivatedAt: "2026-09-06T00:00:00.000Z",
          storage: "MEMORY",
          activeVersion: "mock-keyword-version",
          activatedAt: "2026-09-06T00:00:00.000Z",
          storedKeywordCount: 4,
          lastUpdate: { status: "SUCCESS", completedAt: "2026-09-06T00:00:00.000Z" },
        },
        moduleVersions: {
          standards: {
            moduleVersion: "SEMVER",
            model: "PROVIDER_MODEL_ID",
            promptVersion: "EXPLICIT_IDENTIFIER",
          },
          crawlers: SOURCES.map((source) => ({
            sourceId: source.id,
            sourceName: source.name,
            moduleVersion: source.id === "sdtimes" ? "1.1.0" : "1.0.0",
          })),
          qualityEvaluator: LATEST_QUALITY,
          aiSummarizer: {
            ...LATEST_AI_SUMMARY,
          },
        },
        storage: {
          available: true,
          dataBytes: 91_226_112,
          indexBytes: 18_874_368,
          totalBytes: 110_100_480,
          measuredAt: new Date().toISOString(),
        },
        statistics: {
          timezone: "Asia/Seoul",
          from,
          to,
          definitions: {
            collectedCount: {
              label: "신규 수집·등록",
              basedOn: "crawl_items.produced_at",
              description:
                "해당 KST 일자에 크롤링 결과로 신규 등록된 고유 아티클 수",
            },
            processedCount: {
              label: "AI 요약 완료",
              basedOn: "article_processing_results.completed_at",
              description:
                "해당 KST 일자에 품질 평가를 통과하고 AI 요약 생성에 성공한 고유 아티클 수",
            },
          },
          daily: days,
        },
      },
    ];
  }

  /* ---------- 관리자: 통계 ---------- */
  if (method === "GET" && pathname === `${ADMIN_BASE}/stats`) {
    // Counted with the same filters as the list, minus stage — including it would
    // leave only the selected stage and zero out every other chip.
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
        // Longest time in each stage, keyed off updated_at as the server does.
        stageOldest: Object.fromEntries(
          STAGE_NAMES.map((stage) => {
            const rows = scope.filter((a) => articleStage(a) === stage);
            if (!rows.length) return [stage, null];
            return [stage, rows.map((a) => a.updatedAt).sort()[0]];
          }),
        ),
        statusMismatch: scope.filter(hasStatusMismatch).length,
        // The review queue is a separate table, so list filters do not apply.
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

  /* ---------- Admin: review queue ---------- */
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

  /* ---------- Admin: publication policy ---------- */
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

  /* ---------- Admin: crawling ---------- */
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
    // Only newly requested runs advance QUEUED -> RUNNING -> COMPLETED as you poll.
    // The fixed history stays put so every state remains comparable.
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

  /* ---------- Admin: publication actions ---------- */
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

  if (
    method === "POST" &&
    pathname === `${ADMIN_BASE}/summary-regenerations/bulk`
  ) {
    const items = body?.items || [];
    const results = items.map((item) => {
      const article = articles.find(
        (candidate) => candidate.articleId === item.articleId,
      );
      if (!article)
        return {
          id: item.articleId,
          status: "FAILED",
          error: { code: "NOT_FOUND", message: "아티클을 찾을 수 없습니다." },
        };
      if (item.expectedRecordVersion !== article.recordVersion)
        return {
          id: item.articleId,
          status: "FAILED",
          error: { code: "VERSION_CONFLICT", message: "버전 충돌" },
        };
      if (!canUpdateVersion(summaryVersionStatus(article)))
        return {
          id: item.articleId,
          status: "FAILED",
          error: {
            code: "INVALID_ARTICLE_ACTION",
            message: "AI 요약을 재생성할 수 있는 상태가 아닙니다.",
          },
        };
      article.processingVersions.aiSummarizer = {
        ...LATEST_AI_SUMMARY,
        completedAt: new Date().toISOString(),
      };
      article.recordVersion += 1;
      article.updatedAt = new Date().toISOString();
      return {
        id: item.articleId,
        status: "SUCCEEDED",
        data: { articleId: item.articleId, status: "QUEUED" },
      };
    });
    const succeeded = results.filter(
      (item) => item.status === "SUCCEEDED",
    ).length;
    return [
      200,
      {
        results,
        summary: {
          total: results.length,
          succeeded,
          failed: results.length - succeeded,
        },
      },
    ];
  }
  if (method === "POST" && pathname.endsWith("/summary-regeneration")) {
    const articleId = decodeURIComponent(
      pathname.slice(
        ADMIN_BASE.length + 1,
        pathname.length - "/summary-regeneration".length,
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
    if (!canUpdateVersion(summaryVersionStatus(article)))
      return [
        422,
        {
          statusCode: 422,
          code: "INVALID_ARTICLE_ACTION",
          message: "AI 요약을 재생성할 수 있는 상태가 아닙니다.",
        },
      ];
    article.processingVersions.aiSummarizer = {
      ...LATEST_AI_SUMMARY,
      completedAt: new Date().toISOString(),
    };
    article.recordVersion += 1;
    article.updatedAt = new Date().toISOString();
    return [202, { articleId, status: "QUEUED" }];
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

  /* ---------- Admin: list / detail (must stay last so it does not shadow the routes above) ---------- */
  if (method === "GET" && pathname === ADMIN_BASE) {
    const status = query.get("publicationStatus");
    const stage = query.get("stage");
    const mismatchOnly = query.get("statusMismatch") === "true";
    const qualityRecalculationFilter = query.get("qualityRecalculationStatus");
    const qualityFilter = query.get("qualityVersionStatus");
    const summaryFilter = query.get("summaryVersionStatus");
    const sort = query.get("sort") || "NEWEST";
    // Filtered in the same order as the server: filter first, then paginate.
    let rows = articles
      .filter(matches)
      .filter((a) => !status || a.publicationStatus === status)
      .filter((a) => !stage || articleStage(a) === stage)
      .filter((a) => !mismatchOnly || hasStatusMismatch(a))
      .filter(
        (a) =>
          !qualityRecalculationFilter ||
          a.qualityRecalculationStatus === qualityRecalculationFilter,
      )
      .filter(
        (a) => !qualityFilter || qualityVersionStatus(a) === qualityFilter,
      )
      .filter(
        (a) => !summaryFilter || summaryVersionStatus(a) === summaryFilter,
      );
    if (sort === "OLDEST")
      rows = [...rows].sort(
        (x, y) => new Date(x.updatedAt) - new Date(y.updatedAt),
      );
    else if (sort === "SCORE_DESC")
      rows = [...rows].sort((x, y) => y.valueScore - x.valueScore);
    else if (sort === "SCORE_ASC")
      rows = [...rows].sort((x, y) => x.valueScore - y.valueScore);
    else rows = [...rows].sort(byNewest);
    return [
      200,
      {
        ...paginate(rows.map(adminItem), page, pageSize),
        qualityTarget: LATEST_QUALITY,
        summaryTarget: LATEST_AI_SUMMARY,
      },
    ];
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
        processingFailure:
          found.processingStatus === "PROCESSING_FAILED"
            ? processingFailures.get(found.articleId) || null
            : null,
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
    // Mirrors the server: only PUBLISH promotes the review status, while
    // HIDE and ARCHIVE leave it alone (apply_publication_action in mysql.py).
    // That promotion is a known defect: drop this line when the server is fixed.
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
 * HTTP server
 * ------------------------------------------------------------------ */
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS is open so the CRA dev server can call this from another port
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

    // Incidental calls such as login and logout return a quiet 200
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
        `   ↑ 아직 Mock 응답을 만들지 않은 경로입니다. 필요한 화면만 추가해 사용하세요.`,
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
      "  TCP 프론트엔드 Mock API 서버",
      "  ─────────────────────────────────────────────",
      `  주소        http://${HOST}:${server.address().port}`,
      `  더미 아티클  ${articles.length}건 (공개 ${publicCount}건)`,
      `  공용 화면     공지 ${demoAnnouncements.length} · 스터디 ${demoStudies.length}(비공개 ${demoStudies.filter((s) => !s.is_public).length})(주차 기록 ${Object.values(demoStudyProgress).flat().length}) · 멤버 ${demoMembers.length} · 팀 ${demoTeams.length}`,
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
