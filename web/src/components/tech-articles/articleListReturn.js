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
  }

  setScrollRestoration(value?.previousScrollRestoration || "auto");
}
