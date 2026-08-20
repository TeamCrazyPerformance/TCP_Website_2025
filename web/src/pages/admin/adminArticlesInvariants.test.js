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
    expect(SOURCE).toMatch(/<th scope="col">파이프라인 단계<\/th>/);
    expect(SOURCE).not.toMatch(/<th scope="col">검토 상태<\/th>/);
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

  test("단계 필터가 조회 조건 변경 시 초기화된다", () => {
    // 남겨두면 다른 페이지에서 빈 목록으로 보임
    expect(SOURCE).toMatch(/setStageFilter\(""\);[\s\S]{0,80}\[page, keyword/);
  });
});

describe("표시 오류 표식", () => {
  test("단계 배지를 대체하지 않고 별도 표식으로 붙는다", () => {
    // 단계를 덮으면 아티클이 어디서 멈췄는지가 가려짐
    expect(SOURCE).toMatch(/stageMeta\(articleStage\(article\)\)/);
    expect(SOURCE).toMatch(/hasStateMismatch\(article\) && \(/);
    expect(SOURCE).toMatch(/className="stage-flag"/);
  });

  test("요약에서 단계 칩과 분리되어 집계된다", () => {
    expect(SOURCE).toMatch(/const \{ stages: stageSummary, mismatchCount \}/);
    expect(SOURCE).toMatch(/stage-chip-flag/);
  });

  test("필터가 단계와 별도 토큰을 쓴다", () => {
    expect(SOURCE).toMatch(/stageFilter === MISMATCH_FILTER/);
    expect(SOURCE).toMatch(/loadedItems\.filter\(hasStateMismatch\)/);
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

  test("집계 범위를 문구로 밝힌다", () => {
    // 서버 필터와 범위가 달라 명시가 없으면 건수를 오독합니다.
    expect(SOURCE).toMatch(/현재 페이지 기준/);
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
  test("가중치가 파이프라인 정책과 일치한다", () => {
    // evaluator.py: relevance*0.45 + timeliness*0.30 + sourceReliability*0.25
    expect(PANEL).toMatch(/\["relevance", "[^"]+", 0\.45\]/);
    expect(PANEL).toMatch(/\["timeliness", "[^"]+", 0\.3\]/);
    expect(PANEL).toMatch(/\["sourceReliability", "[^"]+", 0\.25\]/);
  });

  test("가중치 정의가 한 곳에만 있다", () => {
    for (const source of [SOURCE, REVIEWS]) {
      expect(source).not.toMatch(/"sourceReliability", "[^"]+", 0\.25/);
    }
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
