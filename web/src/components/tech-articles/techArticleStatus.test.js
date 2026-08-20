/* 공개 가능 여부 판정과 상태 어휘를 검증합니다.
 *
 * 공개 목록 쿼리는 processing_status = 'ENRICHED' 를 요구합니다.
 * 그 단계에 이르지 못한 아티클을 공개하면 관리자 화면만 "공개"가 되고
 * 실사이트에는 나타나지 않습니다. */
import {
  PROCESSING_STATUS_LABEL,
  PUBLICATION_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  STAGE,
  articleStage,
  canPublishArticle,
  hasStateMismatch,
  partitionPublishable,
  publishBlockReason,
  MISMATCH_FILTER,
  stageMeta,
  statusLabel,
  statusTone,
  summarizeStages,
} from "./techArticleStatus";

// DB CHECK 제약(001_article_admission.sql)에 선언된 값 전체
const PROCESSING = [
  "INGESTED",
  "QUALITY_EVALUATED",
  "QUALITY_REJECTED",
  "ENRICHMENT_PENDING",
  "ENRICHED",
  "PROCESSING_FAILED",
];
const REVIEW = [
  "NOT_REQUIRED",
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "CHANGES_REQUESTED",
];
const PUBLICATION = [
  "UNPUBLISHED",
  "SCHEDULED",
  "PUBLISHED",
  "HIDDEN",
  "ARCHIVED",
];

const article = (overrides = {}) => ({
  articleId: "a-1",
  processingStatus: "ENRICHED",
  publicationStatus: "UNPUBLISHED",
  ...overrides,
});

describe("상태 어휘", () => {
  test("DB 제약에 선언된 값을 모두 한국어로 옮긴다", () => {
    expect(Object.keys(PROCESSING_STATUS_LABEL).sort()).toEqual(
      [...PROCESSING].sort(),
    );
    expect(Object.keys(REVIEW_STATUS_LABEL).sort()).toEqual([...REVIEW].sort());
    expect(Object.keys(PUBLICATION_STATUS_LABEL).sort()).toEqual(
      [...PUBLICATION].sort(),
    );
  });

  test("세 축의 값이 서로 겹치지 않는다 (단일 라벨 표의 전제)", () => {
    const all = [...PROCESSING, ...REVIEW, ...PUBLICATION];
    expect(new Set(all).size).toBe(all.length);
  });

  test("영문 enum 이 화면에 그대로 노출되지 않는다", () => {
    for (const status of [...PROCESSING, ...REVIEW, ...PUBLICATION]) {
      expect(statusLabel(status)).not.toBe(status);
      expect(statusLabel(status)).not.toMatch(/[A-Z_]{4,}/);
    }
  });

  test("실패 계열이 진행 중과 다른 색 계열을 받는다", () => {
    for (const status of ["QUALITY_REJECTED", "PROCESSING_FAILED", "REJECTED"])
      expect(statusTone(status)).toBe("status-failed");
    expect(statusTone("ENRICHED")).toBe("status-published");
    expect(statusTone("QUALITY_EVALUATED")).toBe("status-pending");
  });

  test("모르는 값이 들어와도 화면이 깨지지 않는다", () => {
    expect(statusLabel(undefined)).toBe("확인 중");
    expect(statusTone(undefined)).toBe("status-processing");
    expect(statusLabel("NEW_STATE_FROM_PIPELINE")).toBe(
      "NEW_STATE_FROM_PIPELINE",
    );
  });
});

