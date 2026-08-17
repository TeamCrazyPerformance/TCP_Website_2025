/* 전역 CSS(index.css, App.css)가 Tech Articles 스코프로 새어드는지 검증합니다.
 *
 * v9 목업과 기존 사이트가 같은 클래스명을 서로 다른 의미로 쓰는 지점에서,
 * 전역 규칙이 v9 가 선언하지 않은 속성만 골라 적용되는 문제가 생깁니다.
 * 실제로 index.css 의 .article-meta { background; border } 가
 * 아티클 카드에 의도하지 않은 테두리를 그렸습니다.
 *
 * 새 누출이 잡히면 techArticlesReset.css 에 초기값 복원 규칙을 추가해 주세요. */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..");

const GLOBAL_CSS = ["index.css", "App.css"].map((f) => path.join(SRC, f));

const SCOPES = [
  {
    scope: ".ta-public",
    markup: [
      "pages/TechArticles.jsx",
      "pages/TechArticleDetail.jsx",
      "components/tech-articles/TechArticlePublicContent.jsx",
      "components/tech-articles/TechArticleCommon.jsx",
      "components/tech-articles/TechArticlePagination.jsx",
    ],
    css: [
      "styles/techArticlesReset.css",
      "styles/techArticlesPublic.css",
      "styles/techArticlesPublicAlign.css",
    ],
  },
  {
    scope: ".ta-admin",
    markup: [
      "pages/admin/AdminTechArticles.jsx",
      "pages/admin/AdminTechArticleReviews.jsx",
      "components/tech-articles/AdminTechArticleContent.jsx",
      "components/tech-articles/TechArticleCrawlPanel.jsx",
      "components/tech-articles/V9ConfirmDialog.jsx",
      "components/tech-articles/TechArticleCommon.jsx",
      "components/tech-articles/TechArticlePagination.jsx",
    ],
    css: [
      "styles/techArticlesReset.css",
      "styles/techArticlesAdmin.css",
      "styles/techArticlesAdminAlign.css",
    ],
  },
];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function eachRule(cssText, visit) {
  const css = stripComments(cssText);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const head = m[1].trim();
    if (head.startsWith("@")) continue;
    visit(head, m[2]);
  }
}

function declaredProps(body) {
  return body
    .split(";")
    .filter((d) => d.includes(":"))
    .map((d) => d.slice(0, d.indexOf(":")).trim())
    .filter(Boolean);
}

// 전역 CSS 단일 클래스 규칙 수집. 스코프 안으로 새어드는 대상.
function globalSingleClassRules(files) {
  const map = new Map();
  for (const file of files) {
    eachRule(fs.readFileSync(file, "utf8"), (head, body) => {
      for (const selector of head.split(",")) {
        const match = /^\.([A-Za-z0-9_-]+)$/.exec(selector.trim());
        if (!match) continue;
        const set = map.get(match[1]) || new Set();
        declaredProps(body).forEach((p) => set.add(p));
        map.set(match[1], set);
      }
    });
  }
  return map;
}

// className 리터럴 토큰만 수집 (템플릿 리터럴 ${...} 제외)
function usedClasses(files) {
  const used = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw =
        m[1] !== undefined ? m[1] : m[2].replace(/\$\{[^}]*\}/g, " ");
      for (const token of raw.split(/\s+/)) {
        if (/^[A-Za-z0-9_-]+$/.test(token)) used.add(token);
      }
    }
  }
  return used;
}

// 스코프 CSS 가 `<scope> .<cls>` 로 선언하는 속성 수집
function scopedProps(files, scope) {
  const map = new Map();
  for (const file of files) {
    eachRule(fs.readFileSync(path.join(SRC, file), "utf8"), (head, body) => {
      for (const selector of head.split(",")) {
        const match = new RegExp(
          `^\\${scope} \\.([A-Za-z0-9_-]+)$`,
        ).exec(selector.trim());
        if (!match) continue;
        const set = map.get(match[1]) || new Set();
        declaredProps(body).forEach((p) => set.add(p));
        map.set(match[1], set);
      }
    });
  }
  return map;
}

describe("전역 CSS의 Tech Articles 스코프 침입", () => {
  const globals = globalSingleClassRules(GLOBAL_CSS);

  test("분석 전제가 성립한다 (전역 단일 클래스 규칙이 실제로 존재)", () => {
    expect(globals.size).toBeGreaterThan(10);
    // 이 버그를 처음 일으킨 규칙. 사라지면 전제 재확인 필요.
    expect(globals.has("article-meta")).toBe(true);
  });

  test.each(SCOPES.map((s) => [s.scope, s]))(
    "%s 마크업이 쓰는 클래스에 전역 속성이 새어들지 않는다",
    (scope, config) => {
      const used = usedClasses(config.markup);
      const scoped = scopedProps(config.css, scope);

      const leaks = {};
      for (const cls of used) {
        const globalProps = globals.get(cls);
        if (!globalProps) continue;
        const covered = scoped.get(cls) || new Set();
        const leaked = [...globalProps].filter((p) => !covered.has(p)).sort();
        if (leaked.length) leaks[cls] = leaked;
      }

      // 실패 시 막아야 할 클래스·속성이 그대로 출력됨
      expect(leaks).toEqual({});
    },
  );
});
