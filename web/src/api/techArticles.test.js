import { apiGet, apiPost } from "./client";
import {
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

test("파이프라인 장애를 사용자 안내 문구로 바꾼다", () => {
  expect(
    techArticleErrorMessage({ response: { status: 503, data: {} } }),
  ).toContain("일시적으로 응답하지 않습니다");
});