describe("공개 가능 여부", () => {
  test("ENRICHED 만 공개할 수 있다", () => {
    for (const status of PROCESSING) {
      expect(canPublishArticle(article({ processingStatus: status }))).toBe(
        status === "ENRICHED",
      );
    }
  });

  test("공개 불가 아티클은 사유가 있다", () => {
    for (const status of PROCESSING.filter((s) => s !== "ENRICHED")) {
      const reason = publishBlockReason(article({ processingStatus: status }));
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
    expect(publishBlockReason(article())).toBeNull();
  });

  test("품질 미달과 처리 실패는 서로 다른 사유를 안내한다", () => {
    expect(
      publishBlockReason(article({ processingStatus: "QUALITY_REJECTED" })),
    ).not.toBe(
      publishBlockReason(article({ processingStatus: "PROCESSING_FAILED" })),
    );
  });
});

/* 실서버(33건) 관측 조합이 판정 근거입니다.
 * 모두 publicationStatus 가 HIDDEN 이라 공개 상태로 판정하면 하나도 잡지 못합니다.
 *
 * 단 PROCESSING_FAILED + APPROVED 는 모순이 아닙니다. 정상 승인 뒤 요약 작업만
 * 실패한 상태로, QA 에서 재처리 대상으로 정리한 건입니다. */
const OBSERVED_MISMATCH = [
  ["QUALITY_REJECTED", "APPROVED", "HIDDEN"],
  ["QUALITY_EVALUATED", "APPROVED", "HIDDEN"],
];

describe("상태 불일치 탐지", () => {
  test.each(OBSERVED_MISMATCH)(
    "%s / %s / %s 를 잡아낸다",
    (processingStatus, reviewStatus, publicationStatus) => {
      expect(
        hasStateMismatch(
          article({ processingStatus, reviewStatus, publicationStatus }),
        ),
      ).toBe(true);
    },
  );

  test("비공개로 내려도 여전히 잡힌다", () => {
    // 공개 상태 기준으로 판정하면 놓치는 지점
    for (const publicationStatus of ["HIDDEN", "UNPUBLISHED", "ARCHIVED"]) {
      expect(
        hasStateMismatch(
          article({
            processingStatus: "QUALITY_REJECTED",
            reviewStatus: "APPROVED",
            publicationStatus,
          }),
        ),
      ).toBe(true);
    }
  });

  test("승인 경로가 남기는 정상 상태는 잡지 않는다", () => {
    // 승인 -> ENRICHMENT_PENDING -> ENRICHED, 실패 시 PROCESSING_FAILED
    for (const processingStatus of [
      "ENRICHMENT_PENDING",
      "ENRICHED",
      "PROCESSING_FAILED",
    ]) {
      expect(
        hasStateMismatch(
          article({ processingStatus, reviewStatus: "APPROVED" }),
        ),
      ).toBe(false);
    }
  });

  test("APPROVED 가 아니면 잡지 않는다", () => {
    for (const reviewStatus of ["NOT_REQUIRED", "PENDING", "REJECTED"]) {
      expect(
        hasStateMismatch(
          article({ processingStatus: "QUALITY_REJECTED", reviewStatus }),
        ),
      ).toBe(false);
    }
  });
});

describe("파이프라인 단계", () => {
  // 실서버 33건에서 관측된 7개 조합
  const OBSERVED = [
    ["QUALITY_EVALUATED", "PENDING", "UNPUBLISHED", STAGE.QUALITY_REVIEW, 9],
    ["QUALITY_REJECTED", "APPROVED", "HIDDEN", STAGE.QUALITY_REJECTED, 9],
    ["ENRICHED", "NOT_REQUIRED", "PUBLISHED", STAGE.COMPLETED, 7],
    ["PROCESSING_FAILED", "APPROVED", "HIDDEN", STAGE.FAILED_AFTER_APPROVAL, 4],
    ["QUALITY_EVALUATED", "APPROVED", "HIDDEN", STAGE.QUALITY_REVIEW, 2],
    [
      "QUALITY_REJECTED",
      "NOT_REQUIRED",
      "UNPUBLISHED",
      STAGE.QUALITY_REJECTED,
      1,
    ],
    ["ENRICHED", "APPROVED", "PUBLISHED", STAGE.COMPLETED, 1],
  ];

  test.each(OBSERVED)(
    "%s / %s / %s -> %s",
    (processingStatus, reviewStatus, publicationStatus, expected) => {
      expect(
        articleStage(
          article({ processingStatus, reviewStatus, publicationStatus }),
        ),
      ).toBe(expected);
    },
  );

  test("실서버 분포를 그대로 집계한다", () => {
    const items = OBSERVED.flatMap(([p, r, pub, , count]) =>
      Array.from({ length: count }, () =>
        article({
          processingStatus: p,
          reviewStatus: r,
          publicationStatus: pub,
        }),
      ),
    );
    expect(items).toHaveLength(33);

    const { stages, mismatchCount } = summarizeStages(items);
    const byStage = Object.fromEntries(stages.map((s) => [s.stage, s.count]));

    // 표시 오류가 실제 단계를 가리지 않는다
    expect(byStage[STAGE.QUALITY_REJECTED]).toBe(10); // 9 + 1
    expect(byStage[STAGE.QUALITY_REVIEW]).toBe(11); // 9 + 2
    expect(byStage[STAGE.FAILED_AFTER_APPROVAL]).toBe(4);
    expect(byStage[STAGE.COMPLETED]).toBe(8);

    // 단계 합계가 전체와 일치 (표시 오류는 별도 축)
    expect(stages.reduce((sum, s) => sum + s.count, 0)).toBe(33);
    expect(mismatchCount).toBe(11);
  });

  test("표시 오류가 실제 단계를 대체하지 않는다", () => {
    // 이 2건은 여전히 품질 검토 큐에 남아 관리자 조치가 필요합니다.
    // 단계를 "상태 불일치"로 덮으면 처리해야 할 일이 가려집니다.
    const stuck = article({
      processingStatus: "QUALITY_EVALUATED",
      reviewStatus: "APPROVED",
      publicationStatus: "HIDDEN",
    });
    expect(articleStage(stuck)).toBe(STAGE.QUALITY_REVIEW);
    expect(hasStateMismatch(stuck)).toBe(true);
  });

  test("처리 실패는 승인 여부로 갈린다", () => {
    // 승인 뒤 실패는 재처리 대상이라 일반 실패와 구분합니다.
    expect(
      articleStage(
        article({
          processingStatus: "PROCESSING_FAILED",
          reviewStatus: "APPROVED",
        }),
      ),
    ).toBe(STAGE.FAILED_AFTER_APPROVAL);
    expect(
      articleStage(
        article({
          processingStatus: "PROCESSING_FAILED",
          reviewStatus: "NOT_REQUIRED",
        }),
      ),
    ).toBe(STAGE.FAILED);
  });

  test("단계는 노출 여부로 갈리지 않는다", () => {
    // 노출 축은 "공개 상태" 필터가 담당합니다. 여기서 나누면 라벨이 겹칩니다.
    const enriched = (overrides) =>
      articleStage(article({ processingStatus: "ENRICHED", ...overrides }));
    for (const publicationStatus of ["PUBLISHED", "HIDDEN", "ARCHIVED"]) {
      expect(enriched({ publicationStatus })).toBe(STAGE.COMPLETED);
    }
  });

  test("공개 검토 대기만 처리 완료에서 갈라진다", () => {
    const enriched = (overrides) =>
      articleStage(article({ processingStatus: "ENRICHED", ...overrides }));
    expect(
      enriched({ publicationStatus: "UNPUBLISHED", reviewStatus: "PENDING" }),
    ).toBe(STAGE.PUBLICATION_REVIEW);
    // 이미 공개했다면 검토가 끝난 것
    expect(
      enriched({ publicationStatus: "PUBLISHED", reviewStatus: "PENDING" }),
    ).toBe(STAGE.COMPLETED);
  });

  /* 칩(처리 축)과 "공개 상태" 셀렉트(노출 축)가 각자 한 축만 담당해야 합니다.
   * 단계가 노출 상태에 반응하면 두 컨트롤이 같은 것을 다르게 세게 됩니다. */
  test("공개 검토 대기를 빼면 단계는 노출 상태에 반응하지 않는다", () => {
    for (const processingStatus of PROCESSING) {
      for (const reviewStatus of REVIEW) {
        const stages = new Set(
          PUBLICATION.map((publicationStatus) =>
            articleStage(
              article({ processingStatus, reviewStatus, publicationStatus }),
            ),
          ),
        );
        stages.delete(STAGE.PUBLICATION_REVIEW);
        expect([...stages]).toHaveLength(1);
      }
    }
  });

  test("단계 라벨에 노출 상태 어휘가 섞이지 않는다", () => {
    // "공개 중" 처럼 셀렉트 항목과 헷갈리는 라벨을 막습니다.
    // 공개 검토 대기는 관리자 조치를 가리키는 말이라 예외입니다.
    const forbidden = ["공개", "비공개", "보관", "미공개"];
    for (const stage of Object.values(STAGE)) {
      if (stage === STAGE.PUBLICATION_REVIEW) continue;
      const label = stageMeta(stage).label;
      for (const word of forbidden) {
        expect(label.includes(word)).toBe(false);
      }
    }
  });

  test("모든 단계에 라벨과 색상이 있다", () => {
    for (const stage of Object.values(STAGE)) {
      const meta = stageMeta(stage);
      expect(meta.label).toBeTruthy();
      expect(meta.tone).toMatch(/^status-/);
      expect(typeof meta.order).toBe("number");
    }
  });

  test("모르는 처리 상태를 견딘다", () => {
    expect(articleStage(article({ processingStatus: "NEW_STATE" }))).toBe(
      STAGE.UNKNOWN,
    );
    expect(articleStage(undefined)).toBe(STAGE.UNKNOWN);
    expect(summarizeStages()).toEqual({ stages: [], mismatchCount: 0 });
  });

  test("STAGE 에 표시 오류가 섞여 있지 않다", () => {
    // 깃발을 단계 목록에 넣으면 다시 단계를 덮게 됩니다
    expect(Object.values(STAGE)).not.toContain(MISMATCH_FILTER);
  });
});

describe("일괄 공개 대상 분리", () => {
  test("처리 완료 건만 남기고 나머지는 제외 목록으로 보낸다", () => {
    const { publishable, blocked } = partitionPublishable([
      article({ articleId: "ok-1" }),
      article({ articleId: "ng-1", processingStatus: "QUALITY_REJECTED" }),
      article({ articleId: "ok-2" }),
      article({ articleId: "ng-2", processingStatus: "PROCESSING_FAILED" }),
    ]);
    expect(publishable.map((a) => a.articleId)).toEqual(["ok-1", "ok-2"]);
    expect(blocked.map((a) => a.articleId)).toEqual(["ng-1", "ng-2"]);
  });

  test("한 건도 잃어버리지 않는다", () => {
    const items = PROCESSING.map((status, index) =>
      article({ articleId: `a-${index}`, processingStatus: status }),
    );
    const { publishable, blocked } = partitionPublishable(items);
    expect(publishable.length + blocked.length).toBe(items.length);
  });

  test("빈 입력을 견딘다", () => {
    expect(partitionPublishable()).toEqual({ publishable: [], blocked: [] });
  });
});

/* 실 API 가 줄 수 있는 결측·비정상 값에서 화면이 죽지 않는지 확인합니다.
 * 파이프라인에 새 상태 값이 추가되어도 관리자 화면은 떠 있어야 합니다. */
const HOSTILE = [
  undefined,
  null,
  {},
  { articleId: "x" },
  { processingStatus: null, reviewStatus: null, publicationStatus: null },
  { processingStatus: "", reviewStatus: "", publicationStatus: "" },
  { processingStatus: 123, reviewStatus: [], publicationStatus: {} },
  { processingStatus: "enriched" },
  { processingStatus: "BRAND_NEW_STATE" },
];

describe("결측·비정상 입력 내성", () => {
  test.each(HOSTILE.map((item, index) => [index, item]))(
    "케이스 %i 에서 던지지 않는다",
    (_, item) => {
      expect(() => {
        stageMeta(articleStage(item));
        hasStateMismatch(item);
        canPublishArticle(item);
        publishBlockReason(item);
      }).not.toThrow();
    },
  );

  test("집계가 입력 건수를 보존하고 라벨을 채운다", () => {
    const { stages, mismatchCount } = summarizeStages(HOSTILE);
    expect(stages.reduce((sum, s) => sum + s.count, 0)).toBe(HOSTILE.length);
    expect(typeof mismatchCount).toBe("number");
    for (const stage of stages) {
      expect(stage.label).toBeTruthy();
      expect(stage.tone).toMatch(/^status-/);
    }
  });

  test("일괄 분리가 입력 건수를 보존한다", () => {
    const { publishable, blocked } = partitionPublishable(HOSTILE);
    expect(publishable.length + blocked.length).toBe(HOSTILE.length);
  });
});
