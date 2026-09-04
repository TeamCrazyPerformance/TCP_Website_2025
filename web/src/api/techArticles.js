import { apiGet, apiPatch, apiPost } from "./client";

const PUBLIC_BASE = "/api/v1/tech-articles";
const ADMIN_BASE = "/api/v1/admin/tech-articles";

function withQuery(path, values = {}, repeatedValues = {}) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  Object.entries(repeatedValues).forEach(([key, valuesForKey]) => {
    valuesForKey?.forEach((value) => params.append(key, value));
  });

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function getTechArticles({
  page = 1,
  pageSize = 20,
  keyword,
  tags = [],
  sources = [],
} = {}) {
  return apiGet(
    withQuery(PUBLIC_BASE, { page, pageSize, keyword }, { tags, sources }),
  );
}

export function getTechArticleTags() {
  return apiGet(`${PUBLIC_BASE}/tags`);
}

export function getTechArticleSources() {
  return apiGet(`${PUBLIC_BASE}/sources`);
}

export function getTechArticle(articleId, { recordView = false } = {}) {
  return apiGet(
    withQuery(`${PUBLIC_BASE}/${encodeURIComponent(articleId)}`, {
      recordView: recordView ? true : undefined,
    }),
  );
}

export function getAdminTechArticles({
  page = 1,
  pageSize = 20,
  keyword,
  publicationStatus,
  stage,
  statusMismatch,
  sort = "NEWEST",
} = {}) {
  return apiGet(
    withQuery(ADMIN_BASE, {
      page,
      pageSize,
      keyword,
      publicationStatus,
      stage,
      statusMismatch,
      sort,
    }),
  );
}

export function getAdminTechArticleStats({ keyword, publicationStatus } = {}) {
  return apiGet(
    withQuery(`${ADMIN_BASE}/stats`, { keyword, publicationStatus }),
  );
}

export function getAdminTechArticle(articleId) {
  return apiGet(`${ADMIN_BASE}/${encodeURIComponent(articleId)}`);
}

export function getDuplicateReviews({
  page = 1,
  pageSize = 20,
  keyword,
  filter,
  sort = "NEWEST",
} = {}) {
  return apiGet(
    withQuery(`${ADMIN_BASE}/reviews/duplicates`, {
      page,
      pageSize,
      keyword,
      filter,
      sort,
    }),
  );
}

export function getQualityReviews(
  kind,
  { page = 1, pageSize = 20, keyword, filter, sort = "NEWEST" } = {},
) {
  if (!["quality", "rejected", "publication"].includes(kind)) {
    throw new Error("지원하지 않는 검수 큐입니다.");
  }
  return apiGet(
    withQuery(`${ADMIN_BASE}/reviews/${kind}`, {
      page,
      pageSize,
      keyword,
      filter,
      sort,
    }),
  );
}

export function changeArticlePublication(articleId, payload) {
  return apiPost(
    `${ADMIN_BASE}/${encodeURIComponent(articleId)}/publication-actions`,
    payload,
  );
}

export function changeArticlePublicationBulk(items) {
  return apiPost(`${ADMIN_BASE}/publication-actions/bulk`, { items });
}

export function reprocessArticle(articleId, payload) {
  return apiPost(
    `${ADMIN_BASE}/${encodeURIComponent(articleId)}/reprocessing`,
    payload,
  );
}

export function resolveDuplicateReview(caseId, payload) {
  return apiPost(
    `${ADMIN_BASE}/reviews/duplicates/${encodeURIComponent(caseId)}/resolutions`,
    payload,
  );
}

export function resolveDuplicateReviewsBulk(items) {
  return apiPost(`${ADMIN_BASE}/reviews/duplicates/resolutions/bulk`, {
    items,
  });
}

export function resolveQualityReview(caseId, payload) {
  return apiPost(
    `${ADMIN_BASE}/reviews/quality/${encodeURIComponent(caseId)}/resolutions`,
    payload,
  );
}

export function resolveQualityReviewsBulk(items) {
  return apiPost(`${ADMIN_BASE}/reviews/quality/resolutions/bulk`, { items });
}

export function getPublicationPolicy() {
  return apiGet(`${ADMIN_BASE}/publication-policy`);
}

export function updatePublicationPolicy(payload) {
  return apiPatch(`${ADMIN_BASE}/publication-policy`, payload);
}

export function getCrawlSources() {
  return apiGet(`${ADMIN_BASE}/crawl-sources`);
}

export function startCrawlRun(payload, idempotencyKey) {
  return apiPost(`${ADMIN_BASE}/crawl-runs`, payload, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getCrawlRuns({
  page = 1,
  pageSize = 20,
  status,
  sourceId,
  trigger,
} = {}) {
  return apiGet(
    withQuery(`${ADMIN_BASE}/crawl-runs`, {
      page,
      pageSize,
      status,
      sourceId,
      trigger,
    }),
  );
}

export function getCrawlRun(crawlRunId) {
  return apiGet(`${ADMIN_BASE}/crawl-runs/${encodeURIComponent(crawlRunId)}`);
}

export function isVersionConflict(error) {
  return (
    error?.response?.status === 409 ||
    error?.response?.data?.code === "VERSION_CONFLICT"
  );
}

export function techArticleErrorMessage(
  error,
  fallback = "요청을 처리하지 못했습니다.",
) {
  const data = error?.response?.data;
  if (
    data?.code === "TECH_ARTICLE_PIPELINE_UNAVAILABLE" ||
    error?.response?.status === 503
  ) {
    return "기술 아티클 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (data?.code === "VERSION_CONFLICT" || error?.response?.status === 409) {
    return "다른 관리자가 먼저 변경했습니다. 최신 데이터를 다시 불러왔습니다.";
  }
  if (Array.isArray(data?.message)) return data.message.join(" ");
  return data?.message || error?.message || fallback;
}
