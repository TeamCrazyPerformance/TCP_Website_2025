/* Tech Articles 5개 화면의 렌더 스모크 테스트입니다.
 *
 * 셸 통합과 Shadow DOM 제거 과정에서 생기는 배선 오류는 빌드를 통과하고
 * 런타임에서만 드러납니다. 실제로 이 테스트로 사문이 된 <V9PublicFooter /> 와
 * shadowRoot 조회 잔재를 찾아냈습니다.
 *
 * API 는 모킹하며, 엔드포인트 정합성은 백엔드 라우트 대조로 따로 확인합니다. */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => {
    const ReactLib = require("react");
    // 훅 반환값은 렌더마다 같은 참조 유지. 새 객체 반환 시 의존성 배열이 매번 변해 무한 루프.
    const searchParams = new URLSearchParams();
    const setSearchParams = jest.fn();
    const searchParamsTuple = [searchParams, setSearchParams];
    const params = { articleId: "article-1" };
    const location = { pathname: "/tech-articles", search: "", state: null };
    const navigate = jest.fn();
    return {
      __esModule: true,
      Link: ({ to, children, ...rest }) =>
        ReactLib.createElement("a", { href: String(to), ...rest }, children),
      NavLink: ({ to, children, ...rest }) =>
        ReactLib.createElement("a", { href: String(to), ...rest }, children),
      useNavigate: () => navigate,
      useSearchParams: () => searchParamsTuple,
      useParams: () => params,
      useLocation: () => location,
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

  api.getTechArticles.mockResolvedValue({ items: [], pagination: PAGINATION });
  api.getTechArticleTags.mockResolvedValue({ items: ["AI", "데이터"] });
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
  test("아티클 목록이 .ta-public 스코프로 렌더되고 목록을 요청한다", async () => {
    const TechArticles = require("./TechArticles").default;
    const { container } = renderWithAuth(<TechArticles />);

    await waitFor(() => expect(api.getTechArticles).toHaveBeenCalled());

    expect(container.querySelector(".ta-public")).not.toBeNull();
    // 목업 사이트 헤더·푸터 -> 공용 Header/Footer
    expect(container.querySelector(".site-header")).toBeNull();
    expect(container.querySelector(".site-footer")).toBeNull();
    expect(container.querySelector("[class*='v9-shadow-host']")).toBeNull();
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

  test("수집 실행 패널은 기본 닫힘이고 라벨이 '비동기 수집 실행'이다", async () => {
    asAdmin();
    const AdminTechArticles = require("./admin/AdminTechArticles").default;
    const { container } = renderWithAuth(<AdminTechArticles />);

    await waitFor(() => expect(api.getAdminTechArticles).toHaveBeenCalled());

    const toggle = screen.getByRole("button", { name: /비동기 수집 실행/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector("#crawlPanel")).toBeNull();
    // 닫힘 상태에서는 소스 미조회
    expect(api.getCrawlSources).not.toHaveBeenCalled();
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
