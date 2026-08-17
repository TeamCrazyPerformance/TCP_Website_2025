import { fireEvent, render, screen } from "@testing-library/react";
import TechArticlePagination, {
  getPageTokens,
} from "./components/tech-articles/TechArticlePagination";
import { SafeMarkdown } from "./components/tech-articles/TechArticleCommon";
import V9ConfirmDialog from "./components/tech-articles/V9ConfirmDialog";
import AdminTechArticleContent from "./components/tech-articles/AdminTechArticleContent";
import TechArticlePublicContent from "./components/tech-articles/TechArticlePublicContent";

test("기술 아티클 페이지 번호를 큰 목록에서도 간결하게 표시한다", () => {
  expect(getPageTokens(10, 20)).toEqual([
    1,
    "ellipsis",
    8,
    9,
    10,
    11,
    12,
    "ellipsis",
    20,
  ]);
});

test("다음 페이지 이동을 호출한다", () => {
  const onPageChange = jest.fn();
  render(
    <TechArticlePagination
      pagination={{ currentPage: 2, totalPages: 4 }}
      onPageChange={onPageChange}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
  expect(onPageChange).toHaveBeenCalledWith(3);
});

test("상세 요약 Markdown의 HTML을 실행하지 않고 안전하게 표시한다", () => {
  const { container } = render(
    <SafeMarkdown
      markdown={
        "# 핵심 요약\n\n**안전한 내용**\n\n<img src=x onerror=alert(1)>"
      }
    />,
  );

  expect(
    screen.getByRole("heading", { name: "핵심 요약", level: 3 }),
  ).toBeInTheDocument();
  expect(screen.getByText("안전한 내용")).toBeInTheDocument();
  expect(container.querySelector("img")).not.toBeInTheDocument();
});

// Shadow DOM 제거 후 v9 스타일은 .ta-admin / .ta-public 스코프로 격리.
// 스코프 CSS 불변식은 styles/techArticlesScope.test.js 가 검증.
test("관리 화면 래퍼는 v9 스타일을 .ta-admin 스코프로 격리한다", () => {
  const { container } = render(
    <AdminTechArticleContent>
      <p>admin content</p>
    </AdminTechArticleContent>,
  );

  const scope = container.querySelector(".ta-admin");
  expect(scope).not.toBeNull();
  expect(container.querySelector("[class*='v9-shadow-host']")).toBeNull();
  // 본문 폭: 기존 관리자 페이지와 같은 Tailwind 클래스
  expect(scope.querySelector(".container.mx-auto.max-w-7xl")).not.toBeNull();
  expect(screen.getByText("admin content")).toBeInTheDocument();
});

test("공개 화면 래퍼는 v9 스타일을 .ta-public 스코프로 격리한다", () => {
  const { container } = render(
    <TechArticlePublicContent>
      <p>public content</p>
    </TechArticlePublicContent>,
  );

  expect(container.querySelector(".ta-public")).not.toBeNull();
  expect(container.querySelector("[class*='v9-shadow-host']")).toBeNull();
  // 목업 사이트 헤더·푸터 -> 공용 Header/Footer
  expect(container.querySelector(".site-header")).toBeNull();
  expect(container.querySelector(".site-footer")).toBeNull();
  expect(screen.getByText("public content")).toBeInTheDocument();
});

test("관리자 확인 작업은 v9 디자인의 확인창을 사용한다", () => {
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  const showModal = jest.fn(function openDialog() {
    this.setAttribute("open", "");
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  const onSettle = jest.fn();

  render(
    <V9ConfirmDialog
      request={{
        title: "품질 통과로 판정할까요?",
        description: "AI 요약 단계로 전달합니다.",
        confirmLabel: "품질 통과",
        tone: "success",
      }}
      onSettle={onSettle}
    />,
  );

  expect(screen.getByRole("dialog")).toHaveClass(
    "admin-dialog",
    "confirm-dialog",
  );
  fireEvent.click(screen.getByRole("button", { name: "품질 통과" }));
  expect(onSettle).toHaveBeenCalledWith(true);
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: originalShowModal,
    });
  } else {
    delete HTMLDialogElement.prototype.showModal;
  }
});
