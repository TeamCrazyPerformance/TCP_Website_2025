const ARTICLE_LIST_RETURN_KEY = "tcp.tech-articles.list-return.v1";

function readScrollRestoration() {
  if (
    typeof window === "undefined" ||
    !("scrollRestoration" in window.history)
  ) {
    return undefined;
  }
  return window.history.scrollRestoration;
}

function setScrollRestoration(value) {
  if (
    typeof window === "undefined" ||
    !("scrollRestoration" in window.history) ||
    !value
  ) {
    return;
  }

  try {
    window.history.scrollRestoration = value;
  } catch {
    // 일부 사생활 보호 모드에서는 브라우저 기록 설정 변경이 막힐 수 있습니다.
  }
}

export function readArticleListReturn() {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(ARTICLE_LIST_RETURN_KEY) || "null",
    );
    if (
      !value ||
      typeof value.articleId !== "string" ||
      typeof value.listPath !== "string" ||
      typeof value.listLocationKey !== "string"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function rememberArticleListReturn({ articleId, location, card }) {
  if (
    typeof window === "undefined" ||
    !articleId ||
    location?.pathname !== "/tech-articles"
  ) {
    return;
  }

  const cardTop = card?.getBoundingClientRect?.().top;
  const value = {
    articleId,
    listPath: `${location.pathname}${location.search || ""}`,
    listLocationKey: location.key || "default",
    viewportOffset: Number.isFinite(cardTop) ? cardTop : 0,
    scrollY: Number.isFinite(window.scrollY) ? window.scrollY : 0,
    previousScrollRestoration: readScrollRestoration(),
  };

  try {
    window.sessionStorage.setItem(
      ARTICLE_LIST_RETURN_KEY,
      JSON.stringify(value),
    );
  } catch {
    return;
  }

  // 상세를 보는 동안 브라우저가 먼저 임의의 위치를 복원하지 않게 합니다.
  // 목록 데이터가 렌더된 뒤 아래의 앵커 기반 복원이 한 번만 실행됩니다.
  setScrollRestoration("manual");
}

export function holdArticleListReturn(articleId) {
  const value = readArticleListReturn();
  if (value?.articleId === articleId) setScrollRestoration("manual");
  return value;
}

export function releaseArticleListReturn(value = readArticleListReturn()) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(ARTICLE_LIST_RETURN_KEY);
  } catch {
    // 저장소 접근이 막혀도 브라우저의 기본 스크롤 정책은 복구합니다.
  }

  setScrollRestoration(value?.previousScrollRestoration || "auto");
}
