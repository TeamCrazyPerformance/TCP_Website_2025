
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
  REVIEW_NOT_REQUIRED: "검토 불필요",
};

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

export const PUBLISHABLE_PROCESSING_STATUS = "ENRICHED";

const DECISION_TONE = {
  PASS: "score-pass",
  REVIEW_REQUIRED: "score-review",
  REJECT: "score-reject",
};

export function scoreTone(article) {
  const decision = article?.evaluation?.decision ?? article?.qualityDecision;
  return DECISION_TONE[decision] || "score-unknown";
}

const SCORE_TONE_LABEL = {
  "score-pass": "AI 요약 자동 생성 대상",
  "score-review": "관리자 승인 후 AI 요약 가능",
  "score-reject": "AI 요약 생성 제외",
  "score-unknown": "품질 평가 전",
};

export function scoreToneLabel(article) {
  return SCORE_TONE_LABEL[scoreTone(article)];
}

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

const STAGE_META = {
  [STAGE.INGESTED]: {
    waiting: true,
    order: 0,
    label: "자동 품질 평가 중",
    tone: "status-processing",
    icon: "fa-inbox",
  },
  [STAGE.QUALITY_REVIEW]: {
    waiting: true,
    order: 1,
    label: "품질 검토 필요",
    tone: "status-pending",
    icon: "fa-user-check",
    hint: "관리자 판단을 기다립니다.",
  },
  [STAGE.ENRICHING]: {
    waiting: true,
    order: 2,
    label: "AI 요약 중",
    tone: "status-processing",
    icon: "fa-wand-magic-sparkles",
  },
  [STAGE.PUBLICATION_REVIEW]: {
    waiting: true,
    order: 3,
    label: "공개 검토 필요",
    tone: "status-pending",
    icon: "fa-user-check",
    hint: "요약까지 끝났고 공개 승인을 기다립니다.",
  },
  [STAGE.COMPLETED]: {
    order: 4,
    label: "처리 완료",
    tone: "status-published",
    icon: "fa-circle-check",
  },
  [STAGE.FAILED_AFTER_APPROVAL]: {
    terminal: true,
    order: 5,
    label: "승인 후 요약 실패",
    tone: "status-failed",
    icon: "fa-rotate-right",
    hint: "관리자 승인은 정상입니다. AI 요약 작업만 실패해 재처리가 필요합니다.",
  },
  [STAGE.FAILED]: {
    terminal: true,
    order: 6,
    label: "처리 실패",
    tone: "status-failed",
    icon: "fa-circle-xmark",
    hint: "파이프라인이 중단되었습니다.",
  },
  [STAGE.QUALITY_REJECTED]: {
    terminal: true,
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

export const STAGE_ORDER = Object.entries(STAGE_META)
  .filter(([stage]) => stage !== STAGE.UNKNOWN)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([stage]) => stage);

export function formatWaiting(value, now = Date.now()) {
  if (!value) return null;
  const started = new Date(value).getTime();
  if (Number.isNaN(started)) return null;
  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}일 ${restHours}시간` : `${days}일`;
}

export const STAGE_WAITING = STAGE_ORDER.filter(
  (stage) => STAGE_META[stage].waiting,
);

export const STAGE_FLOW = STAGE_ORDER.filter(
  (stage) => !STAGE_META[stage].terminal,
);
export const STAGE_EXIT = STAGE_ORDER.filter(
  (stage) => STAGE_META[stage].terminal,
);

export function resolveStage(article) {
  return article?.stage || articleStage(article);
}

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
