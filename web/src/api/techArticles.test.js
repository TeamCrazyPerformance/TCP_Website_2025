import { apiGet, apiPost } from "./client";
import {
  getAdminTechArticleStats,
  getTechArticle,
  getTechArticleSources,
  getAdminTechArticles,
  getCrawlRuns,
  getTechArticles,
  startCrawlRun,
  techArticleErrorMessage,
} from "./techArticles";

jest.mock("./client", () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("공개 목록 태그를 반복 쿼리로 전달한다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getTechArticles({
    page: 2,
    pageSize: 20,
    keyword: "React 상태",
    tags: ["AI", "보안"],
  });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/tech-articles?page=2&pageSize=20&keyword=React+%EC%83%81%ED%83%9C&tags=AI&tags=%EB%B3%B4%EC%95%88",
  );
});

test("상세 조회는 요청받은 경우에만 조회수 집계 신호를 보낸다", async () => {
  apiGet.mockResolvedValue({ id: "article-1" });

  await getTechArticle("article 1", { recordView: true });
  expect(apiGet).toHaveBeenLastCalledWith(
    "/api/v1/tech-articles/article%201?recordView=true",
  );

  await getTechArticle("article 1");
  expect(apiGet).toHaveBeenLastCalledWith("/api/v1/tech-articles/article%201");
});

test("수집 요청에 멱등성 키를 헤더로 보낸다", async () => {
  const payload = {
    source: { sourceId: "infoq", sourceType: "RSS", sectionKey: "NEWS" },
  };
  apiPost.mockResolvedValue({ crawlRunId: "crawl-1" });

  await startCrawlRun(payload, "crawl-key-1");

  expect(apiPost).toHaveBeenCalledWith(
    "/api/v1/admin/tech-articles/crawl-runs",
    payload,
    { headers: { "Idempotency-Key": "crawl-key-1" } },
  );
});

test("크롤링 실행 이력 필터를 관리자 API로 보낸다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getCrawlRuns({
    page: 2,
    pageSize: 20,
    status: "RUNNING",
    sourceId: "infoq",
    trigger: "SCHEDULED",
  });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/admin/tech-articles/crawl-runs?page=2&pageSize=20&status=RUNNING&sourceId=infoq&trigger=SCHEDULED",
  );
});

test("파이프라인 장애를 사용자 안내 문구로 바꾼다", () => {
  expect(
    techArticleErrorMessage({ response: { status: 503, data: {} } }),
  ).toContain("일시적으로 응답하지 않습니다");
});

test("관리자 목록이 단계와 표시 오류를 서버 쿼리로 보낸다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getAdminTechArticles({
    page: 2,
    pageSize: 20,
    stage: "QUALITY_REVIEW",
  });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/admin/tech-articles?page=2&pageSize=20&stage=QUALITY_REVIEW&sort=NEWEST",
  );

  await getAdminTechArticles({ statusMismatch: true });
  expect(apiGet).toHaveBeenLastCalledWith(
    "/api/v1/admin/tech-articles?page=1&pageSize=20&statusMismatch=true&sort=NEWEST",
  );
});

test("단계를 고르지 않으면 쿼리에 실리지 않는다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getAdminTechArticles({ page: 1, pageSize: 20 });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/admin/tech-articles?page=1&pageSize=20&sort=NEWEST",
  );
});

test("통계도 목록과 같은 조건으로 센다", async () => {
  apiGet.mockResolvedValue({});

  await getAdminTechArticleStats({
    keyword: "React",
    publicationStatus: "HIDDEN",
  });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/admin/tech-articles/stats?keyword=React&publicationStatus=HIDDEN",
  );

  await getAdminTechArticleStats();
  expect(apiGet).toHaveBeenLastCalledWith("/api/v1/admin/tech-articles/stats");
});

test("공개 목록이 소스를 반복 쿼리로 전달한다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getTechArticles({
    page: 1,
    pageSize: 20,
    tags: ["AI"],
    sources: ["infoq", "cloudflare-blog"],
  });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/tech-articles?page=1&pageSize=20&tags=AI&sources=infoq&sources=cloudflare-blog",
  );
});

test("소스를 고르지 않으면 쿼리에 실리지 않는다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getTechArticles({ page: 1, pageSize: 20 });

  expect(apiGet).toHaveBeenCalledWith(
    "/api/v1/tech-articles?page=1&pageSize=20",
  );
});

test("소스 목록은 별도 엔드포인트에서 받는다", async () => {
  apiGet.mockResolvedValue({ items: [] });

  await getTechArticleSources();

  expect(apiGet).toHaveBeenCalledWith("/api/v1/tech-articles/sources");
});
