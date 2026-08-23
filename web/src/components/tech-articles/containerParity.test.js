/* Tech Articles 본문 정렬이 기존 페이지와 같은지 검증합니다.
 *
 * 폭을 근사값으로 재현하면 브레이크포인트 거동이 어긋나므로,
 * 기존 페이지가 쓰는 컨테이너 클래스를 그대로 사용합니다.
 * 이 테스트는 그 전제를 고정합니다.
 *   관리자: container mx-auto max-w-7xl
 *   공개  : v9 .container (Tailwind container + px-4 와 동일) */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..");

function read(relative) {
  return fs.readFileSync(path.join(SRC, relative), "utf8");
}

// container 계열 className 수집
function containerClasses(relative) {
  const matches = read(relative).match(/className="container[^"]*"/g) || [];
  return [...new Set(matches.map((m) => m.slice('className="'.length, -1)))];
}

describe("본문 컨테이너 정렬 일치", () => {
  test("관리자 TA 래퍼가 기존 관리자 페이지와 같은 컨테이너 클래스를 쓴다", () => {
    const ta = containerClasses(
      "components/tech-articles/AdminTechArticleContent.jsx",
    );
    expect(ta).toEqual(["container mx-auto max-w-7xl"]);

    // 기존 관리자 페이지의 지배적 패턴
    for (const page of [
      "pages/admin/AdminMainContent.jsx",
      "pages/admin/AdminRecruitment.jsx",
      "pages/admin/AdminAnnouncement.jsx",
      "pages/admin/AdminTeam.jsx",
    ]) {
      expect(containerClasses(page)).toContain("container mx-auto max-w-7xl");
    }
  });

  test("공개 TA의 v9 .container가 Tailwind container + px-4 와 같은 기하를 갖는다", () => {
    const css = read("styles/techArticlesPublic.css").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );

    // 가운데 정렬 + 좌우 16px (= px-4)
    const base = /\.ta-public \.container\s*\{([^}]*)\}/.exec(css);
    expect(base).not.toBeNull();
    expect(base[1]).toMatch(/margin-inline:\s*auto/);
    expect(base[1]).toMatch(/padding-inline:\s*16px/);

    // 브레이크포인트별 max-width: Tailwind 2 container 와 동일
    const expected = [
      [640, 640],
      [768, 768],
      [1024, 1024],
      [1280, 1280],
      [1536, 1536],
    ];
    for (const [breakpoint, maxWidth] of expected) {
      const pattern = new RegExp(
        `@media\\s*\\(min-width:\\s*${breakpoint}px\\)\\s*\\{[^{}]*\\.ta-public \\.container\\s*\\{[^}]*max-width:\\s*${maxWidth}px`,
      );
      expect(css).toMatch(pattern);
    }
  });

  test("공개 TA 히어로 상단 여백이 기존 공개 페이지의 pt-24와 같다", () => {
    const css = read("styles/techArticlesPublic.css");
    // .page-hero: 96px = pt-24, 64px = pb-16
    expect(css).toMatch(
      /\.ta-public \.page-hero\s*\{[^}]*padding-top:\s*96px[^}]*padding-bottom:\s*64px/,
    );

    // 전제 검증: 기존 공개 페이지의 pt-24 pb-16
    for (const page of ["pages/Announcement.jsx", "pages/Members.jsx"]) {
      expect(read(page)).toMatch(/className="pt-24 pb-16/);
    }
  });

  test("스코프 래퍼가 수평 기하에 개입하지 않는다", () => {
    // 래퍼가 width·padding·margin 을 가지면 내부 컨테이너 정렬이 어긋남
    for (const [file, scope] of [
      ["styles/techArticlesAdmin.css", ".ta-admin"],
      ["styles/techArticlesPublic.css", ".ta-public"],
      ["styles/techArticlesPublicAlign.css", ".ta-public"],
      ["styles/techArticlesAdminAlign.css", ".ta-admin"],
    ]) {
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
      const re = new RegExp(`(^|\\})\\s*\\${scope}\\s*\\{([^}]*)\\}`, "g");
      let m;
      while ((m = re.exec(css)) !== null) {
        expect(m[2]).not.toMatch(
          /(^|;)\s*(width|max-width|min-width|padding|margin|border)\s*:/,
        );
      }
    }
  });
});
