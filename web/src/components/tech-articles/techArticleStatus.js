// src/components/tech-articles/techArticleStatus.js
//
// Tech Articles 관리 화면의 상태 어휘와 공개 가능 여부 판정을 모읍니다.
//
// 아티클 상태는 서로 독립된 세 축입니다.
//   processingStatus  파이프라인 진행 단계
//   reviewStatus      관리자 검토
//   publicationStatus 노출 여부
// 세 축의 값 집합은 서로 겹치지 않아 라벨은 단일 표로 관리합니다.

// 정상 경로는 INGESTED -> QUALITY_EVALUATED -> ENRICHMENT_PENDING -> ENRICHED 순.
export const PROCESSING_STATUS_LABEL = {
  INGESTED: "수집 완료",
  QUALITY_EVALUATED: "품질 검토 대기",
  QUALITY_REJECTED: "품질 미달",
  ENRICHMENT_PENDING: "AI 요약 대기",
  ENRICHED: "처리 완료",
  PROCESSING_FAILED: "처리 실패",
};

export const REVIEW_STATUS_LABEL = {
  NOT_REQUIRED: "검토 불필요",
  PENDING: "검토 대기",
  IN_REVIEW: "검토 중",
  APPROVED: "검토 승인",
  REJECTED: "검토 반려",
  CHANGES_REQUESTED: "수정 요청",
};

export const PUBLICATION_STATUS_LABEL = {
  UNPUBLISHED: "미공개",
  SCHEDULED: "공개 예정",
  PUBLISHED: "공개",
  HIDDEN: "비공개",
  ARCHIVED: "보관",
};

// 품질 평가 판정. 상태 3축과 별개 어휘입니다.
const QUALITY_DECISION_LABEL = {
  PASS: "기준 통과",
  REVIEW_REQUIRED: "관리자 검토 필요",
  REJECT: "기준 미달",
};

export const STATUS_LABEL = {
  ...PROCESSING_STATUS_LABEL,
  ...REVIEW_STATUS_LABEL,
  ...PUBLICATION_STATUS_LABEL,
  ...QUALITY_DECISION_LABEL,
  // 목록 행에서 reviewStatus 부재 시 쓰는 대체값
  REVIEW_NOT_REQUIRED: "검토 불필요",
};

// status-failed 는 v9 번들에 없어 techArticlesAdminAlign.css 에서 정의합니다.
export const STATUS_TONE = {
  ENRICHED: "status-published",
  PUBLISHED: "status-published",
  APPROVED: "status-published",

  PASS: "status-published",

  QUALITY_REJECTED: "status-failed",
  PROCESSING_FAILED: "status-failed",
  REJECTED: "status-failed",
  REJECT: "status-failed",

  REVIEW_REQUIRED: "status-pending",

  QUALITY_EVALUATED: "status-pending",
  PENDING: "status-pending",
  IN_REVIEW: "status-pending",
  CHANGES_REQUESTED: "status-pending",
  SCHEDULED: "status-pending",

  HIDDEN: "status-hidden",
  ARCHIVED: "status-hidden",
  UNPUBLISHED: "status-unpublished",
  NOT_REQUIRED: "status-unpublished",
  REVIEW_NOT_REQUIRED: "status-unpublished",
};

// 공개 목록 쿼리가 요구하는 단계. 이 값이 아니면 공개해도 실사이트에 뜨지 않습니다.
export const PUBLISHABLE_PROCESSING_STATUS = "ENRICHED";

const PUBLISH_BLOCK_REASON = {
  QUALITY_REJECTED: "품질 기준 미달 — 공개 불가",
  PROCESSING_FAILED: "처리 실패 — 공개 불가",
  QUALITY_EVALUATED: "품질 검토 대기 중",
  ENRICHMENT_PENDING: "AI 요약 생성 중",
  INGESTED: "품질 평가 대기 중",
};

export function statusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  return STATUS_LABEL[normalized] || status || "확인 중";
}

export function statusTone(status) {
  const normalized = String(status || "").toUpperCase();
  return STATUS_TONE[normalized] || "status-processing";
}

export function canPublishArticle(article) {
  return article?.processingStatus === PUBLISHABLE_PROCESSING_STATUS;
}

export function publishBlockReason(article) {
  if (canPublishArticle(article)) return null;
  const status = String(article?.processingStatus || "").toUpperCase();
  return PUBLISH_BLOCK_REASON[status] || "처리 미완료 — 공개 불가";
}

// 정상 승인(resolve_quality_review APPROVE)은 processing_status 를
// ENRICHMENT_PENDING 으로 함께 올린 뒤 요약 작업을 넣습니다. 따라서 APPROVED 는
// 아래 세 단계와만 공존할 수 있습니다.
//   ENRICHMENT_PENDING  승인 직후, 요약 대기
//   ENRICHED            요약 성공
//   PROCESSING_FAILED   요약 실패 (승인 자체는 정상. 재처리 대상)
// 나머지와 함께 있으면 공개 액션이 올린 값입니다.
// (apply_publication_action 이 PUBLISH 때 review_status 를 APPROVED 로 승격)
//
// 표시상의 오류일 뿐 파이프라인 동작에는 영향이 없습니다. AI 요약 자격은
// quality_review_cases 를 읽고, 공개 검토 큐와 공개 목록은 ENRICHED 를 함께
// 요구하므로 이 아티클들은 어느 쪽에도 들어가지 않습니다.
const APPROVED_COMPATIBLE = [
  "ENRICHMENT_PENDING",
  "ENRICHED",
  "PROCESSING_FAILED",
];

export function hasStateMismatch(article) {
  return (
    article?.reviewStatus === "APPROVED" &&
    !APPROVED_COMPATIBLE.includes(article?.processingStatus)
  );
}

