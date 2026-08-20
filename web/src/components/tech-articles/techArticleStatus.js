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

export const STATUS_LABEL = {
  ...PROCESSING_STATUS_LABEL,
  ...REVIEW_STATUS_LABEL,
  ...PUBLICATION_STATUS_LABEL,
  // 목록 행에서 reviewStatus 부재 시 쓰는 대체값
  REVIEW_NOT_REQUIRED: "검토 불필요",
};

// status-failed 는 v9 번들에 없어 techArticlesAdminAlign.css 에서 정의합니다.
export const STATUS_TONE = {
  ENRICHED: "status-published",
  PUBLISHED: "status-published",
  APPROVED: "status-published",

  QUALITY_REJECTED: "status-failed",
  PROCESSING_FAILED: "status-failed",
  REJECTED: "status-failed",

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

// 관리자 화면은 공개인데 실사이트에는 없는 상태.
export function hasPublicationMismatch(article) {
  return (
    article?.publicationStatus === "PUBLISHED" && !canPublishArticle(article)
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
