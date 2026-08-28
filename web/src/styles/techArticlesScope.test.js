/* Tech Articles CSS 의 스코프 격리를 검증합니다 (관리자 + 공개).
 *
 * v9 목업 CSS 에는 html, body, a, button 같은 bare element 리셋이 들어 있어
 * 전역으로 새어나가면 Tech Articles 와 무관한 기존 페이지가 깨집니다.
 * 따라서 모든 셀렉터는 .ta-admin 또는 .ta-public 하위여야 합니다. */
const fs = require("fs");
const path = require("path");

// 화면별 스코프 번들. 관리자는 .ta-admin, 공개는 .ta-public 으로 격리된다.
const BUNDLES = [
  {
    scope: ".ta-admin",
    files: ["techArticlesAdmin.css", "techArticlesAdminAlign.css"],
    // 관리자는 폭 제한에 Tailwind .container 를 쓰므로 재정의하면 충돌한다.
    forbidsContainer: true,
  },
  {
    scope: ".ta-public",
    files: ["techArticlesPublic.css", "techArticlesPublicAlign.css"],
    // 공개 본문(page-hero, articles-section 등)은 v9 .container 를 실제로
    // 사용한다. 스코프 안이라 Tailwind 와 충돌하지 않으므로 허용한다.
    forbidsContainer: false,
  },
];
const FILES = BUNDLES.flatMap((bundle) =>
  bundle.files.map((file) => [file, bundle.scope]),
);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// CSS -> (head, body) 최상위 블록 목록
function tokenize(css) {
  const nodes = [];
  let i = 0;
  while (i < css.length) {
    let j = i;
    while (j < css.length && css[j] !== "{" && css[j] !== ";") j += 1;
    if (j >= css.length) break;
    if (css[j] === ";") {
      i = j + 1;
      continue;
    }
    const head = css.slice(i, j).trim();
    let depth = 1;
    let k = j + 1;
    while (k < css.length && depth > 0) {
      if (css[k] === "{") depth += 1;
      else if (css[k] === "}") depth -= 1;
      k += 1;
    }
    nodes.push({ head, body: css.slice(j + 1, k - 1) });
    i = k;
  }
  return nodes;
}

