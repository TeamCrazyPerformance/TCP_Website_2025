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

    // 목록·상세 히어로·상세 본문이 한 규칙에서 같은 상한을 공유해야 한다.
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
      /\.ta-public \.detail-share-button\s*{[^}]*display:\s*none;[\s\S]*?@media \(max-width:\s*767px\)\s*{[\s\S]*?\.ta-public \.detail-share-button\s*{[^}]*display:\s*inline-flex;/s,
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

  test("소스 선택 버튼은 데스크톱에서 목록 머리글 오른쪽 끝에 붙는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 마크업은 건수 → 트리거 순이지만 화면에서는 트리거가 왼쪽이다.
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

    // 제목을 걷어낸 뒤로는 건수와 두 트리거가 같은 줄을 나눠 쓴다.
    // 건수는 왼쪽, 트리거는 오른쪽 끝.
    expect(block[1]).toMatch(
      /\.ta-public \.article-list-heading \.list-filter-row\s*{[^}]*margin-left:\s*0;[^}]*justify-content:\s*flex-start;/s,
    );
    // 두 선택 버튼은 글자 폭만 사용합니다. 초기화는 별도의 텍스트 동작이라
    // 이 외형 그룹에 들어가면 안 됩니다.
    expect(block[1]).toMatch(
      /\.ta-public \.article-list-heading \.source-trigger,\s*\.ta-public \.article-list-heading \.mobile-filter-button\s*{[^}]*flex:\s*0 0 auto;/s,
    );

    // 두 버튼의 외형은 한 규칙(.filter-trigger)에서만 정의해야 어긋나지
    // 않는다. 어느 한쪽에 외형 선언을 따로 두면 이 검사가 깨진다.
    expect(css).toMatch(
      /\.ta-public \.filter-trigger\s*{[^}]*background:\s*transparent;[^}]*font-weight:\s*600;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.article-list-heading \.mobile-filter-button\s*{[^}]*(background|border-radius|font-weight):/s,
    );

    // 보이는 크기는 헤더 로그아웃 버튼과 같게(12px / 상하 6px) 줄이되,
    // 손가락이 닿는 영역은 ::after 로 44px 를 유지한다.
    // 목록 위쪽 두 개와 페이지 아래 분야 선택이 한 규칙을 함께 쓴다.
    // 머리글로 좁히면 아래쪽 버튼만 기본 치수로 남아 커진다.
    expect(block[1]).toMatch(
      /\n  \.ta-public \.filter-trigger\s*{[^}]*padding:\s*8px 10px;[^}]*font-size:\s*12px;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.search-mobile-filter-button\s*{[^}]*font-size:/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.filter-trigger::after\s*{[^}]*inset:\s*-8px 0;/s,
    );

    // 목업이 .mobile-filter-button i 에 준 margin-right 가 gap 과 겹쳐
    // 분야 선택만 넓어졌었다. 간격은 gap 하나로만 만든다.
    expect(css).toMatch(/\.ta-public \.filter-trigger i\s*{[^}]*margin:\s*0;/s);
    // 글리프 폭 차이(fa-rss 10.5px / fa-sliders-h 12px)까지 묶어야 두
    // 버튼의 폭이 라벨 길이에만 좌우된다.
    expect(block[1]).toMatch(
      /\.ta-public \.filter-trigger i\s*{[^}]*width:\s*1em;/s,
    );

    // 버튼이 머리글로 올라가면서 비게 된 fieldset 은 숨긴다.
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

  test("좁은 화면에서 카드 태그는 한 단계 작아진다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    // 상세 화면의 .detail-tags 까지 건드리지 않도록 카드 안으로 한정한다.
    expect(block).toMatch(
      /\.ta-public \.article-card \.article-tag\s*{[^}]*font-size:\s*9px;/s,
    );
    expect(block).not.toMatch(/\.ta-public \.detail-tags \.article-tag/);
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
    // 요약과 메타는 한 인라인 흐름이어야 요약이 카드 폭을 다 쓰고 메타가
    // 마지막 줄 뒤에 붙는다. 플렉스로 나란히 두면 메타가 세로로 한 열을
    // 차지해 요약 첫 줄 오른쪽이 늘 빈다.
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-summary-row\s*{[^}]*display:\s*block;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-summary-row \.article-summary\s*{[^}]*display:\s*inline;/s,
    );
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-meta-mobile\s*{[^}]*display:\s*inline;[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/s,
    );
    // 간격은 요약 끝의 빈 칸으로 만든다. 메타의 왼쪽 여백으로 두면 메타가
    // 다음 줄로 내려갔을 때 들여쓰기가 남아 윗줄과 어긋난다.
    expect(block[1]).toMatch(
      /\.ta-public \.article-card \.article-summary-row \.article-summary::after\s*{[^}]*width:\s*8px;/s,
    );
    expect(block[1]).not.toMatch(
      /\.ta-public \.article-card \.article-meta-mobile\s*{[^}]*margin-left:/s,
    );
    // 인라인 줄바꿈이 알아서 처리하므로 폭 분기를 따로 두지 않는다.
    expect(css).not.toMatch(/@media \(max-width:\s*359px\)/);
    // 아이콘·라벨 정리와 구분자는 화면 폭과 무관하므로 최상위에 둔다.
    // 미디어 블록 안에만 있으면 데스크톱 카드에 아이콘이 되살아난다.
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-meta i\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-source-label\s*{[^}]*clip:\s*rect\(0, 0, 0, 0\);/s,
    );
    expect(css).toMatch(
      /\.ta-public \.article-card \.article-meta \.meta-divider::after\s*{[^}]*content:\s*"\|";/s,
    );
    // 구분자는 카드 배경에 묻히지 않을 만큼 밝고, 좌우로 떨어져 있어야 한다.
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
    // 세로줄 글리프 보정은 메타가 flex 인 넓은 화면에만 필요하다. 좁은
    // 화면은 인라인이라 이미 맞아 있고, 같이 내리면 과보정된다.
    expect(css).toMatch(
      /@media \(min-width:\s*768px\)\s*{\s*\.ta-public \.article-card \.article-meta \.meta-divider::after\s*{[^}]*top:\s*1\.3px;/s,
    );
  });

  test("페이지 이동과 분야 패널 여백을 목록 리듬에 맞춘다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 전체 쪽수 표시는 12px 이라 잘 보이지 않았고 대비도 기준 아래였다.
    expect(css).toMatch(
      /\.ta-public \.pagination-status\s*{[^}]*color:\s*var\(--gray-400[^}]*font-size:\s*14px;/s,
    );
    // 분야 패널과 첫 카드 사이를 카드 간격과 같은 값으로 둔다.
    expect(css).toMatch(
      /\.ta-public \.category-filter-panel\s*{[^}]*margin-bottom:\s*12px;/s,
    );

    const block = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((m) => m[1])
      .join("\n");

    // 보이는 크기는 줄이되 손가락 영역은 ::after 로 유지한다.
    expect(block).toMatch(
      /\.ta-public \.pagination-v3 \.page-button\s*{[^}]*min-height:\s*32px;/s,
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

    // 생성 파일이 현재 쪽만 남기고 모두 감춰 2쪽짜리 목록이 "1" 하나로 보였다.
    expect(flat).toMatch(
      /\.page-number-list \.page-button\[aria-current="page"\] \+ \.page-button/,
    );
    expect(flat).toMatch(
      /\.page-button:has\( ?\+ \.page-button\[aria-current="page"\]\)/,
    );
    // 끝쪽에서는 반대편으로 한 칸을 더 연다.
    expect(flat).toMatch(
      /\.page-button\[aria-current="page"\]:first-child \+ \.page-button \+ \.page-button/,
    );
    expect(flat).toMatch(
      /\+ \.page-button \+ \.page-button\[aria-current="page"\]:last-child/,
    );
  });

  test("넓은 화면에서만 건수 줄을 분야 선택 창 쪽으로 내린다", () => {
    const wide = wideBlocks();

    // 테두리 없는 글자라 baseline 을 맞추면 버튼 위쪽에 붙어 보인다.
    expect(wide).toMatch(
      /\.ta-public \.article-list-heading \.result-summary\s*{[^}]*top:\s*12px;/s,
    );
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
    // 생성 파일이 margin-top 을 0 으로 덮어 검색창과 안내가 붙어 있었다.
    expect(block).toMatch(
      /\.ta-public \.source-notice\s*{[^}]*margin-top:\s*32px;/s,
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

    // 감싸던 패널·폼을 display: contents 로 걷어내야 두 층으로 배치된다.
    expect(block).toMatch(
      /\.ta-public \.explore-heading,\s*\.ta-public #searchFieldset,\s*\.ta-public #searchForm\s*{\s*display:\s*contents;/s,
    );
    // 1층: 분야 선택(왼쪽) · 목록으로 돌아가기(오른쪽), 2층: 검색창
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

    // 제출 버튼을 숨겨도 폼의 암시적 제출 대상으로 남아 엔터로 검색된다.
    expect(block).toMatch(
      /\.ta-public \.search-submit\s*{\s*display:\s*none;/s,
    );
    // 목업이 이 버튼에만 주던 전체 폭·양끝 정렬을 되돌려야 위쪽 트리거와
    // 같은 모양이 된다.
    expect(block).toMatch(
      /\.ta-public \.search-mobile-filter-button\s*{[^}]*width:\s*auto;[^}]*justify-content:\s*normal;/s,
    );
    // 카드 위아래 여백도 한 단계 더 줄인다.
    expect(block).toMatch(
      /\.ta-public \.article-card\s*{[^}]*--article-card-edge-space:\s*12px;/s,
    );
  });

  test("검색 화면의 분야 패널은 목록 패널과 같은 배치를 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 태그 목록 왼쪽 · 버튼 오른쪽 한 줄. 생성 파일의
    // .category-filter-panel .desktop-filter 와 같은 그리드를 쓴다.
    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.desktop-filter\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s,
    );
    // 두 버튼은 양끝이 아니라 오른쪽에 나란히 붙는다.
    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.filter-apply-row\s*{[^}]*justify-content:\s*flex-end;/s,
    );
    expect(css).toMatch(
      /\.ta-public \.search-category-filter \.apply-filter-button\s*{[^}]*min-height:\s*32px;/s,
    );
    // 적용·초기화 뒤 되돌아올 자리가 고정 헤더에 가리지 않아야 한다.
    expect(css).toMatch(
      /\.ta-public \.explore-section\s*{[^}]*scroll-margin-top:\s*88px;/s,
    );
  });

  test("전체 초기화는 모바일 선택 버튼 행의 옅은 텍스트로만 표시된다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 전체 초기화는 모바일 선택 버튼 행 전용이므로 데스크톱에서는 숨깁니다.
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
    // nowrap 이라야 한 줄에 담길 때는 붙어 있고, 못 담을 때만 내려간다.
    expect(all).toMatch(
      /\.ta-public \.article-list-heading #resultCount\s*{[^}]*white-space:\s*nowrap;/s,
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
      /\.ta-public \.detail-original-link,\s*\.ta-public \.detail-share-button,\s*\.ta-public \.article-card \.share-button\s*{([^}]*)}/.exec(
        css,
      );
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/background:\s*transparent;/);
    expect(rule[1]).toMatch(/border:\s*1px solid rgba\(168, 197, 230/);
    // 강조는 hover 에서만. 기본 상태에 면이 다시 깔리면 얼룩처럼 뜬다.
    expect(css).toMatch(
      /\.ta-public \.detail-original-link:hover,\s*\.ta-public \.detail-share-button:hover,[\s\S]*?background:\s*rgba\(168, 197, 230/,
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
      "\\.detail-share-button",
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
