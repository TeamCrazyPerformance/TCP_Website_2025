
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
      "pages/admin/AdminCrawlOperations.jsx",
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

function usedClasses(files) {
  const used = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), "utf8");
    const re = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1] !== undefined ? m[1] : m[2].replace(/\$\{[^}]*\}/g, " ");
      for (const token of raw.split(/\s+/)) {
        if (/^[A-Za-z0-9_-]+$/.test(token)) used.add(token);
      }
    }
  }
  return used;
}

function scopedProps(files, scope) {
  const map = new Map();
  for (const file of files) {
    eachRule(fs.readFileSync(path.join(SRC, file), "utf8"), (head, body) => {
      for (const selector of head.split(",")) {
        const match = new RegExp(`^\\${scope} \\.([A-Za-z0-9_-]+)$`).exec(
          selector.trim(),
        );
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

      expect(leaks).toEqual({});
    },
  );
});
