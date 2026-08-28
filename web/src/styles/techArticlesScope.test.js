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
      "#DF52AE",
      "#AB9DBC",
      "#E2D2F4",
      "#997EAC",
      "#AA78AB",
      "#A974C1",
      "#AC6ED3",
      "#6B8DA1",
      "#45DEC2",
      "#808B89",
      "#61C4B2",
      "#24AB92",
      "#5FB351",
      "#BD9649",
      "#D0C76E",
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
