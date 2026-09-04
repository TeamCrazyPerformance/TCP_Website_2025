import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
    expect(container.querySelector(".site-header")).toBeNull();
    expect(container.querySelector(".site-footer")).toBeNull();
    expect(container.querySelector("[class*='v9-shadow-host']")).toBeNull();
    expect(
      screen.getByRole("button", { name: /\uC18C\uC2A4 \uC120\uD0DD/ }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".source-dialog-header h2"),
    ).toHaveTextContent("소스 선택");
    expect(
      container.querySelector(".filter-sheet-heading h2"),
    ).toHaveTextContent("분야 선택");
    expect(screen.queryByText("FILTER")).not.toBeInTheDocument();
    expect(
      container.querySelector(".filter-sheet-heading .sheet-close"),
    ).toHaveAttribute("aria-label", "닫기");
    expect(
      container.querySelector(".filter-sheet-heading .sheet-close i"),
    ).toHaveClass("fa-xmark");
    expect(screen.queryByText("모든 소스")).not.toBeInTheDocument();
    expect(screen.queryByText("소스 고르기")).not.toBeInTheDocument();
    expect(
      container.querySelector(".hero-lead").textContent.replace(/\s+/g, " "),
    ).toBe("TCP가 한데 모은 여러 개발·기술 뉴스를 이곳에서 만나보세요.");
    expect(container.querySelectorAll(".hero-lead span")).toHaveLength(2);
    expect(
      screen.queryByText(
        "TCP가 한데 모은 여러 소식을 이곳에서 확인할 수 있어요.",
      ),
    ).not.toBeInTheDocument();
    expect(container.querySelector("#mobileFilterCount")).toBeNull();
    expect(container.querySelector("#searchMobileFilterCount")).toBeNull();
    expect(container.querySelector("#mobileResetAllButton")).toBeNull();
  });

  test("검색 화면의 분야 패널도 목록 패널과 같은 자리에 초기화·적용을 둔다", async () => {
    const scrollIntoView = jest.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector("#searchTagFilters")).not.toBeNull(),
    );

    const row = container.querySelector(
      ".search-category-filter .filter-apply-row",
    );
    expect(row).not.toBeNull();
    expect(row.querySelector("#resetSearchDraftTagsButton")).not.toBeNull();
    expect(row.querySelector("#applySearchTagsButton")).not.toBeNull();

    expect(container.querySelector("#applySearchTagsButton")).toHaveAttribute(
      "type",
      "button",
    );

    expect(
      container.querySelector(
        ".search-category-filter .desktop-filter > .filter-apply-row",
      ),
    ).not.toBeNull();

    const panel = container.querySelector("#searchTagFilters");
    fireEvent.click(within(panel).getByRole("button", { name: "AI" }));
    fireEvent.click(container.querySelector("#applySearchTagsButton"));
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: ["AI"] }),
      ),
    );

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    const target = scrollIntoView.mock.instances.at(-1);
    expect(target).toBe(container.querySelector("#article-filters"));
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  test("소스 적용 버튼은 고른 소스가 달라졌을 때만 눌린다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-option input")).not.toBeNull(),
    );

    expect(container.querySelector(".source-apply")).toBeDisabled();

    fireEvent.click(container.querySelector(".source-option input"));
    await waitFor(() =>
      expect(container.querySelector(".source-apply")).toBeEnabled(),
    );
  });

  test("안내 문구 제목은 브랜드 서체를 쓰지 않고 정렬 표기는 짧게 둔다", async () => {
    api.getTechArticles.mockResolvedValue({
      items: [],
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 38,
        totalPages: 2,
      },
    });
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".result-sort")).not.toBeNull(),
    );

    expect(container.querySelector(".source-notice h2")).not.toHaveClass(
      "orbitron",
    );
    expect(container.querySelector(".source-notice > i")).toBeNull();
    expect(container.querySelector(".result-sort")).toHaveTextContent("최신순");
    expect(container.querySelector(".result-sort").textContent).not.toMatch(
      /원문 게시일/,
    );
  });

  test("수집 시각 줄은 아이콘 없이 문장만 남긴다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".last-collected")).not.toBeNull(),
    );

    expect(container.querySelector(".last-collected i")).toBeNull();
  });

  test("페이지 표시는 전체 쪽수만 알린다", async () => {
    api.getTechArticles.mockResolvedValue({
      items: [],
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalCount: 40,
        totalPages: 2,
      },
    });
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".pagination-status")).not.toBeNull(),
    );

    expect(container.querySelector(".pagination-status")).toHaveTextContent(
      "전체 2페이지",
    );
    expect(
      container.querySelector(".pagination-status").textContent,
    ).not.toMatch(/현재/);
  });

  test("검색 입력은 보이는 라벨 없이도 이름을 갖는다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector("#searchInput")).not.toBeNull(),
    );

    expect(container.querySelector("label[for='searchInput']")).toBeNull();
    expect(
      screen.getByRole("searchbox", { name: "검색어" }),
    ).toBeInTheDocument();
  });

  test("조건을 적용하거나 데스크톱에서 초기화해도 목록으로 강제 이동하지 않는다", async () => {
    const scrollIntoView = jest.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() => expect(api.getTechArticles).toHaveBeenCalled());

    const panel = container.querySelector("#desktopTagFilters");
    fireEvent.click(within(panel).getByRole("button", { name: "AI" }));
    fireEvent.click(container.querySelector("#applyDesktopTagsButton"));

    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["AI"] }),
      ),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    const mobileReset = container.querySelector("#mobileResetAllButton");
    expect(mobileReset).not.toBeNull();
    expect(mobileReset.closest(".list-filter-row")).not.toBeNull();
    expect(mobileReset.parentElement.lastElementChild).toBe(mobileReset);
    expect(container.querySelector(".active-filters")).toBeNull();
    expect(container.querySelector(".filter-chips")).toBeNull();
    expect(screen.queryByText("적용 중")).not.toBeInTheDocument();
    expect(container.querySelector(".active-filter-summary")).toBeNull();

    fireEvent.click(container.querySelector("#resetDraftTagsButton"));
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: [] }),
      ),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(within(panel).getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(container.querySelector("#resetDraftTagsButton")).toBeDisabled();
    expect(container.querySelector("#mobileResetAllButton")).toBeNull();
  });

  test("분야 시트의 동작은 소스 대화상자와 같은 초기화·적용 둘뿐이다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(
        container.querySelector("#filterDialog .sheet-actions"),
      ).not.toBeNull(),
    );

    const sheetButtons = [
      ...container.querySelectorAll("#filterDialog .sheet-actions button"),
    ];
    expect(sheetButtons.map((button) => button.textContent)).toEqual([
      "초기화",
      "적용",
    ]);
    const dialogButtons = [
      ...container.querySelectorAll(".source-dialog-actions button"),
    ];
    expect(sheetButtons.map((button) => button.className)).toEqual(
      dialogButtons.map((button) => button.className),
    );

    expect(
      container.querySelector("#filterDialog .sheet-actions").textContent,
    ).not.toMatch(/취소/);
    expect(
      container.querySelector("#filterDialog .sheet-close"),
    ).not.toBeNull();
  });

  test("비로그인 상세는 점수 안내 다음에 로그인 동작을 보여 준다", async () => {
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "비회원 아티클",
      summaryMarkdown: "상세 요약",
      tags: [],
      source: { name: "InfoQ", domain: "infoq.com" },
    });
    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    const description = await waitFor(() => {
      const found = container.querySelector(".score-gate-description");
      expect(found).not.toBeNull();
      return found;
    });
    const gate = description.closest(".score-gate-card");
    const actions = gate.querySelector(".member-gate-actions");
    const footnote = gate.querySelector(".member-gate-footnote");

    expect(gate.firstElementChild).toBe(description);
    expect(description.nextElementSibling).toBe(actions);
    expect(actions.nextElementSibling).toBe(footnote);
    expect(description.textContent.replace(/\s+/g, " ").trim()).toBe(
      "Tech Articles에서는 AI를 활용해 아티클을 분석하고, 가치 점수를 산정하여 제공하고 있어요.",
    );
    const descriptionLines = description.querySelectorAll("span");
    expect(descriptionLines).toHaveLength(3);
    expect([...descriptionLines].map((line) => line.textContent)).toEqual([
      "Tech Articles에서는",
      "AI를 활용해 아티클을 분석하고,",
      "가치 점수를 산정하여 제공하고 있어요.",
    ]);
    expect(container.querySelector(".score-gate-card h3")).toBeNull();
    expect(container.querySelector(".member-gate-icon")).toBeNull();
    expect(container.querySelector(".score-card .scenario-eyebrow")).toBeNull();
    expect(
      container.querySelector(".source-card .scenario-eyebrow"),
    ).toBeNull();
    expect(container).not.toHaveTextContent("가치 점수는 회원 전용입니다.");
  });

  test("소스 항목은 아이콘 없이 이름·도메인·건수만 보여준다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-option")).not.toBeNull(),
    );

    const option = container.querySelector(".source-option");
    expect(option.querySelector(".source-icon")).toBeNull();
    expect(option.querySelector("img")).toBeNull();

    expect(
      option.querySelector(".source-option-text strong"),
    ).toHaveTextContent("InfoQ");
    expect(option.querySelector(".source-option-text small")).toHaveTextContent(
      "infoq.com",
    );
    expect(option.querySelector(".source-option-count")).toHaveTextContent("3");
  });

  test("소스 선택 창도 바깥쪽을 누르면 분야 시트처럼 닫힌다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-dialog")).not.toBeNull(),
    );

    const sourceDialog = container.querySelector(".source-dialog");
    const filterDialog = container.querySelector("#filterDialog");

    fireEvent.click(
      container.querySelector(".article-list-heading .source-trigger"),
    );
    await waitFor(() => expect(sourceDialog.open).toBe(true));

    fireEvent.click(container.querySelector(".source-dialog-inner"));
    expect(sourceDialog.open).toBe(true);

    fireEvent.click(sourceDialog);
    await waitFor(() => expect(sourceDialog.open).toBe(false));

    fireEvent.click(
      container.querySelector(".article-list-heading .mobile-filter-button"),
    );
    await waitFor(() => expect(filterDialog.open).toBe(true));
    fireEvent.click(container.querySelector(".filter-sheet"));
    expect(filterDialog.open).toBe(true);
    fireEvent.click(filterDialog);
    await waitFor(() => expect(filterDialog.open).toBe(false));
  });

  test("소스 대화상자의 되돌리기 버튼은 초기화로 표기한다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-reset")).not.toBeNull(),
    );

    expect(container.querySelector(".source-reset")).toHaveTextContent(
      "초기화",
    );
    expect(container.querySelector(".source-dialog")).not.toHaveTextContent(
      "전체 해제",
    );
  });

  test("소스 선택은 트리거 개수만 갱신하고 별도 칩을 만들지 않는다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-trigger")).not.toBeNull(),
    );

    expect(
      container.querySelector(".article-list-heading .source-trigger"),
    ).not.toBeNull();

    expect(container.querySelector(".source-bar")).toBeNull();

    fireEvent.click(container.querySelector(".source-option input"));
    fireEvent.click(container.querySelector(".source-apply"));
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ sources: ["infoq"] }),
      ),
    );

    const reset = container.querySelector("#mobileResetAllButton");
    expect(reset).not.toBeNull();
    expect(reset).toHaveTextContent("전체 초기화");
    expect(reset).not.toHaveClass("filter-trigger");
    expect(reset.closest(".list-filter-row")).not.toBeNull();
    expect(reset.parentElement.lastElementChild).toBe(reset);
    expect(container.querySelector(".source-trigger")).toHaveTextContent(
      "소스 1곳",
    );
    expect(container.querySelector(".source-bar")).toBeNull();
    expect(container.querySelector(".source-chip-list")).toBeNull();
    expect(container.querySelector(".source-chip")).toBeNull();

    fireEvent.click(reset);
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ sources: [] }),
      ),
    );
    expect(container.querySelector(".source-bar")).toBeNull();
    expect(container.querySelector("#mobileResetAllButton")).toBeNull();
  });

  test("분야 선택 버튼이 머리글로 올라가 소스 선택과 나란히 놓인다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".source-trigger")).not.toBeNull(),
    );

    const trigger = container.querySelector(
      ".article-list-heading #openFilterButton",
    );
    expect(trigger).not.toBeNull();
    expect(
      container.querySelector("#categoryFieldset #openFilterButton"),
    ).toBeNull();

    expect(trigger).toHaveTextContent("분야 선택");
    expect(container.querySelector("#mobileFilterCount")).toBeNull();

    expect(trigger).not.toBeDisabled();
  });

  test("태그 칩은 선택해도 아이콘이 붙지 않아 폭이 흔들리지 않는다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);
    await waitFor(() =>
      expect(container.querySelector(".tag-button")).not.toBeNull(),
    );

    const chip = () => container.querySelector(".tag-button");
    const before = chip().textContent;

    expect(chip().getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector(".tag-button i")).toBeNull();

    fireEvent.click(chip());

    await waitFor(() =>
      expect(chip().getAttribute("aria-pressed")).toBe("true"),
    );
    expect(container.querySelector(".tag-button i")).toBeNull();
    expect(chip().textContent).toBe(before);
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
    const shareButton = firstRender.container.querySelector(".share-button");
    expect(shareButton).toHaveTextContent("");
    expect(shareButton).toHaveAttribute(
      "aria-label",
      "복원할 아티클 세부 페이지 공유",
    );
    expect(shareButton.querySelector("i.fa-share-nodes")).not.toBeNull();
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

  test("상세의 목록으로 돌아가기는 보던 목록 주소와 카드 위치로 되돌린다", async () => {
    mockLocation = {
      pathname: "/tech-articles",
      search: "?q=react",
      state: null,
      key: "list-key",
    };
    api.getTechArticles.mockResolvedValue({
      items: [
        {
          id: "article-1",
          title: "돌아갈 아티클",
          oneLineSummary: "복귀 테스트",
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
    api.getTechArticle.mockResolvedValue({
      id: "article-1",
      title: "돌아갈 아티클",
      summaryMarkdown: "## 요약",
      tags: ["AI"],
      source: { name: "InfoQ", domain: "infoq.com" },
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
    const listRender = renderWithAuth(<TechArticles />);
    const articleLink = await screen.findByRole("link", {
      name: "돌아갈 아티클",
    });
    fireEvent.click(articleLink.closest("article"));
    listRender.unmount();

    window.history.replaceState(null, "", "/tech-articles/article-1");

    const TechArticleDetail = require("./TechArticleDetail").default;
    const detailRender = renderWithAuth(<TechArticleDetail />);
    const backLink = await waitFor(() => {
      const link = detailRender.container.querySelector(".back-to-list-link");
      expect(link).toHaveAttribute("href", "/tech-articles?q=react");
      return link;
    });
    expect(backLink).toHaveTextContent("아티클 목록으로 돌아가기");
    detailRender.unmount();

    mockNavigationType = "PUSH";
    mockLocation = {
      pathname: "/tech-articles",
      search: "?q=react",
      state: { restoreListPosition: true },
      key: "pushed-key",
    };
    cardTop = 900;
    window.history.replaceState(null, "", "/tech-articles?q=react");
    renderWithAuth(<TechArticles />);

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({ top: 660, behavior: "auto" }),
    );
    expect(
      sessionStorage.getItem("tcp.tech-articles.list-return.v1"),
    ).toBeNull();

    Object.defineProperty(Element.prototype, "getBoundingClientRect", {
      configurable: true,
      value: originalGetBoundingClientRect,
    });
  });

  test("주소로 바로 연 상세는 목록 첫 화면으로 돌아간다", async () => {
    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    await waitFor(() =>
      expect(container.querySelector(".back-to-list-link")).not.toBeNull(),
    );
    expect(container.querySelector(".back-to-list-link")).toHaveAttribute(
      "href",
      "/tech-articles",
    );
  });

  test("같은 세션에서 다시 연 상세는 조회수를 재집계하지 않는다", async () => {
    api.getTechArticle.mockResolvedValue({
      id: "article-1",
      title: "세션 조회 테스트",
      summaryMarkdown: "요약",
      tags: [],
      source: { name: "InfoQ", domain: "infoq.com" },
    });
    const TechArticleDetail = require("./TechArticleDetail").default;

    const firstRender = renderWithAuth(<TechArticleDetail />);
    await waitFor(() =>
      expect(api.getTechArticle).toHaveBeenCalledWith("article-1", {
        recordView: true,
      }),
    );
    firstRender.unmount();

    renderWithAuth(<TechArticleDetail />);
    await waitFor(() =>
      expect(api.getTechArticle).toHaveBeenLastCalledWith("article-1", {
        recordView: false,
      }),
    );
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
    expect(document.querySelector(".score-gate-card h3")).toBeNull();
    expect(document.querySelector(".member-gate-icon")).toBeNull();
    expect(document.body).not.toHaveTextContent("가치 점수는 회원 전용입니다.");
    expect(screen.queryByText(/가중치를 확인/)).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /로그인하고 점수 보기/ }),
    ).toBeInTheDocument();
    expect(document.querySelector(".member-gate-footnote")).toHaveTextContent(
      "아직 회원이 아니라면, 회원가입",
    );
    expect(screen.getByRole("link", { name: "회원가입" })).toBeInTheDocument();
  });

  test("상세 히어로는 출처·게시 시각을 중복하지 않고 원문 링크와 태그만 남긴다", async () => {
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "공개 아티클",
      oneLineSummary: "한 줄 요약",
      summaryMarkdown: "상세 요약",
      tags: ["AI", "인프라"],
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

    const hero = container.querySelector(".detail-hero");
    expect(hero.textContent).not.toMatch(/원출처/);
    expect(hero.textContent).not.toMatch(/원문 게시/);
    const originalLink = hero.querySelector("#heroOriginalLink");
    expect(originalLink).not.toBeNull();
    expect(originalLink).toHaveTextContent("원문");
    expect(originalLink.textContent).not.toMatch(/원문 보기/);
    const detailShareButton = hero.querySelector(".detail-share-button");
    expect(detailShareButton).not.toBeNull();
    expect(detailShareButton).not.toHaveTextContent("공유");
    expect(detailShareButton.querySelector(".fa-share-nodes")).not.toBeNull();
    expect(detailShareButton).toHaveAttribute(
      "aria-label",
      "공개 아티클 세부 페이지 공유",
    );
    expect(detailShareButton.nextElementSibling).toBe(originalLink);

    const actions = hero.querySelector(".detail-info-actions");
    expect(actions).not.toBeNull();
    expect(actions.contains(originalLink)).toBe(true);
    expect(actions.contains(detailShareButton)).toBe(true);
    expect(actions.parentElement).toBe(
      hero.querySelector(".detail-info-items"),
    );
    expect(hero.querySelector(".detail-tags").parentElement).toBe(
      actions.parentElement,
    );

    expect(
      [...actions.parentElement.children].map((node) => node.className),
    ).toEqual(["detail-tags", "detail-info-actions"]);

    expect(hero.querySelectorAll(".detail-tags .article-tag")).toHaveLength(2);

    const sourceCard = container.querySelector(".source-card");
    expect(sourceCard.textContent).toMatch(/출처/);
    expect(sourceCard.textContent).toMatch(/원문 게시/);
    expect(sourceCard.querySelector("#sourceName").textContent).toBe("InfoQ");
  });

  test("상세 안내 문구 제목도 목록 화면과 같은 서체를 쓴다", async () => {
    api.getTechArticle.mockResolvedValue({
      id: "article-1",
      title: "안내 서체 확인",
      summaryMarkdown: "## 요약",
      tags: [],
      source: { name: "InfoQ", domain: "infoq.com" },
    });

    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    const heading = await waitFor(() => {
      const found = container.querySelector(".source-notice h2");
      expect(found).not.toBeNull();
      return found;
    });
    expect(heading).not.toHaveClass("orbitron");
    expect(heading).toHaveTextContent("데이터 출처 및 AI 생성 정보 안내");
    expect(
      heading.closest(".source-notice").querySelector(":scope > i"),
    ).toBeNull();
  });

  test("출처 카드는 원문 URL을 맨 앞에 두고 정해진 순서로 보여준다", async () => {
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "공개 아티클",
      oneLineSummary: "한 줄 요약",
      summaryMarkdown: "상세 요약",
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

    const labels = [...container.querySelectorAll(".source-details dt")].map(
      (node) => node.textContent,
    );
    expect(labels).toEqual([
      "원문 URL",
      "출처",
      "원문 언어",
      "원문 게시",
      "TCP 수집",
    ]);

    const originalUrl = container.querySelector("#sourceOriginalLink");
    expect(originalUrl).toHaveAttribute("href", "https://infoq.com/article-1");
    expect(originalUrl.querySelector("i")).toBeNull();
    expect(container.querySelector("#sourceOriginalUrlText")).toHaveTextContent(
      "infoq.com/article-1",
    );

    const siteLink = container.querySelector("#sourceSiteLink");
    expect(siteLink).toHaveAttribute("href", "https://infoq.com");
    expect(siteLink).toHaveAttribute("target", "_blank");
    expect(siteLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(siteLink.querySelector("#sourceName")).toHaveTextContent("InfoQ");
    expect(container.querySelector("#sourceDomain")).toBeNull();
  });

  test("출처 도메인을 모르면 이름을 링크로 감싸지 않는다", async () => {
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "도메인 없는 아티클",
      summaryMarkdown: "상세 요약",
      tags: [],
      source: { name: "사내 위키" },
    });
    const TechArticleDetail = require("./TechArticleDetail").default;
    const { container } = renderWithAuth(<TechArticleDetail />);

    await waitFor(() =>
      expect(container.querySelector("#sourceName")).not.toBeNull(),
    );
    expect(container.querySelector("#sourceName")).toHaveTextContent(
      "사내 위키",
    );
    expect(container.querySelector("#sourceSiteLink")).toBeNull();
  });

  test("로그인 상세는 공개 표시용 점수와 기여도만 보여준다", async () => {
    localStorage.setItem("access_token", "member-token");
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-1",
      title: "회원 아티클",
      summaryMarkdown: "회원 상세 요약",
      tags: [],
      valueScore: {
        overall: 88,
        scale: { min: 0, max: 100 },
        breakdown: [
          {
            label: "실무 활용성",
            contribution: 36.8,
          },
        ],
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
    expect(document.querySelector(".score-gate-card")).toBeNull();
  });

  test("로그인 응답에 점수가 없으면 로그인 안내 대신 확인 불가로 표시한다", async () => {
    localStorage.setItem("access_token", "member-token");
    api.getTechArticle.mockResolvedValueOnce({
      id: "article-without-score",
      title: "점수 없는 회원 아티클",
      summaryMarkdown: "상세 요약",
      tags: [],
      valueScore: null,
    });
    const TechArticleDetail = require("./TechArticleDetail").default;
    renderWithAuth(<TechArticleDetail />);

    expect(
      await screen.findByLabelText("가치 점수를 확인할 수 없음"),
    ).toBeInTheDocument();
    expect(document.querySelector(".score-gate-card")).toBeNull();
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
    expect(scope.querySelector(".container.mx-auto.max-w-7xl")).not.toBeNull();
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

  test("전체 아티클의 품질검토 대기 건을 기존 승인 API로 통과시킨다", async () => {
    asAdmin();
    api.getAdminTechArticles.mockResolvedValue({
      items: [
        {
          articleId: "article-review-1",
          title: "품질검토 대기 아티클",
          processingStatus: "QUALITY_EVALUATED",
          reviewStatus: "PENDING",
          publicationStatus: "UNPUBLISHED",
          qualityReview: { caseId: "quality-case-1", caseVersion: 3 },
          tags: [],
        },
      ],
      pagination: { ...PAGINATION, totalCount: 1 },
    });
    api.resolveQualityReview.mockResolvedValue({
      caseId: "quality-case-1",
      status: "RESOLVED_APPROVE",
      caseVersion: 4,
    });
    api.getAdminTechArticle.mockResolvedValue({
      articleId: "article-review-1",
      title: "품질검토 대기 아티클",
      processingStatus: "QUALITY_EVALUATED",
      reviewStatus: "PENDING",
      publicationStatus: "UNPUBLISHED",
      recordVersion: 2,
      qualityReview: { caseId: "quality-case-1", caseVersion: 3 },
      tags: [],
    });
    const AdminTechArticles = require("./admin/AdminTechArticles").default;
    renderWithAuth(<AdminTechArticles />);

    expect(
      screen.queryByRole("button", { name: "품질 통과" }),
    ).not.toBeInTheDocument();
    const detailButtons = await screen.findAllByRole("button", {
      name: "상세",
    });
    fireEvent.click(detailButtons[0]);
    const articleDialog = await screen.findByRole("dialog", {
      name: "아티클 상세 정보",
    });
    expect(
      await within(articleDialog).findByRole("button", {
        name: "품질 탈락",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(articleDialog).getByRole("button", { name: "품질 통과" }),
    );
    const confirmation = await screen.findByRole("dialog", {
      name: "품질 통과로 판정할까요?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "품질 통과" }),
    );

    await waitFor(() =>
      expect(api.resolveQualityReview).toHaveBeenCalledWith("quality-case-1", {
        action: "APPROVE",
        expectedCaseVersion: 3,
      }),
    );
    expect(
      await screen.findByText(
        "품질 통과 처리를 완료하고 AI 요약 단계로 전달했습니다.",
      ),
    ).toBeInTheDocument();
  });

  test("전체 아티클의 선택은 단계 필터를 바꾸면 해제된다", async () => {
    asAdmin();
    api.getAdminTechArticles.mockResolvedValue({
      items: [
        {
          articleId: "article-selected",
          title: "선택된 아티클",
          processingStatus: "QUALITY_EVALUATED",
          reviewStatus: "PENDING",
          publicationStatus: "UNPUBLISHED",
          tags: [],
        },
      ],
      pagination: { ...PAGINATION, totalCount: 1 },
    });
    api.getAdminTechArticleStats.mockResolvedValue({
      totalCount: 1,
      publication: { UNPUBLISHED: 1 },
      reviews: {},
      stages: { QUALITY_REVIEW: 1 },
      stageOldest: {},
      statusMismatch: 0,
    });
    const AdminTechArticles = require("./admin/AdminTechArticles").default;
    renderWithAuth(<AdminTechArticles />);

    const checkboxes = await screen.findAllByLabelText("선택된 아티클 선택");
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText("1개 선택됨")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /품질 검토/ }));
    await waitFor(() =>
      expect(screen.queryByText("1개 선택됨")).not.toBeInTheDocument(),
    );
  });

  test.each(["FAILED", "FAILED_AFTER_APPROVAL"])(
    "%s 기사 상세에서 실패 단계를 재처리한다",
    async (stage) => {
      asAdmin();
      const failedArticle = {
        articleId: `article-${stage.toLowerCase()}`,
        title: "처리 실패 아티클",
        processingStatus: "PROCESSING_FAILED",
        stage,
        reviewStatus: stage === "FAILED" ? "NOT_REQUIRED" : "APPROVED",
        publicationStatus: "UNPUBLISHED",
        recordVersion: 7,
        tags: [],
      };
      api.getAdminTechArticles.mockResolvedValue({
        items: [failedArticle],
        pagination: { ...PAGINATION, totalCount: 1 },
      });
      api.getAdminTechArticle.mockResolvedValue(failedArticle);
      api.reprocessArticle.mockResolvedValue({
        articleId: failedArticle.articleId,
        processingStatus: "ENRICHMENT_PENDING",
        recordVersion: 8,
      });
      const AdminTechArticles = require("./admin/AdminTechArticles").default;
      renderWithAuth(<AdminTechArticles />);

      const detailButtons = await screen.findAllByRole("button", {
        name: "상세",
      });
      fireEvent.click(detailButtons[0]);
      const retry = await screen.findByRole("button", { name: "재처리" });
      fireEvent.click(retry);
      const confirmation = await screen.findByRole("dialog", {
        name: "실패한 처리를 다시 실행할까요?",
      });
      fireEvent.click(
        within(confirmation).getByRole("button", { name: "재처리" }),
      );

      await waitFor(() =>
        expect(api.reprocessArticle).toHaveBeenCalledWith(
          failedArticle.articleId,
          { action: "RETRY", expectedRecordVersion: 7 },
        ),
      );
    },
  );

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

    const runner = container.querySelector("#asyncCrawlRunner");
    expect(runner).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "비동기 수집 실행" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".crawl-runner-toggle-v9")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /실행 설정 닫기/ }),
    ).not.toBeInTheDocument();

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

  test.each([["quality"], ["rejected"], ["publication"]])(
    "아티클 검토(%s 탭)가 해당 큐를 요청한다",
    async (kind) => {
      asAdmin();
      const Reviews = require("./admin/AdminTechArticleReviews").default;
      renderWithAuth(<Reviews kind={kind} />);

      await waitFor(() =>
        expect(api.getQualityReviews).toHaveBeenCalledWith(
          kind,
          expect.any(Object),
        ),
      );
      expect(api.getDuplicateReviews).not.toHaveBeenCalled();
    },
  );

  test("품질 미달 상세에서 관리자 통과 처리를 실행한다", async () => {
    asAdmin();
    api.getQualityReviews.mockResolvedValue({
      items: [
        {
          articleId: "article-rejected",
          title: "품질 미달 아티클",
          processingStatus: "QUALITY_REJECTED",
          reviewStatus: "NOT_REQUIRED",
          publicationStatus: "UNPUBLISHED",
          recordVersion: 5,
          reason: "기술 내용이 부족합니다.",
          source: { name: "InfoQ", articleUrl: "https://infoq.com/rejected" },
          tags: [],
          queuedAt: "2026-09-04T00:00:00Z",
        },
      ],
      pagination: { ...PAGINATION, totalCount: 1 },
    });
    api.reprocessArticle.mockResolvedValue({
      articleId: "article-rejected",
      processingStatus: "ENRICHMENT_PENDING",
      recordVersion: 6,
    });
    const Reviews = require("./admin/AdminTechArticleReviews").default;
    renderWithAuth(<Reviews kind="rejected" />);

    const detailButtons = await screen.findAllByRole("button", {
      name: "상세",
    });
    fireEvent.click(detailButtons[0]);
    const detailDialog = await screen.findByRole("dialog", {
      name: "품질 미달 상세",
    });
    fireEvent.click(
      within(detailDialog).getByRole("button", { name: "품질 통과" }),
    );
    const confirmation = await screen.findByRole("dialog", {
      name: "품질 미달 판정을 통과로 변경할까요?",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "품질 통과" }),
    );

    await waitFor(() =>
      expect(api.reprocessArticle).toHaveBeenCalledWith("article-rejected", {
        action: "APPROVE_QUALITY",
        expectedRecordVersion: 5,
      }),
    );
  });
});