export function partitionPublishable(articles = []) {
  const publishable = [];
  const blocked = [];
  for (const article of articles) {
    (canPublishArticle(article) ? publishable : blocked).push(article);
  }
  return { publishable, blocked };
}

// ── 파이프라인 단계 ────────────────────────────────────────
// 세 축을 관리자가 바로 읽을 수 있는 단일 축으로 접습니다.
// 배지 3개를 나란히 두면 매번 조합을 해석해야 하므로 목록에서는 이 값만 씁니다.
// 원본 세 축은 상세 패널에서 그대로 보여줍니다.

// 표시 오류 표식. 단계가 아니라 단계 위에 얹는 깃발입니다.
// 단계를 대체하면 아티클이 어디서 멈췄는지가 가려집니다.
export const MISMATCH_FILTER = "MISMATCH";

export const STAGE = {
  INGESTED: "INGESTED",
  QUALITY_REVIEW: "QUALITY_REVIEW",
  ENRICHING: "ENRICHING",
  PUBLICATION_REVIEW: "PUBLICATION_REVIEW",
  FAILED_AFTER_APPROVAL: "FAILED_AFTER_APPROVAL",
  COMPLETED: "COMPLETED",
  QUALITY_REJECTED: "QUALITY_REJECTED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
};

// order 는 목록 정렬과 요약 바 표기 순서. 정상 파이프라인 진행 단계를 먼저
// 시간순으로 보여주고, 실패·종료 상태는 그 뒤에 둡니다.
const STAGE_META = {
  [STAGE.INGESTED]: {
    order: 0,
    label: "자동 품질 평가 중",
    tone: "status-processing",
    icon: "fa-inbox",
  },
  [STAGE.QUALITY_REVIEW]: {
    order: 1,
    label: "관리자 품질 검토 필요",
    tone: "status-pending",
    icon: "fa-user-check",
    hint: "관리자 판단을 기다립니다.",
  },
  [STAGE.ENRICHING]: {
    order: 2,
    label: "AI 요약 중",
    tone: "status-processing",
    icon: "fa-wand-magic-sparkles",
  },
  [STAGE.PUBLICATION_REVIEW]: {
    order: 3,
    label: "공개 검토 필요",
    tone: "status-pending",
    icon: "fa-user-check",
    hint: "요약까지 끝났고 공개 승인을 기다립니다.",
  },
  // 노출 여부는 "공개 상태" 필터가 담당합니다. 여기서 나누면 이름이 겹쳐
  // 같은 라벨의 두 컨트롤이 서로 다른 개수를 보여주게 됩니다.
  [STAGE.COMPLETED]: {
    order: 4,
    label: "처리 완료",
    tone: "status-published",
    icon: "fa-circle-check",
  },
  // 관리자 승인까지 끝난 뒤 요약만 실패한 건. 승인 판단이 이미 있어
  // 재처리 대상이므로 일반 실패와 구분합니다.
  [STAGE.FAILED_AFTER_APPROVAL]: {
    order: 5,
    label: "승인 후 요약 실패",
    tone: "status-failed",
    icon: "fa-rotate-right",
    hint: "관리자 승인은 정상입니다. AI 요약 작업만 실패해 재처리가 필요합니다.",
  },
  [STAGE.FAILED]: {
    order: 6,
    label: "처리 실패",
    tone: "status-failed",
    icon: "fa-circle-xmark",
    hint: "파이프라인이 중단되었습니다.",
  },
  [STAGE.QUALITY_REJECTED]: {
    order: 7,
    label: "품질 미달",
    tone: "status-failed",
    icon: "fa-ban",
    hint: "품질 기준에 미달해 종료되었습니다.",
  },
  [STAGE.UNKNOWN]: {
    order: 8,
    label: "확인 중",
    tone: "status-processing",
    icon: "fa-circle-question",
  },
};

// 표시 오류와 무관하게 아티클이 실제로 멈춘 지점을 돌려줍니다.
export function articleStage(article) {
  switch (article?.processingStatus) {
    case "PROCESSING_FAILED":
      return article.reviewStatus === "APPROVED"
        ? STAGE.FAILED_AFTER_APPROVAL
        : STAGE.FAILED;
    case "QUALITY_REJECTED":
      return STAGE.QUALITY_REJECTED;
    case "QUALITY_EVALUATED":
      return STAGE.QUALITY_REVIEW;
    case "ENRICHMENT_PENDING":
      return STAGE.ENRICHING;
    case "INGESTED":
      return STAGE.INGESTED;
    case "ENRICHED":
      // 공개 검토 대기만 남깁니다. 관리자 조치가 필요한 상태라 노출 축과 별개입니다.
      return article.reviewStatus === "PENDING" &&
        article.publicationStatus === "UNPUBLISHED"
        ? STAGE.PUBLICATION_REVIEW
        : STAGE.COMPLETED;
    default:
      return STAGE.UNKNOWN;
  }
}

export function stageMeta(stage) {
  return STAGE_META[stage] || STAGE_META[STAGE.UNKNOWN];
}

// 요약 바용 집계. 단계는 order 순으로, 표시 오류는 별도로 셉니다.
export function summarizeStages(articles = []) {
  const counts = new Map();
  let mismatchCount = 0;
  for (const article of articles) {
    const stage = articleStage(article);
    counts.set(stage, (counts.get(stage) || 0) + 1);
    if (hasStateMismatch(article)) mismatchCount += 1;
  }
  const stages = [...counts.entries()]
    .map(([stage, count]) => ({ stage, count, ...stageMeta(stage) }))
    .sort((a, b) => a.order - b.order);
  return { stages, mismatchCount };
}
