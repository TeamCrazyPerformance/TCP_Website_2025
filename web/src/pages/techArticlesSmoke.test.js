/* Tech Articles 공개·관리 화면의 렌더 스모크 테스트입니다.
 *
 * 셸 통합과 Shadow DOM 제거 과정에서 생기는 배선 오류는 빌드를 통과하고
 * 런타임에서만 드러납니다. 실제로 이 테스트로 사문이 된 <V9PublicFooter /> 와
 * shadowRoot 조회 잔재를 찾아냈습니다.
 *
 * API 는 모킹하며, 엔드포인트 정합성은 백엔드 라우트 대조로 따로 확인합니다. */
import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

let mockNavigationType = "PUSH";
let mockLocation = {
  pathname: "/tech-articles",
  search: "",
  state: null,
  key: "list-key",
};

jest.mock(
  "react-router-dom",
  () => {
    const ReactLib = require("react");
    const setSearchParams = jest.fn();
    const params = { articleId: "article-1" };
    const navigate = jest.fn();
    return {
      __esModule: true,
      Link: ({ to, children, ...rest }) =>
        ReactLib.createElement("a", { href: String(to), ...rest }, children),
      NavLink: ({ to, children, ...rest }) =>
        ReactLib.createElement("a", { href: String(to), ...rest }, children),
      useNavigate: () => navigate,
      useSearchParams: () => {
        const [searchParams, updateSearchParams] = ReactLib.useState(
          () => new URLSearchParams(),
        );
        const update = ReactLib.useCallback((next) => {
          setSearchParams(next);
          updateSearchParams(new URLSearchParams(next));
        }, []);
        return ReactLib.useMemo(
          () => [searchParams, update],
          [searchParams, update],
        );
      },
      useParams: () => params,
      useLocation: () => mockLocation,
      useNavigationType: () => mockNavigationType,
    };
  },
  { virtual: true },
);

jest.mock("../api/techArticles");

const api = require("../api/techArticles");
const { AuthProvider } = require("../context/AuthContext");

const PAGINATION = { page: 1, pageSize: 20, totalCount: 0, totalPages: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockNavigationType = "PUSH";
  mockLocation = {
    pathname: "/tech-articles",
    search: "",
    state: null,
    key: "list-key",
  };
  Object.defineProperty(window.history, "scrollRestoration", {
    configurable: true,
    writable: true,
    value: "auto",
  });

  api.getTechArticles.mockResolvedValue({ items: [], pagination: PAGINATION });
  api.getTechArticleTags.mockResolvedValue({ items: ["AI", "데이터"] });
  api.getTechArticleSources.mockResolvedValue({
    items: [
      {
        id: "infoq",
        name: "InfoQ",
        domain: "infoq.com",
        category: "업계 뉴스",
        count: 3,
      },
    ],
  });
  api.getTechArticle.mockResolvedValue(null);

  api.getAdminTechArticles.mockResolvedValue({
    items: [],
    pagination: PAGINATION,
  });
  api.getAdminTechArticleStats.mockResolvedValue({
    totalCount: 0,
    publication: {},
    reviews: {},
  });
  api.getDuplicateReviews.mockResolvedValue({
    items: [],
    pagination: PAGINATION,
  });
  api.getQualityReviews.mockResolvedValue({
    items: [],
    pagination: PAGINATION,
  });
  api.getPublicationPolicy.mockResolvedValue({ policy: "REVIEW", version: 1 });
  api.getCrawlSources.mockResolvedValue({ items: [] });
  api.getCrawlRuns.mockResolvedValue({
    items: [],
    pagination: PAGINATION,
  });
  api.techArticleErrorMessage.mockImplementation((_e, fallback) => fallback);
  api.isVersionConflict.mockReturnValue(false);
});

function renderWithAuth(ui) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

// AdminLayout 이 인증 경계 담당. 단독 렌더에는 세션만 주입.
function asAdmin() {
  localStorage.setItem("access_token", "test-token");
  localStorage.setItem(
    "auth_user",
    JSON.stringify({ name: "테스트관리자", role: "ADMIN" }),
  );
}

