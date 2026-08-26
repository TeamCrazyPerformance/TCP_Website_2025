import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  getCrawlRun,
  getCrawlRuns,
  getCrawlSources,
  startCrawlRun,
} from "../../api/techArticles";
import TechArticleCrawlPanel from "./TechArticleCrawlPanel";

jest.mock("../../api/techArticles", () => ({
  getCrawlRun: jest.fn(),
  getCrawlRuns: jest.fn(),
  getCrawlSources: jest.fn(),
  startCrawlRun: jest.fn(),
  techArticleErrorMessage: jest.fn((_error, fallback) => fallback),
}));

describe("TechArticleCrawlPanel", () => {
  // dialog 의 showModal/close 폴리필은 src/setupTests.js 에 있습니다.
  beforeEach(() => {
    jest.clearAllMocks();
    getCrawlSources.mockResolvedValue({
      items: [
        {
          sourceId: "github-trending",
          name: "GitHub Trending",
          domain: "github.com",
          capabilities: [
            { sourceType: "WEB_CRAWL", sectionKey: "REPOSITORIES" },
          ],
          crawlOptions: {
            maximumArticleCount: { default: 3, minimum: 1, maximum: 3 },
            requestTimeoutMs: {
              default: 15000,
              minimum: 1000,
              maximum: 60000,
            },
          },
        },
      ],
    });
    getCrawlRuns.mockResolvedValue({
      items: [],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 0 },
    });
    startCrawlRun.mockResolvedValue({
      crawlRunId: "crawl-github-1",
      status: "COMPLETED",
    });
  });

  it("renders and submits only the options declared by the GitHub catalog", async () => {
    render(<TechArticleCrawlPanel />);

    expect(
      (await screen.findAllByText(/GitHub Trending/)).length,
    ).toBeGreaterThan(0);
    const articleCount = screen.getByLabelText("최대 아티클 수");
    expect(articleCount).toHaveAttribute("max", "3");
    await waitFor(() => expect(articleCount).toHaveValue(3));
    expect(
      screen.queryByLabelText("최대 원문 나이 (시간)"),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("최대 페이지 수")).not.toBeInTheDocument();
    expect(screen.queryByText("페이지네이션 따라가기")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /수집 시작/ }));

    await waitFor(() => expect(startCrawlRun).toHaveBeenCalledTimes(1));
    expect(startCrawlRun).toHaveBeenCalledWith(
      {
        source: {
          sourceId: "github-trending",
          sourceType: "WEB_CRAWL",
          sectionKey: "REPOSITORIES",
        },
        crawlOptions: {
          maximumArticleCount: 3,
          requestTimeoutMs: 15000,
        },
      },
      expect.any(String),
    );
    expect(getCrawlRun).not.toHaveBeenCalled();
  });

  it("keeps the runner visible under the history without a toggle", async () => {
    render(<TechArticleCrawlPanel />);

    const historyTitle = await screen.findByText("크롤링 실행 이력");
    const history = historyTitle.closest("section");
    const runner = await screen.findByRole("heading", {
      name: "비동기 수집 실행",
    });

    expect(history.nextElementSibling).toBe(runner.closest("form"));
    expect(
      screen.queryByRole("button", { name: "실행 설정 닫기" }),
    ).not.toBeInTheDocument();
    // 상세는 팝업으로만 열리므로 처음에는 실행 정보가 그려지지 않습니다.
    expect(screen.queryByText("실행 ID")).not.toBeInTheDocument();
  });

  it("restores scheduled crawl history and opens a selected run", async () => {
    getCrawlRuns.mockResolvedValue({
      items: [
        {
          crawlRunId: "crawl-auto-1",
          sourceId: "github-trending",
          sourceType: "WEB_CRAWL",
          sectionKey: "REPOSITORIES",
          trigger: "SCHEDULED",
          status: "RUNNING",
          statistics: null,
          itemCount: 0,
          createdAt: "2026-08-22T01:00:00Z",
          startedAt: "2026-08-22T01:00:01Z",
          job: { attemptCount: 1, maxAttempts: 3, status: "RUNNING" },
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    });
    getCrawlRun.mockResolvedValue({
      crawlRunId: "crawl-auto-1",
      sourceId: "github-trending",
      trigger: "SCHEDULED",
      status: "RUNNING",
      statistics: null,
      itemCount: 0,
      job: { attemptCount: 1, maxAttempts: 3, status: "RUNNING" },
      items: [],
    });

    render(<TechArticleCrawlPanel />);

    expect(await screen.findByText("크롤링 실행 이력")).toBeInTheDocument();
    expect(
      screen.getByLabelText("크롤링 실행 이력 총 1건"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "수동 실행과 자동 스케줄 실행을 최신순으로 확인합니다.",
      ),
    ).not.toBeInTheDocument();
    expect((await screen.findAllByText("자동")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("실행 중").length).toBeGreaterThan(0);
    expect(screen.getAllByText("결과 집계 전").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "실행 중에는 서버 상태만 제공되며 수집 건수는 종료 후 집계됩니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "github-trending 실행 상세 보기" }),
    );
    await waitFor(() =>
      expect(getCrawlRun).toHaveBeenCalledWith("crawl-auto-1"),
    );
    expect(await screen.findByText("crawl-auto-1")).toBeInTheDocument();
    expect(screen.getByText("실행 ID")).toBeInTheDocument();
  });

  it("shows only the final statistics guaranteed by the crawler contract", async () => {
    getCrawlRuns.mockResolvedValue({
      items: [
        {
          crawlRunId: "crawl-completed-1",
          sourceId: "github-trending",
          sourceType: "WEB_CRAWL",
          sectionKey: "REPOSITORIES",
          trigger: "MANUAL",
          status: "COMPLETED",
          itemCount: 3,
          createdAt: "2026-08-22T01:00:00Z",
          startedAt: "2026-08-22T01:00:01Z",
          completedAt: "2026-08-22T01:00:12Z",
          statistics: {
            pagesVisited: 1,
            articlesDiscovered: 3,
            articlesExcludedByAge: 0,
            articlesAttempted: 3,
            articlesSucceeded: 3,
            articlesFailed: 0,
            normalizationsSucceeded: 3,
          },
          job: { attemptCount: 1, maxAttempts: 3, status: "SUCCEEDED" },
        },
      ],
      pagination: { currentPage: 1, totalPages: 1, totalCount: 1 },
    });

    render(<TechArticleCrawlPanel />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "github-trending 실행 상세 보기",
      }),
    );

    expect(await screen.findByText("최종 수집 통계")).toBeInTheDocument();
    expect(screen.getByText("3건 성공")).toBeInTheDocument();
    expect(screen.getByText("수집 성공")).toBeInTheDocument();
    expect(screen.queryByText("정규화 성공")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("loads crawl history with server-side pagination", async () => {
    getCrawlRuns.mockImplementation(({ page }) =>
      Promise.resolve({
        items: [
          {
            crawlRunId: `crawl-page-${page}`,
            sourceId: page === 1 ? "github-trending" : "infoq",
            sourceType: page === 1 ? "WEB_CRAWL" : "RSS",
            sectionKey: page === 1 ? "REPOSITORIES" : "NEWS",
            trigger: "MANUAL",
            status: "COMPLETED",
            itemCount: 3,
            createdAt: "2026-08-22T01:00:00Z",
            startedAt: "2026-08-22T01:00:01Z",
            completedAt: "2026-08-22T01:00:12Z",
            statistics: {
              articlesSucceeded: 3,
              articlesFailed: 0,
            },
            job: { attemptCount: 1, maxAttempts: 3, status: "SUCCEEDED" },
          },
        ],
        pagination: {
          currentPage: page,
          totalPages: 2,
          totalCount: 24,
          pageSize: 20,
        },
      }),
    );

    render(<TechArticleCrawlPanel />);

    expect(
      await screen.findByLabelText("크롤링 실행 이력 총 24건"),
    ).toBeInTheDocument();
    expect(screen.getByText("페이지당 20건")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(getCrawlRuns).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 }),
      ),
    );
    expect(await screen.findByText("infoq")).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "infoq 실행 상세 보기" }),
    );
    expect(await screen.findByText("crawl-page-2")).toBeInTheDocument();
  });

  it("returns to the last valid page when filtered history shrinks", async () => {
    getCrawlRuns.mockImplementation(({ page }) => {
      if (page === 2) {
        return Promise.resolve({
          items: [],
          pagination: {
            currentPage: 2,
            totalPages: 1,
            totalCount: 1,
            pageSize: 20,
          },
        });
      }
      return Promise.resolve({
        items: [
          {
            crawlRunId: "crawl-page-1",
            sourceId: "github-trending",
            trigger: "MANUAL",
            status: "COMPLETED",
            itemCount: 1,
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 2,
          totalCount: 21,
          pageSize: 20,
        },
      });
    });

    render(<TechArticleCrawlPanel />);
    await screen.findByRole("button", {
      name: "github-trending 실행 상세 보기",
    });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(getCrawlRuns).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
      expect(getCrawlRuns).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 }),
      );
    });
  });

  it("pauses polling in a hidden tab and refreshes when it becomes visible", async () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    let visibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    jest.useFakeTimers();
    const view = render(<TechArticleCrawlPanel />);

    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(getCrawlRuns).toHaveBeenCalledTimes(1);
      getCrawlRuns.mockClear();

      act(() => jest.advanceTimersByTime(60000));
      expect(getCrawlRuns).not.toHaveBeenCalled();

      visibilityState = "visible";
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
        await Promise.resolve();
      });
      expect(getCrawlRuns).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      jest.useRealTimers();
      if (originalVisibility) {
        Object.defineProperty(document, "visibilityState", originalVisibility);
      }
    }
  });
});
