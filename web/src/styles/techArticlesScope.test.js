const fs = require("fs");
const path = require("path");

const BUNDLES = [
  {
    scope: ".ta-admin",
    files: ["techArticlesAdmin.css", "techArticlesAdminAlign.css"],
    forbidsContainer: true,
  },
  {
    scope: ".ta-public",
    files: ["techArticlesPublic.css", "techArticlesPublicAlign.css"],
    forbidsContainer: false,
  },
];
const FILES = BUNDLES.flatMap((bundle) =>
  bundle.files.map((file) => [file, bundle.scope]),
);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

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

function wideBlocks() {
  const css = fs.readFileSync(
    path.join(__dirname, "techArticlesPublicAlign.css"),
    "utf8",
  );
  return [...css.matchAll(/@media \(min-width:\s*768px\)\s*{([\s\S]*?)\n}/g)]
    .map((m) => m[1])
    .join("\n");
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
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.ta-public \.page-hero\s*\{[^}]*padding-bottom:\s*16px;[^}]*\}[\s\S]*?\.ta-public \.articles-section\s*\{[^}]*padding-top:\s*16px;/,
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
      "#8BA0D6",
      "#9DC3D8",
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
      /\.ta-public \.article-card\s*{[^}]*--article-card-edge-space:\s*15px;[^}]*padding-top:\s*var\(--article-card-edge-space\);[^}]*padding-bottom:\s*var\(--article-card-edge-space\);/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card-bottom\s*{[^}]*margin-top:\s*6px;[^}]*padding-top:\s*0;[^}]*border-top:\s*0;/s,
    );
    expect(css).toMatch(
      /@media \(min-width:\s*768px\)\s*{\s*\.ta-public \.article-card-bottom\s*{[^}]*align-items:\s*flex-end;/s,
    );
  });

  test("공개 목록과 상세가 같은 읽기 폭을 쓰고 카드 공유는 모바일에서 숨긴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.articles-section > \.container,\s*\.ta-public \.detail-hero > \.container,\s*\.ta-public \.detail-content-section > \.container\s*{[^}]*max-width:\s*1120px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.share-button\s*{[^}]*width:\s*36px;[^}]*height:\s*36px;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.ta-public \.article-card \.share-button\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.detail-share-button\s*{[^}]*display:\s*inline-flex;[^}]*width:\s*34px;/s,
    );
    expect(css).not.toMatch(
      /\.ta-public \.detail-share-button\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*?\.ta-public \.detail-info-items\s*{[^}]*flex-direction:\s*row;/s,
    );
  });

  test("공유 버튼 호버 숨김은 hover 가능한 포인터에서만 적용된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const gate =
      /@media \(min-width:\s*768px\) and \(hover:\s*hover\) and \(pointer:\s*fine\)\s*{([\s\S]*?)\n}/;
    const block = gate.exec(css);
    expect(block).not.toBeNull();
    expect(block[1]).toMatch(/opacity:\s*0;[\s\S]*?pointer-events:\s*none;/);
    expect(block[1]).toMatch(
      /\.ta-public \.article-card:hover \.share-button,[\s\S]*?opacity:\s*1;[\s\S]*?pointer-events:\s*auto;/,
    );

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

    expect(css).not.toMatch(/\.ta-public \.score-breakdown > div:last-child/);

    expect(css).toMatch(
      /\.ta-public \.score-breakdown dd\s*{[^}]*font-variant-numeric:\s*tabular-nums;/s,
    );
  });

  test("소스 선택 버튼은 데스크톱에서 목록 머리글 오른쪽 끝에 붙는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.article-list-heading \.list-filter-row\s*{[^}]*order:\s*-1;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-list-heading \.result-summary\s*{[^}]*margin-left:\s*auto;/s,
    );
  });

  test("좁은 화면에서는 건수와 소스·분야 선택이 한 줄을 나눠 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const blocks = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");
    const block = [null, blocks];
    expect(blocks).not.toHaveLength(0);

    expect(block[1]).toMatch(
      /\.ta-public \.article-list-heading \.list-filter-row\s*{[^}]*margin-left:\s*0;[^}]*justify-content:\s*flex-start;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-list-heading \.source-trigger,\s*\.ta-public \.article-list-heading \.mobile-filter-button\s*{[^}]*flex:\s*0 0 auto;/s,
    );

    expect(css).toMatch(
      /\.ta-public \.filter-trigger\s*{[^}]*background:\s*transparent;[^}]*font-weight:\s*600;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.article-list-heading \.mobile-filter-button\s*{[^}]*(background|border-radius|font-weight):/s,
    );

    expect(block[1]).toMatch(
      /\n  \.ta-public \.filter-trigger\s*{[^}]*padding:\s*8px 10px;[^}]*font-size:\s*12px;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.search-mobile-filter-button\s*{[^}]*font-size:/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.filter-trigger::after\s*{[^}]*inset:\s*-8px 0;/s,
    );

    expect(css).toMatch(/\.ta-public \.filter-trigger i\s*{[^}]*margin:\s*0;/s);
    expect(block[1]).toMatch(
      /\.ta-public \.filter-trigger i\s*{[^}]*width:\s*1em;/s,
    );

    expect(block[1]).toMatch(
      /\.ta-public \.category-filter-panel\s*{\s*display:\s*none;/s,
    );
  });

  test("소스와 분야 선택 창의 닫기 동작은 같은 간결한 외형을 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.source-dialog-close,\s*\.ta-public \.sheet-close\s*{[^}]*width:\s*auto;[^}]*height:\s*auto;[^}]*padding:\s*0;[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*none;[^}]*font-size:\s*16px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.source-dialog-close::after,\s*\.ta-public \.sheet-close::after\s*{[^}]*inset:\s*-12px;/s,
    );
  });

  test("좁은 화면의 태그는 카드·상세·데스크톱이 각각 한 단계씩 다르다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(block).toMatch(
      /\.ta-public \.article-card \.article-tag\s*{[^}]*font-size:\s*9px;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.detail-tags \.article-tag\s*{[^}]*font-size:\s*10px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.tag-button,\s*\.ta-public \.article-tag\s*{[^}]*font-size:\s*11px;/s,
    );
  });

  test("좁은 화면에서 카드 공유와 장식을 덜고 출처와 날짜만 나란히 둔다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      null,
      [...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g)]
        .map((m) => m[1])
        .join("\n"),
    ];

    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.share-button\s*{[^}]*display:\s*none;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-title\s*{[^}]*font-size:\s*17px;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-new-badge\s*{[^}]*margin-right:\s*10px;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-summary-row\s*{[^}]*display:\s*block;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-summary-row \.article-summary\s*{[^}]*display:\s*block;[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*normal;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-meta-mobile\s*{[^}]*display:\s*block;[^}]*margin:\s*6px 0 0;[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.article-card \.article-meta-mobile\s*{[^}]*margin-left:/s,
    );
    expect(css).not.toMatch(/@media \(max-width:\s*359px\)/);
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-meta i\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-source-label\s*{[^}]*clip:\s*rect\(0, 0, 0, 0\);/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-meta \.meta-divider::after\s*{[^}]*content:\s*"\|";/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-meta \.meta-divider\s*{[^}]*margin:\s*0 7px;[^}]*color:\s*var\(--gray-500/s,
    );
    expect(block[1]).not.toMatch(/\.ta-public \.article-card \.article-meta i/);
  });

  test("카드 여백과 구분자 세로 정렬을 조인 값으로 고정한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(/\.ta-public \.article-list\s*{[^}]*gap:\s*12px;/s);
    expect(css).toMatch(
      /\.ta-public \.article-card\s*{[^}]*padding-inline:\s*20px;/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*767px\)\s*{\s*\.ta-public \.article-card\s*{[^}]*padding-inline:\s*16px;/s,
    );
    expect(css).toMatch(
      /@media \(min-width:\s*768px\)\s*{\s*\.ta-public \.article-card \.article-meta \.meta-divider::after\s*{[^}]*top:\s*1\.3px;/s,
    );
  });

  test("페이지 이동과 분야 패널 여백을 목록 리듬에 맞춘다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.pagination-status\s*{[^}]*color:\s*var\(--gray-400[^}]*font-size:\s*14px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.category-filter-panel\s*{[^}]*margin-bottom:\s*12px;/s,
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(block).toMatch(
      /\.ta-public \.pagination-v3 \.page-button\s*{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*min-height:\s*32px;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.pagination-v3 \.page-button::after\s*{[^}]*inset:\s*-6px 0;/s,
    );
  });

  test("좁은 화면 번호 이동은 현재 쪽 앞뒤로 세 칸을 연다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");
    const flat = block.replace(/\s+/g, " ");

    expect(flat).toMatch(
      /\.page-number-list \.page-button\[aria-current="page"\] \+ \.page-button/,
    );
    expect(flat).toMatch(
      /\.page-button:has\( ?\+ \.page-button\[aria-current="page"\]\)/,
    );
    expect(flat).toMatch(
      /\.page-button\[aria-current="page"\]:first-child \+ \.page-button \+ \.page-button/,
    );
    expect(flat).toMatch(
      /\+ \.page-button \+ \.page-button\[aria-current="page"\]:last-child/,
    );
  });

  test("넓은 화면에서만 건수 줄을 분야 선택 창 쪽으로 내린다", () => {
    const wide = wideBlocks();

    expect(wide).toMatch(
      /\.ta-public \.article-list-heading \.result-summary\s*{[^}]*top:\s*20px;/s,
    );
  });

  test("넓은 화면의 NEW 배지는 제목과 한 덩어리로 붙는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.article-new-badge\s*{[^}]*margin-right:\s*12px;/s,
    );
  });

  test("좁은 화면 상세는 헤더부터 본문까지 한 리듬으로 붙인다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(css).toMatch(
      /\.ta-public \.detail-main\s*{[^}]*padding-top:\s*5rem;/s,
    );
    expect(wideBlocks()).toMatch(
      /\.ta-public \.detail-main\s*{[^}]*padding-top:\s*64px;/s,
    );
    expect(wideBlocks()).toMatch(
      /\.ta-public \.detail-hero\s*{[^}]*padding-top:\s*16px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.detail-breadcrumb\s*{[^}]*margin-bottom:\s*16px;/s,
    );

    expect(narrow).toMatch(
      /\.ta-public \.detail-hero\s*{[^}]*padding-top:\s*8px;[^}]*padding-bottom:\s*9px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-content-section\s*{[^}]*padding-top:\s*16px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-row\s*{[^}]*margin-top:\s*12px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-items\s*{[^}]*gap:\s*12px;/s,
    );

    expect(narrow).toMatch(
      /\.ta-public \.detail-tags \.article-tag\s*{[^}]*font-size:\s*10px;/s,
    );
  });

  test("원문 버튼은 넓은 화면과 좁은 화면이 서로 다른 치수를 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const wide = wideBlocks();

    expect(wide).toMatch(
      /\.ta-public \.detail-original-link\s*{[^}]*min-height:\s*34px;[^}]*padding:\s*7px 10px;/s,
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(narrow).toMatch(
      /\.ta-public \.detail-original-link\s*{[^}]*min-height:\s*32px;[^}]*padding:\s*6px 10px;[^}]*font-size:\s*12px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-share-button\s*{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*padding:\s*0;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-original-link::after,[\s\S]*?inset:\s*-6px 0;/s,
    );
  });

  test("좁은 화면 상세는 태그와 두 동작을 한 줄에 두고 필요할 때만 접는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(narrow).toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*flex-basis:\s*auto;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*flex-basis:\s*100%;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*order:/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-actions\s*{[^}]*flex:\s*0 0 auto;[^}]*gap:\s*6px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.detail-info-actions\s*{[^}]*margin-left:\s*auto;[^}]*gap:\s*10px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-items\s*{[^}]*flex-direction:\s*row;/s,
    );
  });

  test("가치 점수 카드의 회원가입 안내를 작은 글자에 필요한 대비로 올린다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const rule = css.match(
      /\.ta-public \.member-gate-footnote\s*{([^}]*)}/,
    )?.[1];

    expect(rule).toMatch(/color:\s*var\(--gray-400, #9ca3af\);/);
    expect(rule).toMatch(/font-size:\s*12px;/);
  });

  test("좁은 화면 하단의 보조 문구 크기와 안내 간격을 맞춘다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(block).toMatch(
      /\.ta-public \.explore-heading \.back-to-list-link\s*{[^}]*font-size:\s*13px;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.pagination-status\s*{[^}]*font-size:\s*13px;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.source-notice\s*{[^}]*margin-top:\s*32px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.source-notice\s*{[^}]*display:\s*block;/s,
    );
  });

  test("좁은 화면의 검색 자리는 감싸는 상자 없이 두 층으로 놓인다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(block).toMatch(
      /\.ta-public \.explore-heading,\s*\.ta-public #searchFieldset,\s*\.ta-public #searchForm\s*{\s*display:\s*contents;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.search-category-filter\s*{[^}]*order:\s*1;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.explore-heading \.back-to-list-link\s*{[^}]*order:\s*2;[^}]*margin-left:\s*auto;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.search-row\s*{[^}]*order:\s*3;[^}]*flex-basis:\s*100%;/s,
    );
  });

  test("소스 적용 버튼은 고른 것이 그대로면 눌러도 소용없음을 알린다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.source-apply:disabled\s*{[^}]*background:\s*#374151;[^}]*cursor:\s*not-allowed;/s,
    );
  });

  test("좁은 화면의 검색 자리는 분야 버튼과 검색창만 남긴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    expect(block).toMatch(
      /\.ta-public \.search-submit\s*{\s*display:\s*none;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.search-mobile-filter-button\s*{[^}]*width:\s*auto;[^}]*justify-content:\s*normal;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.article-card\s*{[^}]*--article-card-edge-space:\s*12px;/s,
    );
  });

  test("검색 화면의 분야 패널은 목록 패널과 같은 배치를 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.desktop-filter\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.filter-apply-row\s*{[^}]*justify-content:\s*flex-end;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.apply-filter-button\s*{[^}]*min-height:\s*32px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.explore-section\s*{[^}]*scroll-margin-top:\s*88px;/s,
    );
  });

  test("전체 초기화는 모바일 선택 버튼 행의 옅은 텍스트로만 표시된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.mobile-reset-button\s*{[^}]*display:\s*none;/s,
    );

    const block = [
      null,
      [...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g)]
        .map((m) => m[1])
        .join("\n"),
    ];
    expect(block[1]).toMatch(
      /\.ta-public \.article-list-heading \.mobile-reset-button\s*{[^}]*display:\s*inline-flex;[^}]*margin-left:\s*auto;[^}]*padding:\s*4px 2px;[^}]*color:\s*var\(--gray-400[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*font-size:\s*11px;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.article-list-heading \.mobile-reset-button\s*{[^}]*text-decoration:/s,
    );
    expect(css).not.toMatch(
      /\.ta-public \.(?:source-bar|source-chip-list|source-chip|active-filters|filter-chips|filter-chip)(?![\w-])/,
    );
    expect(css).not.toMatch(/\.active-filter-summary/);
  });

  test("제목과 건수는 같은 줄에 두되 아주 좁아지면 개행한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = /@media \(max-width:\s*479px\)\s*{([\s\S]*?)\n}/g;
    const all = [...css.matchAll(block)].map((m) => m[1]).join("\n");

    expect(all).toMatch(
      /\.ta-public \.article-list-heading\s*{[^}]*flex-direction:\s*row;/s,
    );
    expect(all).toMatch(
      /\.ta-public \.article-list-heading #resultCount\s*{[^}]*white-space:\s*nowrap;/s,
    );
  });

  test("분야 선택 창은 그라디언트 위에서도 같아 보이는 짙은 남색을 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.category-filter-panel,\s*\.ta-public \.source-dialog-inner,\s*\.ta-public \.filter-sheet\s*{[^}]*background:\s*#080d1a;[^}]*border:\s*1px solid #171e33;/s,
    );

    const dialogRule = /\.ta-public \.source-dialog-inner\s*{([^}]*)}/.exec(
      css,
    );
    expect(dialogRule).not.toBeNull();
    expect(dialogRule[1]).not.toMatch(/background:/);
    expect(dialogRule[1]).not.toMatch(/border:\s/);
  });

  test("좁은 화면의 두 창은 껍데기·머리글·동작을 같은 규칙에서 받는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    const pairs = [
      /\.ta-public \.source-dialog-inner,\s*\.ta-public \.filter-sheet\s*{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s,
      /\.ta-public \.source-dialog-header,\s*\.ta-public \.filter-sheet-heading\s*{[^}]*padding:\s*16px 18px 12px;[^}]*align-items:\s*center;/s,
      /\.ta-public \.source-dialog-header h2,\s*\.ta-public \.filter-sheet-heading h2\s*{[^}]*font-size:\s*16px;[^}]*font-weight:\s*700;/s,
      /\.ta-public \.sheet-actions,\s*\.ta-public \.source-dialog-actions\s*{[^}]*padding:\s*12px 18px 16px;[^}]*justify-content:\s*space-between;/s,
      /\.ta-public \.sheet-actions button,\s*\.ta-public \.source-dialog-actions button\s*{[^}]*min-height:\s*38px;[^}]*padding:\s*9px 18px;[^}]*font-size:\s*13px;/s,
    ];
    for (const pair of pairs) expect(narrow).toMatch(pair);

    expect(narrow).not.toMatch(
      /\.ta-public \.filter-sheet\s*{[^}]*padding:\s*20px;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.filter-sheet-heading h2\s*{[^}]*font-size:\s*18px;/s,
    );
  });

  test("모바일 소스 선택 창은 화면 절반까지만 커지고 목록만 스크롤한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(narrow).toMatch(
      /\.ta-public \.source-dialog-inner\s*{[^}]*max-height:\s*50vh;[^}]*max-height:\s*50dvh;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.source-option-list\s*{[^}]*min-height:\s*0;[^}]*overscroll-behavior-y:\s*contain;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.source-option-list\s*{[^}]*overflow-y:\s*auto;/s,
    );
  });

  test("가치 점수 안내는 넓은 화면에서 한 문장, 좁은 화면에서 두 줄로 읽힌다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(css).toMatch(
      /\.ta-public \.score-gate-description\s*{[^}]*text-align:\s*left;[^}]*word-break:\s*keep-all;/s,
    );
    expect(css).not.toMatch(/text-align:\s*justify;/);
    expect(css).not.toMatch(
      /^\.ta-public \.score-gate-description span\s*{[^}]*display:\s*block;/ms,
    );

    expect(css).not.toMatch(/\.score-gate-heading|\.member-gate-icon/);
    expect(css).not.toMatch(/\.score-gate-card h3/);
    expect(css).toMatch(
      /\.ta-public \.score-gate-card\s*{[^}]*margin-top:\s*14px;[^}]*padding:\s*16px;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.score-gate-description\s*{[^}]*margin:\s*0 0 14px;[^}]*font-size:\s*14px;/s,
    );
    expect(css).not.toMatch(
      /\.score-card \.scenario-eyebrow|\.source-card \.scenario-eyebrow|\.detail-sidebar \.scenario-eyebrow/,
    );
    for (const pattern of [
      /\.ta-public \.score-gate-card \.score-gate-description\s*{[^}]*font-size:\s*15px;[^}]*text-align:\s*center;/s,
      /\.ta-public \.score-gate-card \.score-gate-description span\s*{[^}]*display:\s*block;/s,
      /\.ta-public \.score-gate-card \.member-gate-actions\s*{[^}]*justify-content:\s*center;/s,
      /\.ta-public \.score-gate-card \.member-gate-primary\s*{[^}]*width:\s*auto;[^}]*font-size:\s*14px;/s,
    ]) {
      expect(narrow).toMatch(pattern);
    }

    const baseAt = css.indexOf(".ta-public .score-gate-description {");
    const narrowAt = css.indexOf(
      ".ta-public .score-gate-card .score-gate-description {",
    );
    expect(baseAt).toBeGreaterThan(-1);
    expect(narrowAt).toBeGreaterThan(baseAt);
  });

  test("좁은 화면의 NEW 배지는 제목과 함께 한 단계 작아진다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(narrow).toMatch(
      /\.ta-public \.article-card \.article-new-badge\s*{[^}]*padding:\s*3px 6px;[^}]*font-size:\s*9px;/s,
    );
  });

  test("소스 목록에는 아이콘 없이 이름·도메인·건수만 둔다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).not.toMatch(/\.source-icon/);
    expect(css).not.toMatch(/source-icon-monogram/);

    expect(css).toMatch(
      /\.ta-public \.source-option-count\s*{[^}]*font-size:\s*14px;/s,
    );

    expect(css).toMatch(/\.ta-public \.source-option\s*{[^}]*gap:\s*14px;/s);
  });

  test("분야 시트는 소스 대화상자와 같은 두 동작 배치를 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.sheet-actions\s*{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s,
    );
    expect(css).not.toMatch(
      /\.ta-public \.sheet-actions\s*{[^}]*grid-template-columns:/s,
    );

    expect(css).toMatch(
      /\.ta-public \.sheet-actions \.source-apply\s*{[^}]*background:\s*var\(--accent-blue/s,
    );
    expect(css).toMatch(
      /\.ta-public \.sheet-actions \.source-apply:disabled,[\s\S]*?background:\s*#374151;[\s\S]*?cursor:\s*not-allowed;/,
    );
  });

  test("상세 동작 버튼은 짙은 남색 면에 눈부시지 않은 글자색을 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const body = [
      ...css.matchAll(
        /\.ta-public \.detail-original-link,\s*\.ta-public \.detail-share-button\s*{([^}]*)}/g,
      ),
    ]
      .map((match) => match[1])
      .find((declarations) => /background:/.test(declarations));
    expect(body).toBeDefined();
    expect(body).toMatch(/color:\s*#cfdaf0;/);
    expect(body).toMatch(/background:\s*#0f1830;/);
    expect(css).toMatch(
      /\.ta-public \.detail-original-link i,\s*\.ta-public \.detail-share-button i\s*{[^}]*color:\s*inherit;/s,
    );
  });

  test("목록 카드의 공유 아이콘은 채운 면을 쓰지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const body = [
      ...css.matchAll(/\.ta-public \.article-card \.share-button\s*{([^}]*)}/g),
    ]
      .map((match) => match[1])
      .find((declarations) => /background:/.test(declarations));
    expect(body).toBeDefined();
    expect(body).toMatch(/background:\s*transparent;/);
    expect(body).toMatch(/border:\s*1px solid rgba\(168, 197, 230/);
  });

  test("태그 팔레트에 NEW 배지와 겹치는 노란 계열을 두지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const tones = [
      ...css.matchAll(/--article-tag-tone-\d+:\s*(#[\da-f]{6})/gi),
    ].map((match) => match[1]);
    expect(tones).toHaveLength(15);

    for (const tone of tones) {
      const [red, green, blue] = [1, 3, 5].map(
        (index) => parseInt(tone.slice(index, index + 2), 16) / 255,
      );
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max === min) continue;
      let hue;
      if (max === red) hue = (60 * ((green - blue) / (max - min)) + 360) % 360;
      else if (max === green) hue = 60 * ((blue - red) / (max - min)) + 120;
      else hue = 60 * ((red - green) / (max - min)) + 240;
      expect({
        tone,
        hue: Math.round(hue),
        노란구역: hue >= 20 && hue <= 80,
      }).toEqual({ tone, hue: Math.round(hue), 노란구역: false });
    }
  });

  test("한 줄 요약 박스는 좌측 강조선이나 모바일 말줄임을 사용하지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.detail-one-line-summary\s*{[^}]*border-left:\s*0;[^}]*border-radius:\s*9px;/s,
    );

    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");
    expect(narrow).toMatch(
      /\.ta-public \.detail-one-line-summary\s*{[^}]*display:\s*block;[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*normal;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.detail-one-line-summary\s*{[^}]*-webkit-line-clamp:/s,
    );
  });

  test("출처 카드 링크는 줄 높이를 늘리지 않고 터치 영역만 넓힌다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );
    const touch = [
      ...css.matchAll(
        /@media \(hover: none\) and \(pointer: coarse\)\s*{([\s\S]*?)\n}/g,
      ),
    ]
      .map((match) => match[1])
      .join("\n");

    expect(touch).not.toMatch(
      /\.ta-public \.source-card \.source-details dd a\s*{[^}]*min-height:/s,
    );
    expect(touch).toMatch(
      /\.ta-public \.source-card \.source-details dd a::after\s*{[^}]*inset:\s*-8px 0;/s,
    );
  });

  test("출처 이름을 링크로 감싸도 강조색을 잃지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.source-card \.source-details dd a strong\s*{[^}]*color:\s*var\(--accent-blue\);/s,
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

  test("터치 조작 영역 확대는 조밀한 상세 동작 버튼을 제외한다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const gate =
      /@media \(hover:\s*none\) and \(pointer:\s*coarse\)\s*{([\s\S]*?)\n}/;
    const block = gate.exec(css);
    expect(block).not.toBeNull();

    for (const selector of [
      "\\.detail-breadcrumb \\.back-to-list-link",
      "\\.category-filter-panel \\.mobile-filter-button",
    ]) {
      expect(block[1]).toMatch(new RegExp(selector));
    }
    expect(block[1]).not.toMatch(
      /\.detail-original-link|\.detail-share-button/,
    );

    const outside = css
      .replace(gate, "")
      .replace(/@media \(min-width:\s*768px\)\s*{[\s\S]*?\n}/g, "");
    expect(outside).not.toMatch(/\.ta-public \.detail-breadcrumb/);
  });

  test("공개 번들에 마크업이 사라진 규칙이 남아있지 않다", () => {
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
    for (const element of ["h3", "p", "ul", "ol", "hr"]) {
      expect(align).toContain(`${scope} ${element}`);
    }
  });
});