describe("공개 화면", () => {
  test("15개 분야 태그가 서로 다른 팔레트 클래스를 사용한다", () => {
    const { v9TagClassName } = require("./TechArticles");
    const tags = [
      "AI",
      "애플리케이션 개발",
      "모바일",
      "프로그래밍 언어",
      "데이터",
      "클라우드",
      "DevOps",
      "보안",
      "네트워크",
      "소프트웨어 아키텍처",
      "개발자 도구",
      "소프트웨어 품질",
      "오픈소스",
      "개발 조직",
      "산업 동향",
    ];

    expect(new Set(tags.map(v9TagClassName)).size).toBe(tags.length);
  });

  test("아티클 목록이 .ta-public 스코프로 렌더되고 목록을 요청한다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);

    await waitFor(() => expect(api.getTechArticles).toHaveBeenCalled());

    expect(container.querySelector(".ta-public")).not.toBeNull();
    // 목업 사이트 헤더·푸터 -> 공용 Header/Footer
    expect(container.querySelector(".site-header")).toBeNull();
    expect(container.querySelector(".site-footer")).toBeNull();
    expect(container.querySelector("[class*='v9-shadow-host']")).toBeNull();
    expect(
      screen.getByRole("button", { name: /\uC18C\uC2A4 \uC120\uD0DD/ }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".source-dialog-header h2"),
    ).toHaveTextContent("소스 선택");
    expect(screen.queryByText("모든 소스")).not.toBeInTheDocument();
    expect(screen.queryByText("소스 고르기")).not.toBeInTheDocument();
  });

  test("페이지 이동은 새 목록을 받은 뒤 애니메이션 없이 상단으로 이동한다", async () => {
    const initialResponse = {
      items: [],
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 40,
        totalPages: 2,
      },
    };
    const pageTwoResponse = {
      ...initialResponse,
      pagination: { ...initialResponse.pagination, currentPage: 2 },
    };
    let resolvePageTwo;
    api.getTechArticles.mockImplementation(({ page }) => {
      if (page === 2) {
        return new Promise((resolve) => {
          resolvePageTwo = resolve;
        });
      }
      return Promise.resolve(initialResponse);
    });
    const scrollIntoView = jest.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const TechArticles = require("./TechArticles").default;
    renderWithAuth(<TechArticles />);

    fireEvent.click(await screen.findByRole("button", { name: "다음 페이지" }));
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    await act(async () => resolvePageTwo(pageTwoResponse));

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "start",
      }),
    );
  });

  test("브라우저 뒤로가기는 목록 로딩 후 읽던 아티클 카드 위치를 복원한다", async () => {
    api.getTechArticles.mockResolvedValue({
      items: [
        {
          id: "article-1",
          title: "복원할 아티클",
          oneLineSummary: "스크롤 복원 테스트",
          tags: ["AI"],
          source: { name: "InfoQ" },
          originalPublishedAt: "2026-08-25T00:00:00Z",
        },
      ],
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
      },
    });

    let cardTop = 240;
    const originalGetBoundingClientRect =
      Element.prototype.getBoundingClientRect;
    Object.defineProperty(Element.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function getBoundingClientRect() {
        if (this.matches?.(".article-card[data-article-id]")) {
          return { top: cardTop };
        }
        return originalGetBoundingClientRect.call(this);
      },
    });
    const scrollTo = jest.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });

    const TechArticles = require("./TechArticles").default;
    const firstRender = renderWithAuth(<TechArticles />);
    const articleLink = await screen.findByRole("link", {
      name: "복원할 아티클",
    });
    fireEvent.click(articleLink.closest("article"));

    expect(window.history.scrollRestoration).toBe("manual");
    expect(sessionStorage.length).toBe(1);
    firstRender.unmount();

    mockNavigationType = "POP";
    cardTop = 900;
    renderWithAuth(<TechArticles />);

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({
        top: 660,
        behavior: "auto",
      }),
    );
    expect(window.history.scrollRestoration).toBe("auto");
    expect(sessionStorage.length).toBe(0);

    Object.defineProperty(Element.prototype, "getBoundingClientRect", {
      configurable: true,
      value: originalGetBoundingClientRect,
    });
  });

  test("아티클 상세가 .ta-public 스코프로 렌더된다", async () => {
    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    await waitFor(() =>
      expect(container.querySelector(".ta-public")).not.toBeNull(),
    );
    expect(container.querySelector(".detail-main")).not.toBeNull();
    expect(container.querySelector(".site-footer")).toBeNull();
  });

  test("비로그인 상세는 요약과 출처를 보여주고 점수만 잠근다", async () => {
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "공개 아티클",
      oneLineSummary: "로그인 없이 읽는 한 줄 요약",
      summaryMarkdown: "로그인 없이 읽는 상세 요약",
      tags: ["AI"],
      source: {
        name: "InfoQ",
        domain: "infoq.com",
        path: "/article-1",
        articleUrl: "https://infoq.com/article-1",
      },
      originalLanguage: { code: "ko", label: "한국어" },
      originalPublishedAt: "2026-08-25T00:00:00Z",
      collectedAt: "2026-08-25T01:00:00Z",
    });
    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    await waitFor(() => expect(api.getTechArticle).toHaveBeenCalled());
    expect(
      screen.queryByRole("heading", { name: "핵심 요약" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(
        ".summary-card > .detail-one-line-summary:first-child",
      ),
    ).not.toBeNull();
    expect(screen.getByText("로그인 없이 읽는 상세 요약")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "원문 및 출처 정보" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("로그인하면 가치 점수도 확인할 수 있어요."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/가중치를 확인/)).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /로그인하고 점수 보기/ }),
    ).toBeInTheDocument();
  });

  test("로그인 상세는 서버가 보낸 평가 축과 기여도를 보여준다", async () => {
    localStorage.setItem("access_token", "member-token");
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "회원 아티클",
      summaryMarkdown: "회원 상세 요약",
      tags: [],
      evaluation: {
        score: {
          overall: 88,
          scale: { min: 0, max: 100 },
          axes: [
            {
              key: "usefulness",
              label: "실무 활용성",
              value: 92,
              weight: 0.4,
              contribution: 36.8,
            },
          ],
        },
      },
    });
    const TechArticleDetail = require("./TechArticleDetail").default;
    renderWithAuth(<TechArticleDetail />);

    expect(await screen.findByText("실무 활용성")).toBeInTheDocument();
    expect(screen.getByText("36.8")).toBeInTheDocument();
    expect(screen.queryByText("92 / 100")).not.toBeInTheDocument();
    expect(screen.queryByText("최종 기여 점수")).not.toBeInTheDocument();
    expect(screen.queryByText(/가중치/)).not.toBeInTheDocument();
    expect(screen.getByRole("meter")).toBeInTheDocument();
    expect(
      screen.queryByText("로그인하면 가치 점수도 확인할 수 있어요."),
    ).not.toBeInTheDocument();
  });
});

