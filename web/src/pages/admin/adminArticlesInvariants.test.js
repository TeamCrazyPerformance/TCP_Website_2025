/* AdminTechArticles.jsx 의 화면 불변식을 소스 수준에서 고정합니다.
 *
 * 표 뷰와 모바일 카드 뷰에 같은 UI 가 중복 존재해 한쪽만 고치면
 * 다른 쪽으로 우회됩니다. 구현을 하나로 모으고 그 전제를 여기서 검증합니다. */
const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(
  path.join(__dirname, "AdminTechArticles.jsx"),
  "utf8",
);

describe("공개 토글 가드", () => {
  test("공개 토글 구현이 PublishControl 하나뿐이다", () => {
    // 공개 토글 1개 + 행 선택 2개(표, 모바일 카드) + 전체 선택 1개.
    // 늘었다면 가드 없는 토글이 생겼을 가능성이 큼.
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
    // 확인 모달과 결과 알림 모두 blocked 를 언급
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
    // 영문 enum 을 그대로 출력하던 자리
    expect(SOURCE).not.toMatch(/value=\{detail\.processingStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.reviewStatus\}/);
    expect(SOURCE).not.toMatch(/value=\{detail\.publicationStatus\}/);
  });
});

describe("파이프라인 단계 표시", () => {
  test("목록 컬럼이 검토 상태에서 단계로 바뀌었다", () => {
    // reviewStatus 단독 표시가 위조 APPROVED 를 "검토 승인"으로 보이게 한 원인
    // 머리글에 열 폭 className 이 붙을 수 있어 속성은 느슨하게 봅니다.
    expect(SOURCE).toMatch(/<th[^>]*>\s*파이프라인 단계\s*<\/th>/);
    expect(SOURCE).not.toMatch(/<th[^>]*>\s*검토 상태\s*<\/th>/);
    expect(SOURCE).not.toMatch(/status=\{[\s\S]{0,60}REVIEW_NOT_REQUIRED/);
  });

  test("표 뷰와 모바일 카드 뷰 모두 단계를 보여준다", () => {
    expect((SOURCE.match(/<StageBadge/g) || []).length).toBe(3); // 표 + 카드 + 상세
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
    // 불러온 목록에서 거르면 그 페이지에 있던 것만 걸러져 전수를 볼 수 없습니다.
    expect(SOURCE).toMatch(
      /stage:[\s\S]{0,120}stageFilter !== MISMATCH_FILTER/,
    );
    expect(SOURCE).toMatch(/statusMismatch: stageFilter === MISMATCH_FILTER/);
    // 칩을 누르면 다시 조회되도록 의존성에 들어가 있어야 합니다.
    expect(SOURCE).toMatch(
      /\[keyword, page, publicationStatus, sort, stageFilter\]/,
    );
  });

  test("페이지를 넘겨도 단계 필터가 풀리지 않는다", () => {
    // 예전에는 page 가 바뀌면 setStageFilter("") 가 돌아 필터가 사라졌습니다.
    // 이제 서버가 걸러 주므로 다른 페이지에서 빈 목록이 되지 않습니다.
    expect(SOURCE).not.toMatch(/setStageFilter\(""\)/);
    expect(SOURCE).toMatch(/setPage\(1\);[\s\S]{0,60}\[stageFilter, keyword/);
  });
});

describe("목록 표 폭 예산", () => {
  const CSS = fs.readFileSync(
    path.join(__dirname, "..", "..", "styles", "techArticlesAdminAlign.css"),
    "utf8",
  );

  // 사이드바 260 + main 좌우 여백 48 을 뺀, 화면 1280 에서 표가 쓸 수 있는 폭.
  const NARROWEST_SCREEN = 969;
  // 폭을 주지 않은 "아티클" 열에 남겨야 할 최소치. 화면이 가장 좁을 때
  // 줄어드는 것은 제목뿐이고, 제목은 두 줄에서 말줄임으로 끊깁니다.
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
    // 열을 추가하면서 이 예산을 안 고치면 다시 가로 스크롤이 생깁니다.
    expect(widths.length).toBeGreaterThan(0);
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum + TITLE_MIN).toBeLessThanOrEqual(declared);
  });

  test("1280 화면에서 가로 스크롤이 생기지 않는다", () => {
    expect(declared).toBeLessThanOrEqual(NARROWEST_SCREEN);
  });

  test("단계 배지가 옆 칸을 덮지 않는다", () => {
    // fixed 레이아웃에서 nowrap 배지는 칸을 넘으면 줄바꿈 대신 옆 칸을
    // 파고듭니다. 실제로 품질 검토 단계 배지가 공개 설정을 덮었습니다.
    expect(CSS).toMatch(
      /\.ta-admin \.admin-articles-table \.stage-badge \{[^}]*white-space: normal;/,
    );
  });

  test("열 폭 규칙이 중복 검토 표로 새지 않는다", () => {
    // AdminTechArticleReviews 도 article-table admin-v9-table 을 씁니다.
    // 여기 규칙을 .article-table 로 걸면 그 표까지 fixed 레이아웃이 되어
    // 열이 균등 분할되고 작업 버튼이 세로로 쌓입니다.
    const scoped = CSS.split("아티클 목록 표: 한 화면에 담기")[1];
    expect(scoped).toBeTruthy();
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
    // 둘 이상이면 남는 자리를 나눠 가져 제목이 좁아집니다.
    const headers = SOURCE.match(/<th[\s>]/g) || [];
    expect(headers.length - widths.length).toBe(1);
  });
});

