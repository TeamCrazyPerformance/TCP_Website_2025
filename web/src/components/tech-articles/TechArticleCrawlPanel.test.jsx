import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  getCrawlRun,
  getCrawlSources,
  startCrawlRun,
} from "../../api/techArticles";
import TechArticleCrawlPanel from "./TechArticleCrawlPanel";

jest.mock("../../api/techArticles", () => ({
  getCrawlRun: jest.fn(),
  getCrawlSources: jest.fn(),
  startCrawlRun: jest.fn(),
  techArticleErrorMessage: jest.fn((_error, fallback) => fallback),
}));

describe("TechArticleCrawlPanel", () => {
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
    startCrawlRun.mockResolvedValue({
      crawlRunId: "crawl-github-1",
      status: "COMPLETED",
    });
  });

  it("renders and submits only the options declared by the GitHub catalog", async () => {
    render(<TechArticleCrawlPanel />);

    expect(await screen.findByText(/GitHub Trending/)).toBeInTheDocument();
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
});
