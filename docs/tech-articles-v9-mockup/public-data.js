(() => {
  "use strict";

  const tags = [
    { id: "ai-ml", label: "AI/ML" },
    { id: "frontend", label: "프론트엔드" },
    { id: "backend", label: "백엔드" },
    { id: "mobile", label: "모바일" },
    { id: "data-db", label: "데이터/DB" },
    { id: "cloud-devops", label: "클라우드/DevOps" },
    { id: "security", label: "보안" },
    { id: "open-source", label: "오픈소스" },
    { id: "language-framework", label: "언어/프레임워크" },
    { id: "architecture", label: "아키텍처" },
    { id: "blockchain-web3", label: "블록체인/Web3" },
    { id: "industry-career", label: "업계 동향/커리어" },
  ];

  const blueprints = [
    {
      title: "React 애플리케이션의 불필요한 리렌더링을 줄이는 네 가지 실전 점검법",
      oneLineSummary: "React DevTools와 컴포넌트 경계를 활용해 반복 렌더링의 원인을 찾고 적용 전에 확인할 기준을 정리합니다.",
      tags: ["frontend", "language-framework"], source: "Frontend Lab", domain: "frontend-lab.example",
      language: { code: "ko", label: "한국어" }, score: 78,
      points: ["Profiler로 실제 렌더링 비용과 호출 빈도를 먼저 분리합니다.", "상태의 소유 범위와 컴포넌트 경계를 좁혀 변경의 전파 범위를 확인합니다.", "메모이제이션 전후를 같은 사용자 시나리오로 비교해 효과를 검증합니다."],
      application: "렌더링 횟수 자체보다 사용자가 체감하는 응답성과 유지보수 비용을 함께 비교해야 합니다.",
    },
    {
      title: "RAG 품질을 높이는 검색 파이프라인 평가 지표 설계",
      oneLineSummary: "검색 정확도와 답변 충실도를 분리해 측정하고 실제 사용자 질문을 회귀 테스트로 구성하는 과정을 소개합니다.",
      tags: ["ai-ml", "data-db"], source: "ML Systems Review", domain: "ml-systems.example",
      language: { code: "en", label: "영어" }, score: 91,
      points: ["검색 단계와 생성 단계를 분리해 실패 원인을 측정합니다.", "실제 질문과 정답 근거를 고정한 회귀 데이터셋을 구성합니다.", "오프라인 점수와 사용자 피드백이 어긋나는 구간을 별도로 추적합니다."],
      application: "단일 종합 점수보다 검색 누락, 근거 불일치, 답변 오류를 각각 관찰하는 편이 개선 지점을 찾기 쉽습니다.",
    },
    {
      title: "Node.js 이벤트 루프 지연을 추적해 API 응답 병목 찾기",
      oneLineSummary: "이벤트 루프 지연과 비동기 작업 시간을 측정해 평균 응답 시간만으로 발견하기 어려운 병목을 분석합니다.",
      tags: ["backend", "language-framework"], source: "Backend Notes", domain: "backend-notes.example",
      language: { code: "en", label: "영어" }, score: 82,
      points: ["이벤트 루프 지연의 p50, p95, p99를 수집해 지속 지연과 순간 지연을 구분합니다.", "같은 구간의 CPU 프로파일과 외부 I/O 시간을 연결해 원인을 좁힙니다.", "요청 경로별 분산 추적으로 사용자가 체감한 지연과 내부 대기를 비교합니다."],
      application: "평균값만으로 결론을 내리지 말고 상위 백분위, 메모리, 외부 의존성 지표를 같은 타임라인에서 확인해야 합니다.",
    },
    {
      title: "Kubernetes 비용을 줄이기 전에 확인할 리소스 요청·제한 설정",
      oneLineSummary: "CPU와 메모리 요청값이 실제 사용량과 맞지 않을 때 발생하는 문제와 단계적인 조정 방법을 설명합니다.",
      tags: ["cloud-devops", "backend", "architecture"], source: "Cloud Operations Journal", domain: "cloud-operations.example",
      language: { code: "en", label: "영어" }, score: 86,
      points: ["워크로드별 실제 사용량 분포와 스로틀링 빈도를 함께 확인합니다.", "요청값과 제한값을 한 번에 낮추지 않고 작은 단위로 조정합니다.", "비용 절감 전후의 오류율과 재시작 횟수를 함께 비교합니다."],
      application: "평균 사용량만 따라 요청값을 낮추면 피크 시간의 안정성이 훼손될 수 있으므로 상위 백분위와 여유 용량을 남겨야 합니다.",
    },
    {
      title: "브라우저 기반 OAuth 흐름에서 PKCE와 상태값을 안전하게 검증하는 방법",
      oneLineSummary: "인증 코드 탈취와 로그인 CSRF를 방지하기 위한 PKCE, state, redirect URI 검증 순서를 살펴봅니다.",
      tags: ["security", "frontend", "backend"], source: "Secure Web Engineering", domain: "secure-web.example",
      language: { code: "en", label: "영어" }, score: 89,
      points: ["로그인 요청마다 예측할 수 없는 state와 PKCE verifier를 생성합니다.", "콜백에서 state, redirect URI, verifier를 모두 검증한 뒤 코드를 교환합니다.", "실패한 검증 값을 로그에 그대로 남기지 않고 진단 가능한 식별자만 기록합니다."],
      application: "각 검증은 서로 다른 공격을 막으므로 하나의 값이 맞았다는 이유로 나머지 검증을 생략해서는 안 됩니다.",
    },
    {
      title: "Why Structured Concurrency Changes Long-Running Backend Tasks",
      oneLineSummary: "구조적 동시성이 백그라운드 작업의 수명 주기와 취소 처리, 오류 전파를 어떻게 명확하게 만드는지 살펴봅니다.",
      tags: ["backend", "architecture", "language-framework"], source: "Systems Weekly", domain: "systems-weekly.example",
      language: { code: "en", label: "영어" }, score: 83,
      points: ["하위 작업의 수명을 부모 요청이나 작업 범위에 묶습니다.", "취소 신호와 오류 전파가 경계를 넘어 유실되지 않도록 구성합니다.", "종료되지 않은 작업을 관찰 가능한 상태로 남겨 누수를 찾습니다."],
      application: "기존 비동기 작업을 옮길 때는 타임아웃과 정리 동작이 어느 범위의 책임인지 먼저 정의해야 합니다.",
    },
    {
      title: "오프라인 우선 모바일 앱의 충돌 없는 데이터 동기화 설계",
      oneLineSummary: "불안정한 네트워크에서도 변경 사항을 보존하기 위한 로컬 큐와 충돌 해결 규칙의 구성 방법을 소개합니다.",
      tags: ["mobile", "data-db", "backend", "architecture"], source: "Mobile Craft", domain: "mobile-craft.example",
      language: { code: "ko", label: "한국어" }, score: 84,
      points: ["로컬 변경을 순서와 원인 정보가 포함된 작업으로 저장합니다.", "재전송에 안전한 식별자와 멱등성 규칙을 서버와 공유합니다.", "자동 병합이 불가능한 충돌만 사용자 판단으로 넘깁니다."],
      application: "동기화 실패를 예외가 아닌 정상 상태로 모델링하고 재시도 중에도 사용자의 최신 변경을 보존해야 합니다.",
    },
    {
      title: "수십억 행 테이블에서 PostgreSQL 인덱스를 무중단으로 교체하기",
      oneLineSummary: "대규모 운영 테이블에서 인덱스를 생성하고 검증한 뒤 기존 인덱스를 안전하게 제거하는 절차를 정리합니다.",
      tags: ["data-db", "backend", "cloud-devops"], source: "Database Field Notes", domain: "db-field-notes.example",
      language: { code: "en", label: "영어" }, score: 94,
      points: ["새 인덱스는 동시 생성 방식으로 만들고 실패 여부를 별도로 확인합니다.", "실제 쿼리 계획과 사용 빈도를 관찰한 뒤 전환 시점을 결정합니다.", "롤백 기간이 끝나기 전까지 기존 인덱스 제거를 미룹니다."],
      application: "DDL 실행 시간뿐 아니라 잠금, 디스크 여유 공간, 복제 지연을 포함한 운영 지표를 함께 감시해야 합니다.",
    },
    {
      title: "Design Tokens That Survive a Multi-Brand Frontend",
      oneLineSummary: "여러 브랜드를 하나의 제품군에서 운영할 때 의미 기반 토큰과 컴포넌트 토큰의 경계를 사례로 설명합니다.",
      tags: ["frontend", "architecture"], source: "Interface Engineering", domain: "interface-engineering.example",
      language: { code: "en", label: "영어" }, score: 77,
      points: ["원시 색상과 제품 의미를 표현하는 토큰 계층을 분리합니다.", "컴포넌트가 브랜드 이름 대신 의미 토큰에 의존하게 만듭니다.", "브랜드별 예외가 늘어나는 지점을 시각 회귀 테스트로 추적합니다."],
      application: "토큰 수를 줄이는 것보다 이름의 책임과 변경 범위를 예측 가능하게 유지하는 것이 중요합니다.",
    },
    {
      title: "모바일 앱 시작 시간을 절반으로 줄인 이미지 디코딩 최적화",
      oneLineSummary: "메인 스레드의 이미지 디코딩을 분리하고 캐시 정책을 조정해 첫 화면 표시 시간을 줄인 과정을 공유합니다.",
      tags: ["mobile", "language-framework"], source: "App Performance Log", domain: "app-performance.example",
      language: { code: "ko", label: "한국어" }, score: 80,
      points: ["첫 화면에 필요한 이미지와 이후 이미지를 로딩 단계별로 나눕니다.", "디코딩과 리사이징을 메인 스레드 밖으로 이동합니다.", "저사양 기기와 콜드 스타트 조건에서 개선 효과를 다시 측정합니다."],
      application: "캐시 적중 상황만 측정하면 실제 첫 실행 성능을 과대평가할 수 있으므로 콜드 스타트 기준을 유지해야 합니다.",
    },
    {
      title: "운영 환경에서 안전하게 Feature Flag를 제거하는 체크리스트",
      oneLineSummary: "오래된 플래그가 코드와 지표에 남기는 영향을 확인하고 점진적으로 정리하는 배포 절차를 제안합니다.",
      tags: ["backend", "cloud-devops"], source: "Reliable Delivery", domain: "reliable-delivery.example",
      language: { code: "en", label: "영어" }, score: 81,
      points: ["플래그의 실제 평가 횟수와 소유 팀을 먼저 확인합니다.", "한쪽 분기를 상수화한 뒤 관찰 기간을 두고 죽은 코드를 제거합니다.", "대시보드와 알림, 운영 문서에 남은 참조도 함께 정리합니다."],
      application: "코드 삭제와 설정 삭제를 같은 배포에서 수행하지 않으면 예상하지 못한 롤백 경로를 줄일 수 있습니다.",
    },
    {
      title: "패스키 도입 전 알아야 할 계정 복구와 기기 전환 시나리오",
      oneLineSummary: "패스키 인증에서 놓치기 쉬운 분실 기기와 신규 기기 등록, 계정 복구 흐름을 제품 관점에서 정리합니다.",
      tags: ["security", "frontend"], source: "Identity Practice", domain: "identity-practice.example",
      language: { code: "ko", label: "한국어" }, score: 80,
      points: ["기기 분실과 클라우드 동기화 실패를 별개의 복구 흐름으로 다룹니다.", "신규 기기 등록 과정에 기존 신뢰 수단의 확인 단계를 둡니다.", "복구 수단이 계정 탈취의 우회 경로가 되지 않는지 위협 모델을 검토합니다."],
      application: "인증 성공률뿐 아니라 복구 완료 시간과 고객 지원 전환율을 함께 측정해야 실제 사용성을 판단할 수 있습니다.",
    },
    {
      title: "스트리밍 데이터 파이프라인의 지연을 설명하는 세 가지 시간 개념",
      oneLineSummary: "이벤트 시간과 처리 시간, 워터마크의 차이를 이해하고 늦은 데이터를 안정적으로 집계하는 방식을 알아봅니다.",
      tags: ["data-db", "cloud-devops", "architecture"], source: "Data Platform Notes", domain: "data-platform.example",
      language: { code: "ko", label: "한국어" }, score: 76,
      points: ["이벤트가 발생한 시각과 시스템이 처리한 시각을 분리합니다.", "허용할 지연 범위를 워터마크 정책으로 명시합니다.", "늦게 도착한 데이터의 수정과 재집계 비용을 함께 설계합니다."],
      application: "지연 허용 범위를 무작정 늘리면 정확도는 높아져도 결과 제공 시간이 늦어지므로 제품 요구와 균형을 맞춰야 합니다.",
    },
    {
      title: "CSS Container Queries로 재사용 가능한 대시보드 위젯 만들기",
      oneLineSummary: "뷰포트 대신 컨테이너 크기에 반응하는 위젯을 구성해 다양한 화면 영역에서 재사용하는 방법을 다룹니다.",
      tags: ["frontend", "language-framework"], source: "Modern CSS Korea", domain: "modern-css.example",
      language: { code: "ko", label: "한국어" }, score: 73,
      points: ["위젯이 배치되는 컨테이너에 크기 관찰 기준을 선언합니다.", "콘텐츠가 무너지는 지점을 기준으로 스타일을 전환합니다.", "컨테이너 쿼리를 지원하지 않는 환경의 기본 레이아웃을 유지합니다."],
      application: "컴포넌트의 내부 반응형 규칙과 페이지 전체의 레이아웃 규칙을 분리하면 재사용성이 높아집니다.",
    },
    {
      title: "LLM 에이전트의 도구 호출 실패를 재현 가능한 테스트로 바꾸기",
      oneLineSummary: "도구 입력과 응답을 기록하고 실패 조건을 고정해 에이전트 동작을 반복해서 검증하는 테스트 전략을 소개합니다.",
      tags: ["ai-ml", "backend"], source: "Agent Engineering", domain: "agent-engineering.example",
      language: { code: "en", label: "영어" }, score: 88,
      points: ["모델 입력, 도구 인수, 도구 응답을 하나의 실행 기록으로 묶습니다.", "외부 상태를 고정한 재생 환경에서 같은 실패를 반복합니다.", "성공 여부뿐 아니라 불필요한 재시도와 잘못된 도구 선택도 평가합니다."],
      application: "민감한 도구 입력은 기록 전에 제거하거나 치환하고, 테스트 데이터가 운영 자격 증명을 포함하지 않게 해야 합니다.",
    },
    {
      title: "분산 추적 데이터에서 실제 사용자 지연을 분리해 내는 방법",
      oneLineSummary: "서비스 내부 처리 시간과 네트워크 지연을 구분해 사용자가 경험한 병목 구간을 찾는 방법을 설명합니다.",
      tags: ["backend", "cloud-devops", "architecture"], source: "Observability Field Guide", domain: "observability-guide.example",
      language: { code: "en", label: "영어" }, score: 87,
      points: ["클라이언트와 엣지, 서버 구간의 타임스탬프를 같은 기준으로 맞춥니다.", "샘플링에서 사라지기 쉬운 느린 요청을 별도 규칙으로 보존합니다.", "서버 처리와 네트워크 왕복 시간을 나눠 병목 소유 영역을 찾습니다."],
      application: "추적 데이터의 시계 오차와 누락을 고려하지 않으면 구간별 시간을 잘못 해석할 수 있습니다.",
    },
    {
      title: "데이터 웨어하우스 비용을 예측 가능한 수준으로 유지하는 파티션 전략",
      oneLineSummary: "쿼리 패턴에 맞는 파티션과 보존 기간을 설계해 스캔 비용과 운영 변동성을 낮추는 방식을 정리합니다.",
      tags: ["data-db", "architecture"], source: "Analytics Architecture", domain: "analytics-architecture.example",
      language: { code: "en", label: "영어" }, score: 83,
      points: ["자주 사용하는 날짜와 조직 경계를 실제 쿼리 패턴에서 찾습니다.", "파티션 제거가 제대로 적용되는지 실행 계획과 비용으로 확인합니다.", "보존 기간과 장기 보관 계층을 데이터 등급별로 나눕니다."],
      application: "파티션 수가 지나치게 많아지면 메타데이터 비용이 늘 수 있으므로 데이터 크기와 쿼리 빈도를 함께 고려해야 합니다.",
    },
    {
      title: "Android Compose 화면의 상태 복원 테스트를 자동화하기",
      oneLineSummary: "프로세스 재생성과 화면 회전 이후에도 UI 상태가 올바르게 복원되는지 자동으로 검증하는 방법을 다룹니다.",
      tags: ["mobile", "language-framework"], source: "Compose Engineering", domain: "compose-engineering.example",
      language: { code: "en", label: "영어" }, score: 79,
      points: ["복원되어야 할 사용자 상태와 다시 계산할 상태를 구분합니다.", "프로세스 종료와 구성 변경을 테스트에서 의도적으로 재현합니다.", "화면 결과뿐 아니라 저장된 키와 상태 크기도 검증합니다."],
      application: "테스트가 단순 화면 회전만 다루면 실제 프로세스 재생성에서 발생하는 오류를 놓칠 수 있습니다.",
    },
    {
      title: "의존성 공급망 공격에 대비한 패키지 검증 자동화",
      oneLineSummary: "잠금 파일과 서명, 출처 정책을 조합해 승인되지 않은 패키지가 배포 과정에 들어오는 것을 차단합니다.",
      tags: ["security", "open-source", "cloud-devops"], source: "Software Supply Chain", domain: "software-supply-chain.example",
      language: { code: "ko", label: "한국어" }, score: 85,
      points: ["잠금 파일 변경과 새 패키지 출처를 코드 검토에서 분리해 확인합니다.", "서명과 체크섬 검증을 CI 과정의 필수 단계로 둡니다.", "허용되지 않은 레지스트리와 설치 스크립트를 정책으로 차단합니다."],
      application: "검증 실패를 단순 경고로 남기지 말고 예외 승인 절차와 담당자를 명확히 해야 통제가 유지됩니다.",
    },
    {
      title: "기술 부채를 배포 위험과 연결해 우선순위를 정하는 방법",
      oneLineSummary: "기술 부채 항목을 변경 빈도와 장애 영향도에 연결해 팀이 합의할 수 있는 개선 순서를 만드는 법을 소개합니다.",
      tags: ["industry-career", "architecture"], source: "Engineering Management Notes", domain: "engineering-management.example",
      language: { code: "ko", label: "한국어" }, score: 75,
      points: ["부채가 있는 코드의 변경 빈도와 장애 영향도를 함께 기록합니다.", "개선 비용보다 배포 위험 감소량이 큰 항목을 먼저 찾습니다.", "완료 여부를 추상적인 정리 대신 운영 지표 변화로 확인합니다."],
      application: "모든 부채를 같은 기준으로 점수화하기보다 제품 목표와 가까운 위험부터 합의하는 것이 실행 가능성을 높입니다.",
    },
    {
      title: "스마트 계약 업그레이드에서 저장소 충돌을 피하는 설계 원칙",
      oneLineSummary: "프록시 기반 스마트 계약을 업그레이드할 때 저장소 레이아웃과 권한 검증을 안전하게 유지하는 방법을 설명합니다.",
      tags: ["blockchain-web3", "security", "architecture"], source: "Web3 Engineering Review", domain: "web3-engineering.example",
      language: { code: "en", label: "영어" }, score: 81,
      points: ["업그레이드 전후의 저장소 레이아웃 호환성을 자동으로 검사합니다.", "관리 권한과 지연 실행 조건을 별도 계약으로 검증합니다.", "테스트넷에서 상태 마이그레이션과 롤백 절차를 반복합니다."],
      application: "코드 변경만 검토하지 말고 기존 온체인 상태와 권한 모델이 새 구현에서도 보존되는지 확인해야 합니다.",
    },
  ];

  const titleVariants = ["", " — 운영 사례", " — 성능 분석", " — 설계 노트", " — 현장 적용"];
  const tagLabels = new Map(tags.map((tag) => [tag.id, tag.label]));

  function makeDetailedSummary(blueprint) {
    const numberedPoints = blueprint.points
      .map((point, index) => `${index + 1}. ${point}`)
      .join("\n");
    const fields = blueprint.tags.length
      ? blueprint.tags.map((tagId) => tagLabels.get(tagId)).join(", ")
      : "기술 조직 운영";

    return `## 핵심 내용\n\n${numberedPoints}\n\n## 실무 적용\n\n${blueprint.application}\n\n## 읽을 때 참고할 점\n\n이 요약은 **${fields}** 관점에서 원문의 주요 논지를 압축한 내용입니다. 세부 구현 조건과 전체 맥락은 원문에서 확인할 수 있습니다.`;
  }

  const articles = Array.from({ length: 86 }, (_, index) => {
    const blueprint = blueprints[index % blueprints.length];
    const cycle = Math.floor(index / blueprints.length);
    const articleTags = new Set(blueprint.tags);
    if (index % 3 === 0) articleTags.add("frontend");
    if (index % 4 === 0) articleTags.add("data-db");
    if (index % 5 === 0) articleTags.add("backend");

    const publishedAt = new Date(Date.UTC(2026, 6, 27, 0, 0) - index * 5 * 60 * 60 * 1000);
    const collectedAt = new Date(publishedAt.getTime() + 70 * 60 * 1000);
    const id = `article-${String(index + 1).padStart(3, "0")}`;
    const score = Math.min(98, blueprint.score + (cycle % 5) - 2);

    return {
      id,
      title: `${blueprint.title}${titleVariants[cycle] ?? ` — 사례 ${cycle + 1}`}`,
      oneLineSummary: blueprint.oneLineSummary,
      summary: blueprint.oneLineSummary,
      summaryMarkdown: makeDetailedSummary(blueprint),
      tags: [...articleTags].slice(0, 4),
      source: blueprint.source,
      sourceId: `source-${blueprint.domain.split(".")[0]}`,
      sourceDomain: blueprint.domain,
      sourceType: "WEB_CRAWL",
      originalLanguage: { ...blueprint.language },
      publishedAt: publishedAt.toISOString(),
      collectedAt: collectedAt.toISOString(),
      originalUrl: `https://${blueprint.domain}/articles/${id}`,
      score,
      scoreBreakdown: {
        relevance: Math.min(100, score + 3),
        depth: Math.max(0, score - 2),
        freshness: Math.min(100, score + 8),
        sourceTrust: Math.max(0, score - 7),
      },
    };
  });

  const articleMap = new Map(articles.map((article) => [article.id, article]));
  window.TCPTechArticlesData = Object.freeze({
    tags,
    articles,
    lastOriginalCollectedAt: "2026-07-27T10:10:00+09:00",
    getArticleById(articleId) {
      return articleMap.get(articleId) || null;
    },
  });
})();