describe("조회수 열", () => {
  test("전체를 먼저 보여주고 회원·비회원은 그 아래에 붙는다", () => {
    // 대표값은 합계입니다. 내역만 있으면 "이 글이 얼마나 읽혔나"에
    // 관리자가 암산으로 답해야 합니다.
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
    // 파이프라인은 member/guest 두 칸만 저장합니다. total 이 생기면
    // 화면 합계와 저장 값이 어긋날 수 있습니다.
    expect(SOURCE).not.toMatch(/viewCounts\?\.total/);
  });
});

describe("표시 오류 표식", () => {
  test("단계 배지를 대체하지 않고 별도 표식으로 붙는다", () => {
    // 단계를 덮으면 아티클이 어디서 멈췄는지가 가려짐
    expect(SOURCE).toMatch(/stageMeta\(resolveStage\(article\)\)/);
    expect(SOURCE).toMatch(/hasStateMismatch\(article\) && \(/);
    expect(SOURCE).toMatch(/className="stage-flag"/);
  });

  test("요약에서 단계 칩과 분리되어 집계된다", () => {
    // 단계는 stages, 표시 오류는 reviews.statusMismatch — 축이 다릅니다.
    expect(SOURCE).toMatch(/stats\?\.stages\?\.\[stage\]/);
    expect(SOURCE).toMatch(/stats\?\.statusMismatch/);
    expect(SOURCE).toMatch(/stage-chip-flag/);
  });

  test("칩 숫자가 목록과 같은 조건으로 좁혀진다", () => {
    // 통계만 전체를 세면 "칩 11 / 목록 2 건"이 되어 다시 어긋납니다.
    expect(SOURCE).toMatch(/getAdminTechArticleStats\(\{[\s\S]{0,140}keyword/);
    expect(SOURCE).toMatch(
      /publicationStatus: publicationStatus \|\| undefined,/,
    );
    // 조회 조건이 바뀌면 통계도 다시 불러와야 합니다.
    expect(SOURCE).toMatch(/\}, \[keyword, publicationStatus\]\);/);
  });

  test("칩 숫자를 화면에서 다시 세지 않는다", () => {
    // 불러온 페이지를 세면 페이지마다 숫자가 달라집니다. 서버 집계만 씁니다.
    expect(SOURCE).not.toMatch(/summarizeStages/);
    expect(SOURCE).not.toMatch(/loadedItems/);
  });

  test("필터가 단계와 별도 토큰을 쓴다", () => {
    // 표시 오류는 단계가 아니므로 stage 파라미터로 보내면 안 됩니다.
    expect(SOURCE).toMatch(/stageFilter === MISMATCH_FILTER/);
    expect(SOURCE).toMatch(
      /statusMismatch: stageFilter === MISMATCH_FILTER \? true : undefined/,
    );
  });
});

describe("단계 툴바 배치", () => {
  test("서버 필터 카드가 아니라 목록 표 위에 붙는다", () => {
    // "총 아티클 72" 카드 옆에 두면 집계 범위를 같은 것으로 오독합니다.
    expect(SOURCE).not.toMatch(/stage-summary-card/);
    expect(SOURCE).toMatch(/className="stage-toolbar"/);
    const toolbar = SOURCE.indexOf("<StageToolbar");
    const filterCard = SOURCE.indexOf('aria-labelledby="filterTitle"');
    const table = SOURCE.indexOf("<table");
    expect(filterCard).toBeLessThan(toolbar);
    expect(toolbar).toBeLessThan(table);
  });

  test("진행 단계와 종료 상태를 시각적으로 나눈다", () => {
    // 한 줄에 늘어놓으면 "품질 미달"이 "처리 완료" 다음 단계처럼 읽힙니다.
    expect(SOURCE).toMatch(/className="stage-group is-flow"/);
    expect(SOURCE).toMatch(/className="stage-group is-exit"/);
    // 묶음은 어휘 파일의 분류를 따릅니다. 화면에서 다시 나열하지 않습니다.
    expect(SOURCE).toMatch(/STAGE_FLOW\.map/);
    expect(SOURCE).toMatch(/STAGE_EXIT\.map/);
    expect(SOURCE).not.toMatch(/summary\.map\(\(entry\) => \(/);
  });

  test("종료 묶음이 소계를 보여준다", () => {
    // 개별 실패 건수만 있으면 "얼마나 빠져나갔나"를 매번 더해야 합니다.
    expect(SOURCE).toMatch(/const exitTotal = STAGE_EXIT\.reduce/);
    expect(SOURCE).toMatch(/종료 \{exitTotal\}/);
  });

  test("목록에는 한 줄 요약을 싣지 않는다", () => {
    // 행마다 두 줄을 더 차지하면서 정작 먼저 읽혀야 할 단계를 밀어냅니다.
    // 표 뷰와 모바일 카드 뷰 양쪽에서 빠져야 합니다.
    expect(SOURCE).not.toMatch(/admin-article-summary/);
    expect(SOURCE).not.toMatch(/admin-mobile-card-summary/);
    // 상세 패널에는 남아 있어야 합니다 — 거기서는 읽을 이유가 있습니다.
    expect(SOURCE).toMatch(/detail\.oneLineSummary/);
    expect((SOURCE.match(/oneLineSummary/g) || []).length).toBe(1);
  });

  test("체류 시간을 대기 단계에만 보여준다", () => {
    // 종착지의 체류 시간은 조치로 이어지지 않습니다.
    expect(SOURCE).toMatch(/STAGE_WAITING\.includes\(selected\.stage\)/);
    expect(SOURCE).toMatch(/STAGE_WAITING\.includes\(entry\.stage\)/);
  });

  test("집계 범위를 문구로 밝힌다", () => {
    // 칩과 목록 총계가 같은 모집단을 센다는 것을 문구로도 밝힙니다.
    expect(SOURCE).toMatch(/전체 기준/);
    expect(SOURCE).not.toMatch(/현재 페이지 기준/);
  });

  test("목록 총계가 필터를 반영한다", () => {
    // 헤더가 전역 총계를 그대로 찍으면 칩 숫자와 어긋나 보입니다.
    expect(SOURCE).toMatch(
      /const totalCount = response\?\.pagination\?\.totalCount/,
    );
    expect(SOURCE).toMatch(/총 \{totalCount\}건/);
  });
});

/* 원문 링크와 품질 평가 근거는 전체 아티클 화면과 검토 큐 화면이 같은 형식으로
 * 보여야 합니다. 한쪽만 고치면 검토자가 두 화면에서 다른 정보를 봅니다. */
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
    // 품질 검토 · 공개 검토 각각 1회
    expect((REVIEWS.match(/<OriginalSourceLink/g) || []).length).toBe(2);
    expect(REVIEWS).toMatch(/detail\.source\?\.articleUrl/);
  });

  test("중복 검토가 양쪽 원문 링크를 모두 보여준다", () => {
    // 중복 판정은 두 글을 견주는 작업이라 한쪽만 열리면 비교가 안 됩니다.
    expect(REVIEWS).toMatch(/후보 원문 보기/);
    expect(REVIEWS).toMatch(/기존 원문 보기/);
    expect(REVIEWS).toMatch(
      /matched\?\.articleUrl \|\| matched\?\.source\?\.articleUrl/,
    );
  });

  test("비교 카드 양쪽이 같은 항목을 보여준다", () => {
    // 후보 카드에만 있던 항목이 기존 카드에도 있어야 비교가 성립합니다.
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

/* Orbitron 은 정사각 기하 디스플레이 서체라 0/8, 1, 6/9 판별이 어렵고 tabular
 * 자릿수도 없습니다. 라틴 대문자 눈썹과 제목에서는 브랜드 요소로 쓰되,
 * 읽어야 하는 숫자에는 쓰지 않습니다. */
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
    // 새 숫자 자리를 만들면 이 목록에 추가해야 합니다.
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
