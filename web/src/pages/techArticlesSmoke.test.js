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
    // 좁은 화면의 개행 지점을 고정하려고 의미 단위로 나눠 두었으므로
    // 한 덩어리 문자열이 아니라 문단 전체로 확인한다.
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

    // 폼 안에 있어 type 을 빼면 submit 으로 새어 검색이 실행된다.
    expect(container.querySelector("#applySearchTagsButton")).toHaveAttribute(
      "type",
      "button",
    );

    // 태그 목록과 버튼 줄이 한 그리드의 형제여야 위쪽 패널과 배치가 같다.
    expect(
      container.querySelector(
        ".search-category-filter .desktop-filter > .filter-apply-row",
      ),
    ).not.toBeNull();

    // 고른 태그는 검색 버튼이 아니라 적용으로 반영된다.
    const panel = container.querySelector("#searchTagFilters");
    fireEvent.click(within(panel).getByRole("button", { name: "AI" }));
    fireEvent.click(container.querySelector("#applySearchTagsButton"));
    await waitFor(() =>
      expect(api.getTechArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: ["AI"] }),
      ),
    );

    // 목록이 짧아지면 아래쪽 패널이 화면 밖으로 밀립니다. 목록 머리글이
    // 아니라 방금 조작한 검색 패널로 돌아와야 자리를 잃지 않습니다.
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    const target = scrollIntoView.mock.instances.at(-1);
    expect(target).toBe(container.querySelector("#article-filters"));
    // 위쪽 끝에 붙이면 패널이 화면 맨 위로 올라붙어 어색합니다. 가운데로
    // 옮겨야 방금 누른 버튼이 시야에 남습니다.
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

    // 분야 선택과 같게, 바꾼 것이 없으면 적용할 것도 없다.
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

    // Orbitron 은 라틴 대문자용이라 한글 사이의 "AI"만 다른 글꼴로 튄다.
    expect(container.querySelector(".source-notice h2")).not.toHaveClass(
      "orbitron",
    );
    // 정렬 표기는 화면 폭과 무관하게 짧은 형태 하나만 쓴다.
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

    // 시계 그림은 바로 뒤 문장이 이미 말하는 내용을 되풀이할 뿐입니다.
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

    // 바로 위 번호 버튼이 현재 쪽을 이미 보여 준다.
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
    // 조건을 바꿨다고 목록 머리글로 끌고 가지 않는다.
    expect(scrollIntoView).not.toHaveBeenCalled();
    const mobileReset = container.querySelector("#mobileResetAllButton");
    expect(mobileReset).not.toBeNull();
    expect(mobileReset.closest(".list-filter-row")).not.toBeNull();
    expect(mobileReset.parentElement.lastElementChild).toBe(mobileReset);
    expect(container.querySelector(".active-filters")).toBeNull();
    expect(container.querySelector(".filter-chips")).toBeNull();
    expect(screen.queryByText("적용 중")).not.toBeInTheDocument();
    expect(container.querySelector(".active-filter-summary")).toBeNull();

    // 데스크톱 초기화는 따로 적용을 누르지 않아도 그 자리에서 반영된다.
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

    // 건수와 같은 머리글 안에 있어야 한다. 밖으로 나가면 버튼만 있는 줄이
    // 생기면서 건수와 목록 사이에 빈 띠가 다시 만들어진다.
    expect(
      container.querySelector(".article-list-heading .source-trigger"),
    ).not.toBeNull();

    // 고른 소스가 없으면 칩 줄 자체가 렌더되지 않는다.
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

    // fieldset 밖 머리글 안에 있어야 소스 선택과 같은 줄을 나눠 쓸 수 있다.
    const trigger = container.querySelector(
      ".article-list-heading #openFilterButton",
    );
    expect(trigger).not.toBeNull();
    expect(
      container.querySelector("#categoryFieldset #openFilterButton"),
    ).toBeNull();

    // 소스 선택과 같은 방식으로 개수를 글자로 알린다(배지 없음).
    expect(trigger).toHaveTextContent("분야 선택");
    expect(container.querySelector("#mobileFilterCount")).toBeNull();

    // fieldset 이 주던 disabled 를 직접 넘겨받았는지 확인한다.
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
    // 체크 아이콘이 끼어들면 칩 내용 폭이 그때그때 달라져 필터 줄이 밀린다.
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
    expect(document.querySelector(".score-gate-card h3")).toHaveTextContent(
      "가치 점수는 회원 전용입니다.",
    );
    expect(screen.queryByText(/가중치를 확인/)).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /로그인하고 점수 보기/ }),
    ).toBeInTheDocument();
    // 안내는 한 문장으로 끊고 회원가입만 링크로 남깁니다.
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
    expect(hero.querySelector("#heroOriginalLink")).not.toBeNull();
    const detailShareButton = hero.querySelector(".detail-share-button");
    expect(detailShareButton).not.toBeNull();
    expect(detailShareButton).toHaveTextContent("공유");
    expect(detailShareButton).toHaveAttribute(
      "aria-label",
      "공개 아티클 세부 페이지 공유",
    );
    expect(hero.querySelector("#heroOriginalLink").nextElementSibling).toBe(
      detailShareButton,
    );
    expect(hero.querySelectorAll(".detail-tags .article-tag")).toHaveLength(2);

    // 지운 정보는 사이드바 출처 카드가 계속 책임진다. 양쪽이 함께 사라지면
    // 중복 제거가 아니라 정보 유실이다.
    const sourceCard = container.querySelector(".source-card");
    expect(sourceCard.textContent).toMatch(/출처/);
    expect(sourceCard.textContent).toMatch(/원문 게시/);
    expect(sourceCard.querySelector("#sourceName").textContent).toBe("InfoQ");
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
