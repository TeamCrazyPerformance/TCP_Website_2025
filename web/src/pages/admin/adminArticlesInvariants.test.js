
const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(
  path.join(__dirname, "AdminTechArticles.jsx"),
  "utf8",
);

describe("공개 토글 가드", () => {
  test("공개 토글 구현이 PublishControl 하나뿐이다", () => {
    const checkboxes = SOURCE.match(/type="checkbox"/g) || [];
    expect(checkboxes.length).toBe(4);
    expect((SOURCE.match(/<PublishControl/g) || []).length).toBe(2);
  });

  test("토글이 처리 상태로 비활성화된다", () => {
    expect(SOURCE).toMatch(/const blockReason = publishBlockReason\(article\)/);
    expect(SOURCE).toMatch(/disabled=\{isMutating \|\| blocked\}/);
  });

  test("이미 공개된 아티클을 내리는 길은 막지 않는다", () => {
    expect(SOURCE).toMatch(
      /const blocked = !published && Boolean\(blockReason\)/,
    );
  });

  test("단건 실행에도 서버 호출 전 가드가 있다", () => {
    expect(SOURCE).toMatch(
      /action === "PUBLISH" && !canPublishArticle\(article\)/,
    );
  });

  test("일괄 공개가 대상을 분리하고 제외 건수를 알린다", () => {
    expect(SOURCE).toMatch(/partitionPublishable\(selectedRecords\)/);
    expect(SOURCE).toMatch(/blocked\.length[\s\S]{0,200}제외/);
    expect(SOURCE).toMatch(/제외했습니다/);
  });

  test("일괄 요청 본문이 선택 전체가 아니라 공개 가능 건만 담는다", () => {
    expect(SOURCE).toMatch(/publishable\.map\(\(article\) => \(\{/);
    expect(SOURCE).not.toMatch(/selectedRecords\.map\(\(article\) => \(\{/);
  });

  test("상태 라벨을 공용 어휘에서 가져온다", () => {
    expect(SOURCE).toMatch(
      /from "\.\.\/\.\.\/components\/tech-articles\/techArticleStatus"/,
    );
    expect(SOURCE).not.toMatch(/value=\{detail\.processingStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.reviewStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.publicationStatus\}/);
  });
});

describe("파이프라인 단계 표시", () => {
  test("전체 아티클 화면이 등록 전 중복 검토 대상을 범위에서 구분한다", () => {
    expect(SOURCE).toContain("중복 검토를 통과해 등록된 아티클");
    expect(SOURCE).toContain("중복 검토 대기 항목은");
    expect(SOURCE).toMatch(/관리합니다\.\s*<br \/>\s*중복 검토 대기 항목은/);
    expect(SOURCE).toContain("등록된 아티클");
    expect(SOURCE).not.toContain("중복 검토 통과 후 등록");
    expect(SOURCE).not.toContain("<p>총 아티클</p>");
  });

  test("등록 아티클 집계가 흰색 평문과 구분자로 표시된다", () => {
    expect(SOURCE).not.toMatch(/queue-stat-item is-published/);
    expect(SOURCE).not.toMatch(/queue-stat-item is-unpublished/);
    expect(SOURCE).toMatch(/queue-stat-divider/);
    expect(SOURCE).not.toMatch(/<strong>\{publishedCount\}<\/strong>/);
    expect(SOURCE).not.toMatch(/<strong>\{hiddenCount\}<\/strong>/);
    expect(ALIGN_CSS).toMatch(/\.queue-stat-inline \{[\s\S]*?color: #f3f4f6;/);
    expect(ALIGN_CSS).toMatch(/\.queue-stat-inline \{[\s\S]*?font-weight: 400;/);
    expect(ALIGN_CSS).not.toMatch(/\.queue-stat-item\.is-published/);
    expect(ALIGN_CSS).not.toMatch(/\.queue-stat-item\.is-unpublished/);
  });

  test("검토 큐 카드 제목이 등록 아티클 카드와 같은 위계를 쓴다", () => {
    for (const title of ["판정 대기", "품질 검토", "공개 검토"]) {
      expect(REVIEWS).toContain(
        `<p className="queue-stat-title">${title}</p>`,
      );
    }
    expect(ALIGN_CSS).toMatch(
      /\.overview-card-title,\s*\.ta-admin \.queue-stat-card \.queue-stat-title \{[\s\S]*?font-size: 16px;/,
    );
  });

  test("공개 정책 제목과 선택 영역 사이에 작은 간격이 있다", () => {
    expect(SOURCE).toMatch(/<form className="policy-form" onSubmit=\{savePolicy\}>/);
    expect(ALIGN_CSS).toMatch(
      /\.policy-card \.policy-form \{\s*margin-top: 12px;/,
    );
  });

  test("목록 컬럼이 검토 상태에서 단계로 바뀌었다", () => {
    expect(SOURCE).toMatch(/<th[^>]*>\s*파이프라인 단계\s*<\/th>/);
    expect(SOURCE).not.toMatch(/<th[^>]*>\s*검토 상태\s*<\/th>/);
    expect(SOURCE).not.toMatch(/status=\{[\s\S]{0,60}REVIEW_NOT_REQUIRED/);
  });

  test("표 뷰와 모바일 카드 뷰 모두 단계를 보여준다", () => {
    expect((SOURCE.match(/<StageBadge/g) || []).length).toBe(3);
  });

  test("상세는 세 축을 원본 그대로 보여준다", () => {
    for (const axis of [
      "detail.processingStatus",
      "detail.reviewStatus",
      "detail.publicationStatus",
    ]) {
      expect(SOURCE).toContain(`status={${axis}}`);
    }
  });

  test("단계 필터가 서버 조회 조건으로 나간다", () => {
    expect(SOURCE).toMatch(
      /stage:[\s\S]{0,120}stageFilter !== MISMATCH_FILTER/,
    );
    expect(SOURCE).toMatch(/statusMismatch: stageFilter === MISMATCH_FILTER/);
    expect(SOURCE).toMatch(
      /\[keyword, page, publicationStatus, sort, stageFilter\]/,
    );
  });

  test("페이지를 넘겨도 단계 필터가 풀리지 않는다", () => {
    expect(SOURCE).not.toMatch(/setStageFilter\(""\)/);
    expect(SOURCE).toMatch(/setPage\(1\);[\s\S]{0,60}\[stageFilter, keyword/);
  });
});

describe("목록 표 폭 예산", () => {
  const CSS = fs.readFileSync(
    path.join(__dirname, "..", "..", "styles", "techArticlesAdminAlign.css"),
    "utf8",
  );

  const NARROWEST_SCREEN = 969;
  const TITLE_MIN = 156;

  const widths = [
    ...CSS.matchAll(
      /\.ta-admin \.admin-articles-table \.[a-z-]+ \{\s*width: (\d+)px;/g,
    ),
  ].map((m) => Number(m[1]));

  const declared = Number(
    CSS.match(
      /\.ta-admin \.article-table\.admin-articles-table \{[\s\S]*?min-width: (\d+)px;/,
    )[1],
  );

  test("고정 폭 열 + 제목 최소폭이 표의 min-width 와 맞는다", () => {
    expect(widths.length).toBeGreaterThan(0);
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum + TITLE_MIN).toBeLessThanOrEqual(declared);
  });

  test("1280 화면에서 가로 스크롤이 생기지 않는다", () => {
    expect(declared).toBeLessThanOrEqual(NARROWEST_SCREEN);
  });

  test("단계 배지가 옆 칸을 덮지 않는다", () => {
    expect(CSS).toMatch(
      /\.ta-admin \.admin-articles-table \.stage-badge \{[^}]*white-space: normal;/,
    );
  });

  test("열 폭 규칙이 중복 검토 표로 새지 않는다", () => {
    const scopedStart = CSS.indexOf(
      ".ta-admin .article-table.admin-articles-table",
    );
    expect(scopedStart).toBeGreaterThanOrEqual(0);
    const scoped = CSS.slice(scopedStart);
    const leaked =
      scoped.match(/\.ta-admin \.article-table(?!\.admin-articles-table)/g) ||
      [];
    expect(leaked).toEqual([]);

    const reviews = fs.readFileSync(
      path.join(__dirname, "AdminTechArticleReviews.jsx"),
      "utf8",
    );
    expect(reviews).not.toMatch(/admin-articles-table/);
  });

  test("폭을 지정하지 않은 열은 아티클 하나뿐이다", () => {
    const headers = SOURCE.match(/<th[\s>]/g) || [];
    expect(headers.length - widths.length).toBe(1);
  });
});

describe("조회수 열", () => {
  test("전체를 먼저 보여주고 회원·비회원은 그 아래에 붙는다", () => {
    const cell = SOURCE.match(
      /function ViewCountCell\(\{ counts \}\) \{[\s\S]*?\n\}/,
    );
    expect(cell).not.toBeNull();
    const body = cell[0];
    expect(body).toMatch(/admin-view-total/);
    expect(body).toMatch(/\{member \+ guest\}/);
    expect(body.indexOf("admin-view-total")).toBeLessThan(body.indexOf("회원"));
  });

  test("합계를 서버 값으로 착각하지 않는다", () => {
    expect(SOURCE).not.toMatch(/viewCounts\?\.total/);
  });
});

describe("표시 오류 표식", () => {
  test("단계 배지를 대체하지 않고 별도 표식으로 붙는다", () => {
    expect(SOURCE).toMatch(/stageMeta\(resolveStage\(article\)\)/);
    expect(SOURCE).toMatch(/hasStateMismatch\(article\) && \(/);
    expect(SOURCE).toMatch(/className="stage-flag"/);
  });

  test("요약에서 단계 칩과 분리되어 집계된다", () => {
    expect(SOURCE).toMatch(/stats\?\.stages\?\.\[stage\]/);
    expect(SOURCE).toMatch(/stats\?\.statusMismatch/);
    expect(SOURCE).toMatch(/stage-chip-flag/);
  });

  test("칩 숫자가 목록과 같은 조건으로 좁혀진다", () => {
    expect(SOURCE).toMatch(/getAdminTechArticleStats\(\{[\s\S]{0,140}keyword/);
    expect(SOURCE).toMatch(
      /publicationStatus: publicationStatus \|\| undefined,/,
    );
    expect(SOURCE).toMatch(/\}, \[keyword, publicationStatus\]\);/);
  });

  test("칩 숫자를 화면에서 다시 세지 않는다", () => {
    expect(SOURCE).not.toMatch(/summarizeStages/);
    expect(SOURCE).not.toMatch(/loadedItems/);
  });

  test("필터가 단계와 별도 토큰을 쓴다", () => {
    expect(SOURCE).toMatch(/stageFilter === MISMATCH_FILTER/);
    expect(SOURCE).toMatch(
      /statusMismatch: stageFilter === MISMATCH_FILTER \? true : undefined/,
    );
  });
});

describe("단계 툴바 배치", () => {
  test("서버 필터 카드가 아니라 목록 표 위에 붙는다", () => {
    expect(SOURCE).not.toMatch(/stage-summary-card/);
    expect(SOURCE).toMatch(/className="stage-toolbar"/);
    const toolbar = SOURCE.indexOf("<StageToolbar");
    const filterCard = SOURCE.indexOf('aria-labelledby="filterTitle"');
    const table = SOURCE.indexOf("<table");
    expect(filterCard).toBeLessThan(toolbar);
    expect(toolbar).toBeLessThan(table);
  });

  test("진행 단계와 종료 상태를 시각적으로 나눈다", () => {
    expect(SOURCE).toMatch(/className="stage-group is-flow"/);
    expect(SOURCE).toMatch(/className="stage-group is-exit"/);
    expect(SOURCE).toMatch(/STAGE_FLOW\.map/);
    expect(SOURCE).toMatch(/STAGE_EXIT\.map/);
    expect(SOURCE).not.toMatch(/summary\.map\(\(entry\) => \(/);
  });

  test("종료 묶음이 소계를 보여준다", () => {
    expect(SOURCE).toMatch(/const exitTotal = STAGE_EXIT\.reduce/);
    expect(SOURCE).toMatch(/종료 \{exitTotal\}/);
  });

  test("목록에는 한 줄 요약을 싣지 않는다", () => {
    expect(SOURCE).not.toMatch(/admin-article-summary/);
    expect(SOURCE).not.toMatch(/admin-mobile-card-summary/);
    expect(SOURCE).toMatch(/detail\.oneLineSummary/);
    expect((SOURCE.match(/oneLineSummary/g) || []).length).toBe(1);
  });

  test("체류 시간을 대기 단계에만 보여준다", () => {
    expect(SOURCE).toMatch(/STAGE_WAITING\.includes\(selected\.stage\)/);
    expect(SOURCE).toMatch(/STAGE_WAITING\.includes\(entry\.stage\)/);
  });

  test("집계 범위를 문구로 밝힌다", () => {
    expect(SOURCE).toMatch(/전체 기준/);
    expect(SOURCE).not.toMatch(/현재 페이지 기준/);
  });

  test("목록 총계가 필터를 반영한다", () => {
    expect(SOURCE).toMatch(
      /const totalCount = response\?\.pagination\?\.totalCount/,
    );
    expect(SOURCE).toMatch(/총 \{totalCount\}건/);
  });
});

const PANEL = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "components",
    "tech-articles",
    "ArticleQualityPanel.jsx",
  ),
  "utf8",
);
const REVIEWS = fs.readFileSync(
  path.join(__dirname, "AdminTechArticleReviews.jsx"),
  "utf8",
);

describe("품질 평가 근거 공유", () => {
  test("평가 축과 가중치를 서버 응답에서 읽는다", () => {
    expect(PANEL).toMatch(/score\?\.axes/);
    expect(PANEL).toMatch(/axis\.label/);
    expect(PANEL).toMatch(/axis\.weight/);
    expect(PANEL).toMatch(/axis\.contribution/);
    expect(PANEL).not.toMatch(/QUALITY_DIMENSIONS/);
    expect(PANEL).not.toMatch(/\["relevance", "[^"]+", 0\.45\]/);
    expect(PANEL).not.toMatch(/\["sourceReliability", "[^"]+", 0\.25\]/);
  });

  test("두 화면 모두 공유 패널을 쓴다", () => {
    for (const source of [SOURCE, REVIEWS]) {
      expect(source).toMatch(/<QualityEvaluationPanel/);
      expect(source).toMatch(/ArticleQualityPanel/);
    }
  });

  test("검토 큐 두 탭 모두 원문 링크를 보여준다", () => {
    expect((REVIEWS.match(/<OriginalSourceLink/g) || []).length).toBe(2);
    expect(REVIEWS).toMatch(/detail\.source\?\.articleUrl/);
  });

  test("중복 검토가 양쪽 원문 링크를 모두 보여준다", () => {
    expect(REVIEWS).toMatch(/후보 원문 보기/);
    expect(REVIEWS).toMatch(/기존 원문 보기/);
    expect(REVIEWS).toMatch(
      /matched\?\.articleUrl \|\| matched\?\.source\?\.articleUrl/,
    );
  });

  test("비교 카드 양쪽이 같은 항목을 보여준다", () => {
    const existing = REVIEWS.slice(REVIEWS.indexOf("existing-card"));
    for (const field of ["출처", "원문 언어", "원문 게시일"]) {
      expect(existing.slice(0, 2000)).toContain(field);
    }
  });

  test("검토 큐가 평가 신호를 원본 키 그대로 늘어놓지 않는다", () => {
    expect(REVIEWS).not.toMatch(/JSON\.stringify\(value\)/);
    expect(PANEL).toMatch(/SIGNAL_LABEL/);
  });
});

const ALIGN_CSS = fs.readFileSync(
  path.join(__dirname, "..", "..", "styles", "techArticlesAdminAlign.css"),
  "utf8",
);

describe("숫자 서체", () => {
  test("orbitron 은 라틴 눈썹과 제목에만 남는다", () => {
    for (const source of [SOURCE, REVIEWS]) {
      const uses = source.match(/className="[^"]*orbitron[^"]*"/g) || [];
      expect(uses.length).toBeGreaterThan(0);
      for (const use of uses) {
        expect(use).toMatch(/section-eyebrow|gradient-text/);
      }
    }
  });

  test("숫자를 표시하는 자리는 본문 서체로 되돌린다", () => {
    for (const selector of [
      "\\.ta-admin \\.total-article-count,",
      "\\.ta-admin \\.queue-stat-card strong,",
      "\\.ta-admin \\.stage-chip strong,",
      "\\.ta-admin \\.admin-score,",
    ]) {
      expect(ALIGN_CSS).toMatch(new RegExp(selector));
    }
    expect(ALIGN_CSS).toMatch(/font-variant-numeric: tabular-nums;/);
  });
});