describe("관리자 화면", () => {
  test("전체 아티클이 .ta-admin 스코프로 렌더되고 목록·통계를 요청한다", async () => {
    asAdmin();
    const AdminTechArticles = require("./admin/AdminTechArticles").default;
    const { container } = renderWithAuth(<AdminTechArticles />);

    await waitFor(() => expect(api.getAdminTechArticles).toHaveBeenCalled());
    expect(api.getAdminTechArticleStats).toHaveBeenCalled();

    const scope = container.querySelector(".ta-admin");
    expect(scope).not.toBeNull();
    // 본문 폭: 기존 관리자 페이지와 같은 컨테이너 클래스
    expect(scope.querySelector(".container.mx-auto.max-w-7xl")).not.toBeNull();
    // 목업 관리자 셸 -> AdminLayout + AdminSidebar
    expect(container.querySelector(".admin-sidebar")).toBeNull();
    expect(container.querySelector(".admin-topbar")).toBeNull();
  });

  test("전체 아티클에는 사이드바와 중복되는 크롤링 이동 버튼이 없다", async () => {
    asAdmin();
    const AdminTechArticles = require("./admin/AdminTechArticles").default;
    const { container } = renderWithAuth(<AdminTechArticles />);

    await waitFor(() => expect(api.getAdminTechArticles).toHaveBeenCalled());

    expect(
      screen.queryByRole("link", { name: /크롤링 관리/ }),
    ).not.toBeInTheDocument();
    expect(container.querySelector("#crawlPanel")).toBeNull();
    expect(api.getCrawlSources).not.toHaveBeenCalled();
  });

  test("크롤링 관리 화면은 이력을 먼저 보여 주고 실행 폼을 아래에 항상 둔다", async () => {
    asAdmin();
    const AdminCrawlOperations =
      require("./admin/AdminCrawlOperations").default;
    const { container } = renderWithAuth(<AdminCrawlOperations />);

    await waitFor(() => expect(api.getCrawlSources).toHaveBeenCalled());
    expect(api.getCrawlRuns).toHaveBeenCalled();
    expect(container.querySelector(".ta-admin")).not.toBeNull();
    expect(
      screen.queryByRole("link", { name: /전체 아티클 보기/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("크롤링 실행 이력")).toBeInTheDocument();

    // 토글 없이 바로 떠 있어야 합니다.
    const runner = container.querySelector("#asyncCrawlRunner");
    expect(runner).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "비동기 수집 실행" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".crawl-runner-toggle-v9")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /실행 설정 닫기/ }),
    ).not.toBeInTheDocument();

    // 순서는 이력 -> 실행 폼입니다.
    const history = screen.getByText("크롤링 실행 이력").closest("section");
    expect(
      history.compareDocumentPosition(runner) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("중복 의심 아티클이 중복 큐만 요청한다", async () => {
    asAdmin();
    const Reviews = require("./admin/AdminTechArticleReviews").default;
    const { container } = renderWithAuth(<Reviews kind="duplicates" />);

    await waitFor(() => expect(api.getDuplicateReviews).toHaveBeenCalled());
    expect(container.querySelector(".ta-admin")).not.toBeNull();
    expect(api.getQualityReviews).not.toHaveBeenCalled();
  });

  test.each([["quality"], ["publication"]])(
    "아티클 검토(%s 탭)가 해당 큐를 요청한다",
    async (kind) => {
      asAdmin();
      const Reviews = require("./admin/AdminTechArticleReviews").default;
      renderWithAuth(<Reviews kind={kind} />);

      // 검토 화면: 품질/공개 두 탭
      await waitFor(() =>
        expect(api.getQualityReviews).toHaveBeenCalledWith(
          kind,
          expect.any(Object),
        ),
      );
      expect(api.getDuplicateReviews).not.toHaveBeenCalled();
    },
  );
});