// @media 등 조건부 그룹은 재귀. @keyframes 내부는 건너뜀.
function collectSelectors(nodes, out = []) {
  for (const { head, body } of nodes) {
    if (head.startsWith("@")) {
      if (/^@(media|supports|layer)/i.test(head)) {
        collectSelectors(tokenize(body), out);
      }
      continue;
    }
    for (const selector of head.split(",")) {
      const trimmed = selector.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

describe("Tech Articles CSS 스코프", () => {
  const selectorsByFile = {};

  beforeAll(() => {
    for (const [file] of FILES) {
      const css = stripComments(
        fs.readFileSync(path.join(__dirname, file), "utf8"),
      );
      selectorsByFile[file] = collectSelectors(tokenize(css));
    }
  });

  test.each(FILES)("%s의 모든 셀렉터가 %s 하위로 스코프된다", (file, scope) => {
    const selectors = selectorsByFile[file];
    expect(selectors.length).toBeGreaterThan(0);

    const unscoped = selectors.filter((s) => !s.startsWith(scope));
    expect(unscoped).toEqual([]);
  });

  test.each(FILES)("%s에 전역 오염 규칙이 남아있지 않다", (file) => {
    const selectors = selectorsByFile[file];

    // bare element 리셋은 접두가 붙으면 매칭 불가. 최상위 element 셀렉터 자체가 없어야 함.
    expect(selectors.filter((s) => /^(html|body)\b/.test(s))).toEqual([]);
    expect(selectors.filter((s) => s === "*" || s === ":root")).toEqual([]);
  });

  test("관리자 번들은 Tailwind의 .container를 재정의하지 않는다", () => {
    for (const bundle of BUNDLES.filter((b) => b.forbidsContainer)) {
      const all = bundle.files.flatMap((f) => selectorsByFile[f]);
      expect(all.filter((s) => /\.container\b/.test(s))).toEqual([]);
    }
  });

  test("공개 번들의 목업 사이트 헤더·푸터 규칙이 제거되었다", () => {
    // 공용 Header/Footer 로 대체. 목업 크롬 규칙은 사문.
    const dead = [
      "site-header",
      "site-footer",
      "desktop-nav",
      "mobile-nav",
      "brand",
      "auth-links",
      "login-button",
      "footer-grid",
    ];
    const all = [
      "techArticlesPublic.css",
      "techArticlesPublicAlign.css",
    ].flatMap((f) => selectorsByFile[f]);
    const leftover = all.filter((selector) =>
      dead.some((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(selector)),
    );
    expect(leftover).toEqual([]);
  });

  test("공개 아티클 검색창은 브라우저 기본 지우기 버튼을 숨긴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public\s+\.search-input-wrap\s+input\[type="search"\]::\-webkit-search-cancel-button\s*\{[\s\S]*?display:\s*none;/,
    );
  });

  test("공개 목록 첫 화면은 헤더·소개·목록 사이의 수직 리듬을 유지한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.page-hero\s*\{[\s\S]*?padding-top:\s*112px;[\s\S]*?padding-bottom:\s*32px;/,
    );
    expect(css).toMatch(
      /\.ta-public \.articles-section\s*\{[\s\S]*?padding-top:\s*32px;/,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.ta-public \.page-hero\s*\{[\s\S]*?padding-top:\s*96px;[\s\S]*?padding-bottom:\s*24px;[\s\S]*?\.ta-public \.articles-section\s*\{[\s\S]*?padding-top:\s*24px;/,
    );
  });

  test("공개 목록·상세 태그는 단일 글자색과 5:1 이상의 대비를 사용한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const palette = [
      ...css.matchAll(/--article-tag-tone-\d+:\s*(#[\da-f]{6})/gi),
    ].map((match) => match[1].toUpperCase());
    expect(palette).toEqual([
      "#C978A9",
      "#A99FB4",
      "#D9CDE5",
      "#9B89A8",
      "#A684A7",
      "#A181AF",
      "#A17EBA",
      "#758F9F",
      "#6FB8AA",
      "#808B89",
      "#75AEA4",
      "#579C8F",
      "#7BA672",
      "#AB915D",
      "#B8B077",
    ]);

    const foregrounds = [
      ...css.matchAll(/--article-tag-foreground:\s*(#[\da-f]{6})/gi),
    ].map((match) => match[1].toUpperCase());

    expect([...new Set(foregrounds)]).toEqual(["#111827"]);

    const luminance = (hex) =>
      [1, 3, 5]
        .map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
        .map((channel) =>
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (total, channel, index) =>
            total + channel * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const foregroundLuminance = luminance(foregrounds[0]);

    for (const background of palette) {
      const backgroundLuminance = luminance(background);
      const contrast =
        (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
        (Math.min(backgroundLuminance, foregroundLuminance) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(5);
    }
    expect(css).toContain("font-weight: 600");
    expect(css).toMatch(
      /\.ta-public \.tag-button,\s*\.ta-public \.article-tag\s*{[^}]*font-size:\s*11px/s,
    );

    for (const className of [
      "tag-ai-ml",
      "tag-frontend",
      "tag-mobile",
      "tag-language-framework",
      "tag-data-db",
      "tag-cloud",
      "tag-devops",
      "tag-security",
      "tag-backend",
      "tag-architecture",
      "tag-developer-tools",
      "tag-software-quality",
      "tag-open-source",
      "tag-development-organization",
      "tag-industry-trends",
    ]) {
      expect(css).toContain(`.ta-public .${className}`);
    }
  });

  test("목록 카드의 상·하단 여백을 맞추고 요약과 태그 사이의 구분선을 없앤다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.article-card\s*{[^}]*--article-card-edge-space:\s*18px;[^}]*padding-top:\s*var\(--article-card-edge-space\);[^}]*padding-bottom:\s*var\(--article-card-edge-space\);/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card-bottom\s*{[^}]*margin-top:\s*6px;[^}]*padding-top:\s*0;[^}]*border-top:\s*0;/s,
    );
    expect(css).toMatch(
      /@media \(min-width:\s*768px\)\s*{\s*\.ta-public \.article-card-bottom\s*{[^}]*align-items:\s*flex-end;/s,
    );
  });

  test("공개 목록과 상세가 같은 읽기 폭을 쓰고 공유는 반응형 아이콘으로 표시된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 목록·상세 히어로·상세 본문이 한 규칙에서 같은 상한을 공유해야 한다.
    expect(css).toMatch(
      /\.ta-public \.articles-section > \.container,\s*\.ta-public \.detail-hero > \.container,\s*\.ta-public \.detail-content-section > \.container\s*{[^}]*max-width:\s*1120px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.share-button\s*{[^}]*width:\s*36px;[^}]*height:\s*36px;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.ta-public \.article-card \.share-button\s*{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,
    );
  });

  test("공유 버튼 호버 숨김은 hover 가능한 포인터에서만 적용된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 폭만으로 숨기면 768px 이상 터치 기기(예: iPad 세로)에서 hover 도 탭도
    // 닿지 않아 공유 버튼이 잠긴다. 게이트가 사라지지 않도록 고정한다.
    const gate =
      /@media \(min-width:\s*768px\) and \(hover:\s*hover\) and \(pointer:\s*fine\)\s*{([\s\S]*?)\n}/;
    const block = gate.exec(css);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/opacity:\s*0;[\s\S]*?pointer-events:\s*none;/);
    expect(block[1]).toMatch(
      /\.ta-public \.article-card:hover \.share-button,[\s\S]*?opacity:\s*1;[\s\S]*?pointer-events:\s*auto;/,
    );

    // 게이트 밖에서는 공유 버튼을 숨기지 않는다.
    expect(css.replace(gate, "")).not.toMatch(/pointer-events:\s*none;/);
  });

  test("상세 사이드바 폭 조정이 900px 이하 1단 배치를 건드리지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /@media \(min-width:\s*1101px\)\s*{\s*\.ta-public \.detail-layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 272px;/s,
    );
    expect(css).toMatch(
      /@media \(min-width:\s*901px\) and \(max-width:\s*1100px\)\s*{\s*\.ta-public \.detail-layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 252px;/s,
    );

    // 정렬 레이어는 생성 파일보다 뒤에 로드된다. 조건 없이 열을 지정하면
    // 생성 파일의 900px 이하 1단 규칙까지 이겨 모바일이 2단으로 깨진다.
    const unguarded = css
      .replace(/@media[^{]*{[\s\S]*?\n}/g, "")
      .match(/\.ta-public \.detail-layout\s*{[^}]*}/g);
    expect(unguarded).toBeNull();
  });

  test("가치 점수 평가축은 구분선 없이 행 간격만으로 구분된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const row = /\.ta-public \.score-breakdown > div\s*{([^}]*)}/.exec(css);
    expect(row).not.toBeNull();
    expect(row[1]).toMatch(/border:\s*0;/);
    expect(row[1]).not.toMatch(/border-bottom:/);

    // 구분선을 되살리면 마지막 행 예외 규칙이 함께 돌아온다.
    expect(css).not.toMatch(/\.ta-public \.score-breakdown > div:last-child/);

    // 선이 없어진 만큼 숫자 세로 정렬은 tabular-nums 가 대신 잡는다.
    expect(css).toMatch(
      /\.ta-public \.score-breakdown dd\s*{[^}]*font-variant-numeric:\s*tabular-nums;/s,
    );
  });

  test("소스 선택 버튼은 목록 머리글 오른쪽 끝에 붙는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.article-list-heading \.source-trigger\s*{[^}]*margin-left:\s*auto;[^}]*align-self:\s*baseline;/s,
    );
    // 한 열로 접히는 폭에서는 왼쪽 정렬로 되돌린다.
    expect(css).toMatch(
      /@media \(max-width:\s*479px\)\s*{[\s\S]*?\.ta-public \.article-list-heading \.source-trigger\s*{[^}]*margin-left:\s*0;/s,
    );
  });

  test("모바일 분야 적용 버튼은 비활성 상태를 중립색으로 구분한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.sheet-actions \.cta-button:disabled,[\s\S]*?background:\s*#374151;[\s\S]*?cursor:\s*not-allowed;[\s\S]*?opacity:\s*1;/,
    );
  });

  test("보조 동작 버튼은 남색 면 대신 같은 계열 테두리로 그린다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const rule =
      /\.ta-public \.detail-original-link,\s*\.ta-public \.article-card \.share-button\s*{([^}]*)}/.exec(
        css,
      );
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/background:\s*transparent;/);
    expect(rule[1]).toMatch(/border:\s*1px solid rgba\(168, 197, 230/);
    // 강조는 hover 에서만. 기본 상태에 면이 다시 깔리면 얼룩처럼 뜬다.
    expect(css).toMatch(
      /\.ta-public \.detail-original-link:hover,[\s\S]*?background:\s*rgba\(168, 197, 230/,
    );
  });

  test("상세 출처 정보는 보조 위계를 유지하며 충분히 밝게 표시한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.source-card \.source-details dt\s*{[^}]*color:\s*#aeb6c2;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.source-card \.source-details dd,[\s\S]*?color:\s*#d0d5de;/,
    );
  });

  test("터치 조작 영역 확대는 터치 기기에서만 적용된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 주 사용 환경이 모바일이라 44px 를 확보하되, 데스크톱 치수는 건드리지
    // 않는다. 폭이 아니라 포인터 성격으로 갈라야 큰 화면 태블릿도 포함된다.
    const gate =
      /@media \(hover:\s*none\) and \(pointer:\s*coarse\)\s*{([\s\S]*?)\n}/;
    const block = gate.exec(css);
    expect(block).not.toBeNull();

    for (const selector of [
      "\\.detail-original-link",
      "\\.filter-chip button",
      "\\.detail-breadcrumb \\.back-to-list-link",
      "\\.category-filter-panel \\.mobile-filter-button",
    ]) {
      expect(block[1]).toMatch(new RegExp(selector));
    }

    // 게이트 밖에서 같은 셀렉터를 넓히면 데스크톱 치수까지 함께 바뀐다.
    // (공유 버튼의 767px 블록은 별개 규칙이라 그대로 둔다.)
    const outside = css.replace(gate, "");
    expect(outside).not.toMatch(
      /\.ta-public \.detail-original-link\s*{[^}]*min-height/s,
    );
    expect(outside).not.toMatch(/\.ta-public \.detail-breadcrumb/);
    expect(outside).not.toMatch(
      /\.ta-public \.filter-chip\s*{[^}]*min-height/s,
    );
  });

  test("공개 번들에 마크업이 사라진 규칙이 남아있지 않다", () => {
    // 히어로 설명 문단은 hero-lead 로 합쳐졌고, 상세 히어로의 출처·게시
    // 시각 줄은 사이드바 출처 카드와 중복이라 걷어냈다. 생성 파일은 손으로
    // 고치지 않고 scope_v9.py 의 PUBLIC_DEAD 로 걸러 낸다.
    const dead = [
      "hero-description",
      "detail-info-item",
      "detail-source-item",
      "detail-info-label",
    ];
    const all = [
      "techArticlesPublic.css",
      "techArticlesPublicAlign.css",
    ].flatMap((f) => selectorsByFile[f]);
    const leftover = all.filter((selector) =>
      dead.some((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(selector)),
    );
    expect(leftover).toEqual([]);
  });

  test("관리자 번들에 마크업이 사라진 셸 전용 규칙이 남아있지 않다", () => {
    const dead = [
      "admin-shell",
      "admin-sidebar",
      "admin-topbar",
      "admin-body",
      "admin-brand",
      "admin-workspace",
      "sidebar-link",
      "sidebar-subnav",
      "sidebar-group",
      "skip-link",
      "admin-page-title",
    ];
    const all = ["techArticlesAdmin.css", "techArticlesAdminAlign.css"].flatMap(
      (f) => selectorsByFile[f],
    );
    const leftover = all.filter((selector) =>
      dead.some((cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(selector)),
    );
    expect(leftover).toEqual([]);
  });

  test.each([
    ["techArticlesAdminAlign.css", ".ta-admin"],
    ["techArticlesPublicAlign.css", ".ta-public"],
  ])("%s에 Tailwind preflight 상쇄 규칙이 있다", (file, scope) => {
    const align = selectorsByFile[file];
    // preflight 가 초기화하는 텍스트 흐름 요소는 스코프 안에서 복원
    for (const element of ["h3", "p", "ul", "ol", "hr"]) {
      expect(align).toContain(`${scope} ${element}`);
    }
  });
});
