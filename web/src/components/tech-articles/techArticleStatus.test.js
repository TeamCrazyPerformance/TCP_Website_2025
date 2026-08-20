/* 공개 가능 여부 판정과 상태 어휘를 검증합니다.
 *
 * 공개 목록 쿼리는 processing_status = 'ENRICHED' 를 요구합니다.
 * 그 단계에 이르지 못한 아티클을 공개하면 관리자 화면만 "공개"가 되고
 * 실사이트에는 나타나지 않습니다. */
import {
  PROCESSING_STATUS_LABEL,
  PUBLICATION_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  canPublishArticle,
  hasPublicationMismatch,
  partitionPublishable,
  publishBlockReason,
  statusLabel,
  statusTone,
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

describe("모순 상태 탐지", () => {
  test("공개 상태인데 처리가 안 끝난 아티클을 잡아낸다", () => {
    expect(
      hasPublicationMismatch(
        article({
          publicationStatus: "PUBLISHED",
          processingStatus: "QUALITY_REJECTED",
        }),
      ),
    ).toBe(true);
  });

  test("정상 공개 건과 미공개 건은 잡지 않는다", () => {
    expect(
      hasPublicationMismatch(article({ publicationStatus: "PUBLISHED" })),
    ).toBe(false);
    expect(
      hasPublicationMismatch(
        article({
          publicationStatus: "HIDDEN",
          processingStatus: "QUALITY_REJECTED",
        }),
      ),
    ).toBe(false);
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
