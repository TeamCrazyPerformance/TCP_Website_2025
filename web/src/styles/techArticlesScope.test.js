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
    // 공유는 이제 넓은 화면에도 나옵니다. 좁은 화면은 치수만 줄입니다.
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

    // 카드 안 9px < 좁은 화면 상세 10px < 데스크톱 상세 11px.
    // 두 규칙 모두 자기 화면 안으로 한정해야 서로를 덮지 않는다.
    expect(block).toMatch(
      /\.ta-public \.article-card \.article-tag\s*{[^}]*font-size:\s*9px;/s,
    );
    expect(block).toMatch(
      /\.ta-public \.detail-tags \.article-tag\s*{[^}]*font-size:\s*10px;/s,
    );
    // 기본값(데스크톱)은 폭 분기 밖에 그대로 남는다.
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
    // 소스 선택 버튼과 분야 선택 창 사이의 세로 가운데에 놓이는 값이다.
    expect(wide).toMatch(
      /\.ta-public \.article-list-heading \.result-summary\s*{[^}]*top:\s*20px;/s,
    );
  });

  test("넓은 화면의 NEW 배지는 제목과 한 덩어리로 붙는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 좁은 화면은 10px 로 따로 좁히므로, 폭 분기 밖의 기본값만 확인한다.
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

    // 돌아가기 링크는 제목이 아니라 보조 조작이라 헤더(64px)와 16px만 띄운다.
    // 폭에 관계없이 같은 값이라 분기 밖에 둔다.
    expect(css).toMatch(
      /\.ta-public \.detail-main\s*{[^}]*padding-top:\s*5rem;/s,
    );
    // 넓은 화면 히어로도 함께 줄여 헤더와 36px 을 유지한다.
    expect(wideBlocks()).toMatch(
      /\.ta-public \.detail-hero\s*{[^}]*padding-top:\s*20px;/s,
    );

    // 제목과 태그·동작은 12px로 묶고, 본문 섹션 위쪽은 좌우 여백과 같은
    // 16px로 열어 카드가 세 방향에서 같은 기준을 쓴다.
    expect(narrow).toMatch(
      /\.ta-public \.detail-hero\s*{[^}]*padding-top:\s*8px;[^}]*padding-bottom:\s*9px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-content-section\s*{[^}]*padding-top:\s*16px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-row\s*{[^}]*margin-top:\s*12px;/s,
    );
    // 태그와 동작 묶음이 같은 줄에 서므로 두 축 모두 같은 값을 쓴다.
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-items\s*{[^}]*gap:\s*12px;/s,
    );

    // 상세 태그는 카드 태그(9px)와 데스크톱 상세(11px) 사이 한 단계.
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

    // 라벨이 "원문" 두 글자로 줄어 좌우 여백만 조인다. 높이는 그대로.
    expect(wide).toMatch(
      /\.ta-public \.detail-original-link\s*{[^}]*min-height:\s*34px;[^}]*padding:\s*7px 10px;/s,
    );
    const narrow = [
      ...css.matchAll(/@media \(max-width:\s*767px\)\s*{([\s\S]*?)\n}/g),
    ]
      .map((match) => match[1])
      .join("\n");

    // 좁은 화면에서는 태그 칩(10px / 22px)보다 충분히 크게 둔다.
    // 태그는 읽는 값이고 이 둘은 누르는 자리다.
    expect(narrow).toMatch(
      /\.ta-public \.detail-original-link\s*{[^}]*min-height:\s*32px;[^}]*padding:\s*6px 10px;[^}]*font-size:\s*12px;/s,
    );
    expect(narrow).toMatch(
      /\.ta-public \.detail-share-button\s*{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*padding:\s*0;/s,
    );
    // 보이는 크기가 32px 이므로 위아래로 6px 씩 넓혀 44px 를 만든다.
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

    // flex-basis: 100% 를 남기면 태그가 늘 한 줄을 통째로 차지해
    // 원문·공유가 언제나 다음 줄로 밀린다.
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*flex-basis:\s*auto;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*flex-basis:\s*100%;/s,
    );
    // 마크업이 이미 원문 · 공유 · 태그 순이라, order 를 주지 않는 것이
    // 곧 그 순서다. order: -1 이 남으면 태그가 다시 앞으로 온다.
    expect(narrow).not.toMatch(
      /\.ta-public \.detail-info-items \.detail-tags\s*{[^}]*order:/s,
    );
    // 동작 묶음은 줄어들지 않아야 버튼이 찌그러지지 않는다.
    expect(narrow).toMatch(
      /\.ta-public \.detail-info-actions\s*{[^}]*flex:\s*0 0 auto;[^}]*gap:\s*6px;/s,
    );
    // 묶음 자체는 폭 분기 밖에서 정의되어 넓은 화면에도 적용된다.
    // auto 여백이 태그(왼쪽)와 동작(오른쪽)을 갈라 놓는다.
    expect(css).toMatch(
      /\.ta-public \.detail-info-actions\s*{[^}]*margin-left:\s*auto;[^}]*gap:\s*10px;/s,
    );
    // 생성 파일이 639px 아래에서 이 줄을 세로로 세운다. 가로로 되돌리지
    // 않으면 동작 묶음이 늘 다음 줄로 내려간다.
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

    // --gray-500(#6b7280) 은 이 카드 배경에서 3.6:1 로 4.5:1 에 못 미쳤다.
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

  test("분야 선택 창은 그라디언트 위에서도 같아 보이는 짙은 남색을 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 반투명 회색이면 목록 섹션 그라디언트의 위치에 따라 밝기가 달라진다.
    // 섹션 위쪽(#0a0a0a)과 거의 같은 밝기까지 낮춰 창이 가라앉게 둔다.
    // 목록의 세 창(분야 선택·소스 선택·분야 시트)이 한 벌로 읽히도록
    // 같은 규칙에서 면과 테두리를 함께 정한다.
    expect(css).toMatch(
      /\.ta-public \.category-filter-panel,\s*\.ta-public \.source-dialog-inner,\s*\.ta-public \.filter-sheet\s*{[^}]*background:\s*#080d1a;[^}]*border:\s*1px solid #171e33;/s,
    );

    // 같은 파일 뒤쪽에서 면이나 테두리를 다시 적으면 순서만으로 이긴다.
    const dialogRule =
      /\.ta-public \.source-dialog-inner\s*{([^}]*)}/.exec(css);
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

    // 한쪽만 적으면 다시 어긋난다. 네 묶음 모두 두 선택자를 함께 적는다.
    const pairs = [
      /\.ta-public \.source-dialog-inner,\s*\.ta-public \.filter-sheet\s*{[^}]*padding:\s*0;[^}]*overflow:\s*hidden;/s,
      /\.ta-public \.source-dialog-header,\s*\.ta-public \.filter-sheet-heading\s*{[^}]*padding:\s*16px 18px 12px;[^}]*align-items:\s*center;/s,
      /\.ta-public \.source-dialog-header h2,\s*\.ta-public \.filter-sheet-heading h2\s*{[^}]*font-size:\s*16px;[^}]*font-weight:\s*700;/s,
      /\.ta-public \.sheet-actions,\s*\.ta-public \.source-dialog-actions\s*{[^}]*padding:\s*12px 18px 16px;[^}]*justify-content:\s*space-between;/s,
      /\.ta-public \.sheet-actions button,\s*\.ta-public \.source-dialog-actions button\s*{[^}]*min-height:\s*38px;[^}]*padding:\s*9px 18px;[^}]*font-size:\s*13px;/s,
    ];
    for (const pair of pairs) expect(narrow).toMatch(pair);

    // 한쪽에만 붙던 옛 값들이 남아 있으면 다시 벌어진다.
    expect(narrow).not.toMatch(
      /\.ta-public \.filter-sheet\s*{[^}]*padding:\s*20px;/s,
    );
    expect(narrow).not.toMatch(
      /\.ta-public \.filter-sheet-heading h2\s*{[^}]*font-size:\s*18px;/s,
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

    // 넓은 화면에서는 본문처럼 왼쪽, 좁은 화면에서는 버튼과 같은 가운데 축이다.
    expect(css).toMatch(
      /\.ta-public \.score-gate-description\s*{[^}]*text-align:\s*left;[^}]*word-break:\s*keep-all;/s,
    );
    expect(css).not.toMatch(/text-align:\s*justify;/);
    // span 을 늘 block 으로 두면 넓은 화면에서도 문장이 끊긴다.
    expect(css).not.toMatch(
      /^\.ta-public \.score-gate-description span\s*{[^}]*display:\s*block;/ms,
    );

    // 별도 잠금 제목·아이콘은 없고, 좁은 화면에서는 안내와 버튼을 키운다.
    // 선택자를 .score-gate-card 아래로 좁혀 둔다. 같은 특정도로 적으면
    // 이 블록이 기본 규칙보다 앞에 놓이는 순간 조용히 밀린다.
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

    // 기본 규칙보다 뒤에 놓여야 순서로도 이긴다.
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

    // 배지는 제목 첫 줄의 폭을 그대로 빼앗는다. 제목(17px)과 함께 내린다.
    expect(narrow).toMatch(
      /\.ta-public \.article-card \.article-new-badge\s*{[^}]*padding:\s*3px 6px;[^}]*font-size:\s*9px;/s,
    );
  });

  test("소스 목록에는 아이콘 없이 이름·도메인·건수만 둔다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 여섯 색 표식은 소스를 뜻하지 않으면서 옆의 분야 태그와 같은 색
    // 언어를 써서 두 축이 섞여 보였다.
    expect(css).not.toMatch(/\.source-icon/);
    expect(css).not.toMatch(/source-icon-monogram/);

    // 건수는 이 줄에서 유일하게 비교하며 읽는 값이라 도메인(11px)보다 크다.
    expect(css).toMatch(
      /\.ta-public \.source-option-count\s*{[^}]*font-size:\s*14px;/s,
    );

    // 아이콘이 빠진 뒤로 이 간격은 체크상자와 이름 사이를 뜻한다.
    expect(css).toMatch(
      /\.ta-public \.source-option\s*{[^}]*gap:\s*14px;/s,
    );
  });

  test("분야 시트는 소스 대화상자와 같은 두 동작 배치를 쓴다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 세 칸 그리드를 전제하면 버튼이 둘로 줄었을 때 자리가 어긋난다.
    expect(css).toMatch(
      /\.ta-public \.sheet-actions\s*{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s,
    );
    expect(css).not.toMatch(
      /\.ta-public \.sheet-actions\s*{[^}]*grid-template-columns:/s,
    );

    // 생성 파일의 .sheet-actions button 이 더 구체적이라 시트 안에서
    // 적용 버튼의 면을 다시 올리지 않으면 초기화와 같은 회색이 된다.
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

    // 같은 선택자 짝이 좁은 화면의 position 규칙에도 쓰이므로,
    // 면을 칠하는 규칙만 골라낸다.
    const body = [
      ...css.matchAll(
        /\.ta-public \.detail-original-link,\s*\.ta-public \.detail-share-button\s*{([^}]*)}/g,
      ),
    ]
      .map((match) => match[1])
      .find((declarations) => /background:/.test(declarations));
    expect(body).toBeDefined();
    // 순백은 거의 검은 배경 위에서 눈이 부신다. 한 단계 내려도 면 위
    // 대비가 9.7:1 이라 10px 에서도 읽힌다.
    expect(body).toMatch(/color:\s*#cfdaf0;/);
    expect(body).toMatch(/background:\s*#0f1830;/);
    // 아이콘이 링크 색을 물려받지 않으면 남색 면 위에서 파랗게 남는다.
    expect(css).toMatch(
      /\.ta-public \.detail-original-link i,\s*\.ta-public \.detail-share-button i\s*{[^}]*color:\s*inherit;/s,
    );
  });

  test("목록 카드의 공유 아이콘은 채운 면을 쓰지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    // 카드에 손을 올렸을 때만 드러나는 보조 아이콘이라, 면을 채우면
    // 카드마다 파란 점이 찍혀 제목보다 먼저 눈에 들어온다.
    // 같은 선택자에 치수 규칙이 따로 있으므로 배색 규칙만 골라낸다.
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

    // NEW 배지(#fde68a)는 색상각 48도다. 태그가 같은 구역을 쓰면 목록에서
    // 배지와 태그가 서로 신호를 다툰다. 배지 쪽이 훨씬 드문 신호라 태그를
    // 비운다. 20~80도(주황~노랑~연두 초입)를 금지 구역으로 둔다.
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
      expect({ tone, hue: Math.round(hue), 노란구역: hue >= 20 && hue <= 80 }).
        toEqual({ tone, hue: Math.round(hue), 노란구역: false });
    }
  });

  test("한 줄 요약 박스는 좌측 세로 강조선을 그리지 않는다", () => {
    const css = fs.readFileSync(
      path.join(__dirname, "techArticlesPublicAlign.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.ta-public \.detail-one-line-summary\s*{[^}]*border-left:\s*0;[^}]*border-radius:\s*9px;/s,
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

    // min-height 로 키우면 원문 URL 줄만 다른 항목의 두 배로 높아진다.
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

    // dd strong 규칙이 더 구체적이라 a strong 을 함께 적지 않으면 진다.
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

    // 페이지 이동과 목록 복귀는 터치 기기에서 44px를 확보한다. 상세의 원문·
    // 공유 버튼은 별도 모바일 규칙에서 조밀하게 보이되 가상 영역만 넓힌다.
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
    expect(block[1]).not.toMatch(/\.detail-original-link|\.detail-share-button/);

    // 게이트 밖에서 목록 복귀까지 넓히면 데스크톱 치수도 함께 바뀐다.
    // 상세 동작은 폭별 규칙과 가상 터치 영역이 따로 책임진다.
    const outside = css
      .replace(gate, "")
      .replace(/@media \(min-width:\s*768px\)\s*{[\s\S]*?\n}/g, "");
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
