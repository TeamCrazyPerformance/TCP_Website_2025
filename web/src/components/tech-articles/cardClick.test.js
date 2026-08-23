/* 아티클 카드의 전체 영역 클릭 규칙을 검증합니다.
 *
 * 공유 버튼을 제외한 카드 어디를 눌러도 상세로 이동해야 하고,
 * 동시에 제목 <Link> 의 앵커 기본 동작(새 탭으로 열기 등)도 유지해야 합니다. */
import { shouldOpenFromCardClick } from "./TechArticleCommon";

// 실제 카드 구조로 event.target 재현
function buildCard() {
  const card = document.createElement("article");
  card.className = "article-card";
  card.innerHTML = `
    <div class="article-card-heading">
      <a class="article-title" href="/tech-articles/abc">제목</a>
    </div>
    <p class="article-summary">한 줄 요약</p>
    <div class="article-card-bottom">
      <div class="article-card-info">
        <span class="article-tag">태그</span>
        <div class="article-meta"><span><time>2026-01-01</time></span></div>
      </div>
      <button class="share-button" type="button">공유</button>
    </div>
  `;
  document.body.appendChild(card);
  return card;
}

function clickOn(selectorOrNode, overrides = {}) {
  const target =
    typeof selectorOrNode === "string"
      ? document.querySelector(selectorOrNode)
      : selectorOrNode;
  expect(target).not.toBeNull();
  return shouldOpenFromCardClick({
    target,
    button: 0,
    defaultPrevented: false,
    ...overrides,
  });
}

describe("카드 전체 영역 클릭", () => {
  let card;

  beforeEach(() => {
    document.body.innerHTML = "";
    card = buildCard();
    window.getSelection = () => ({ toString: () => "" });
  });

  test("카드 여백을 누르면 상세로 이동한다", () => {
    expect(clickOn(card)).toBe(true);
  });

  test("요약문을 누르면 상세로 이동한다", () => {
    expect(clickOn(".article-summary")).toBe(true);
  });

  test("태그와 날짜를 누르면 상세로 이동한다", () => {
    expect(clickOn(".article-tag")).toBe(true);
    expect(clickOn("time")).toBe(true);
  });

  test("공유 버튼은 카드 이동을 가로채지 않는다", () => {
    expect(clickOn(".share-button")).toBe(false);
  });

  test("제목 링크는 앵커가 직접 처리한다", () => {
    expect(clickOn(".article-title")).toBe(false);
  });

  test("텍스트를 선택하는 중이면 이동하지 않는다", () => {
    window.getSelection = () => ({ toString: () => "선택된 본문" });
    expect(clickOn(".article-summary")).toBe(false);
  });

  test("수정키 조합은 가로채지 않는다", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
      expect(clickOn(card, { [key]: true })).toBe(false);
    }
  });

  test("좌클릭이 아니면 가로채지 않는다", () => {
    expect(clickOn(card, { button: 1 })).toBe(false);
  });

  test("이미 처리된 이벤트는 가로채지 않는다", () => {
    expect(clickOn(card, { defaultPrevented: true })).toBe(false);
  });
});
