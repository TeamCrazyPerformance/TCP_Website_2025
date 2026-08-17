(() => {
  "use strict";

  const data = window.TCPTechArticlesData;
  let toastTimer;

  function formatDate(value) {
    return `${new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value))} KST`;
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.querySelector("p").textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function bindDemoControls() {
    document.querySelectorAll(".demo-link, .demo-action").forEach((control) => {
      control.addEventListener("click", (event) => {
        if (control.matches("a")) event.preventDefault();
        showToast("이 목업에서는 Tech Articles 관련 화면만 동작합니다.");
      });
    });
  }

  function bindPublicHeader() {
    const menuButton = document.querySelector("#menuButton");
    const mobileNav = document.querySelector("#mobileNav");
    if (!menuButton || !mobileNav) return;

    const closeMenu = () => {
      mobileNav.hidden = true;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "모바일 메뉴 열기");
      menuButton.querySelector("i").className = "fas fa-bars";
    };

    menuButton.addEventListener("click", () => {
      const willOpen = mobileNav.hidden;
      mobileNav.hidden = !willOpen;
      menuButton.setAttribute("aria-expanded", String(willOpen));
      menuButton.setAttribute("aria-label", willOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기");
      menuButton.querySelector("i").className = willOpen ? "fas fa-times" : "fas fa-bars";
    });
    mobileNav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1280) closeMenu();
    });
  }

  function renderMarkdown(markdown, target) {
    const normalized = String(markdown || "").replace(/\r\n?/g, "\n").trim();
    if (!normalized) {
      target.textContent = "표시할 상세 요약이 없습니다.";
      return;
    }
    if (typeof window.markdownit !== "function" || !window.DOMPurify?.sanitize) {
      target.textContent = normalized;
      return;
    }

    const renderer = window.markdownit({ html: false, linkify: false, breaks: false, typographer: false });
    renderer.validateLink = (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value, window.location.href).protocol);
      } catch {
        return false;
      }
    };
    const normalizeHeading = (defaultRule) => (tokens, index, options, environment, markdownRenderer) => {
      const level = Number.parseInt(tokens[index].tag.slice(1), 10);
      tokens[index].tag = `h${Math.min(6, Math.max(3, level))}`;
      return defaultRule
        ? defaultRule(tokens, index, options, environment, markdownRenderer)
        : markdownRenderer.renderToken(tokens, index, options);
    };
    renderer.renderer.rules.heading_open = normalizeHeading(renderer.renderer.rules.heading_open);
    renderer.renderer.rules.heading_close = normalizeHeading(renderer.renderer.rules.heading_close);

    target.innerHTML = window.DOMPurify.sanitize(renderer.render(normalized), {
      ALLOWED_TAGS: ["p", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "code", "pre", "blockquote", "hr", "br"],
      ALLOWED_ATTR: [],
    });
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setTime(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.dateTime = value;
    element.textContent = formatDate(value);
  }

  function setLink(selector, article) {
    const link = document.querySelector(selector);
    if (!link) return;
    link.href = article.originalUrl;
  }

  function renderTags(article) {
    const container = document.querySelector("#detailTags");
    const tagMap = new Map(data.tags.map((tag) => [tag.id, tag]));
    container.replaceChildren();
    if (article.tags.length === 0) {
      const emptyTag = document.createElement("span");
      emptyTag.className = "article-tag tag-more";
      emptyTag.textContent = "분야 미분류";
      container.append(emptyTag);
      return;
    }
    article.tags.forEach((tagId) => {
      const tag = tagMap.get(tagId);
      if (!tag) return;
      const tagElement = document.createElement("span");
      tagElement.className = `article-tag tag-${tag.id}`;
      tagElement.textContent = tag.label;
      container.append(tagElement);
    });
  }

  function renderArticle(article) {
    document.title = `${article.title} | TCP Tech Articles`;
    setText("#articleTitle", article.title);
    setText("#heroSourceName", article.source);
    setLink("#heroOriginalLink", article);
    setTime("#heroPublishedAt", article.publishedAt);
    renderTags(article);

    const oneLineSummary = document.querySelector("#oneLineSummary");
    oneLineSummary.textContent = article.oneLineSummary;
    oneLineSummary.hidden = false;
    renderMarkdown(article.summaryMarkdown, document.querySelector("#summaryBody"));

    setText("#scoreValue", article.score);
    const scoreMeter = document.querySelector("#scoreMeter");
    scoreMeter.value = article.score;
    scoreMeter.textContent = `${article.score}점`;
    scoreMeter.setAttribute("aria-label", `가치 점수 100점 만점에 ${article.score}점`);
    setText("#scoreRelevance", `${article.scoreBreakdown.relevance} / 100`);
    setText("#scoreDepth", `${article.scoreBreakdown.depth} / 100`);
    setText("#scoreFreshness", `${article.scoreBreakdown.freshness} / 100`);
    setText("#scoreSourceTrust", `${article.scoreBreakdown.sourceTrust} / 100`);

    setText("#sourceName", article.source);
    setText("#sourceDomain", article.sourceDomain);
    const language = document.querySelector("#sourceLanguage");
    language.replaceChildren();
    const languageLabel = document.createElement("strong");
    languageLabel.textContent = article.originalLanguage?.label || "확인되지 않음";
    language.append(languageLabel);
    if (article.originalLanguage?.code) {
      const languageCode = document.createElement("span");
      languageCode.textContent = `(${article.originalLanguage.code})`;
      language.append(languageCode);
    }

    const sourceLink = document.querySelector("#sourceOriginalLink");
    sourceLink.href = article.originalUrl;
    setText("#sourceOriginalUrlText", `${article.sourceDomain}/articles/${article.id}`);
    setTime("#sourcePublishedAt", article.publishedAt);
    setTime("#sourceCollectedAt", article.collectedAt);
  }

  function renderMissingArticleNotice(requestedId) {
    const notice = document.createElement("p");
    notice.className = "detail-data-error";
    notice.setAttribute("role", "status");
    notice.textContent = requestedId
      ? "요청한 아티클을 찾을 수 없어 대표 아티클을 표시합니다. 목록에서 다시 선택해 주세요."
      : "아티클 ID가 없어 대표 아티클을 표시합니다. 목록에서 아티클을 선택하면 해당 내용이 표시됩니다.";
    document.querySelector(".detail-layout").before(notice);
  }

  function init() {
    bindPublicHeader();
    bindDemoControls();
    if (!data?.articles?.length) {
      setText("#articleTitle", "아티클 데이터를 불러오지 못했습니다.");
      return;
    }

    const requestedId = new URLSearchParams(window.location.search).get("id");
    const requestedArticle = requestedId ? data.getArticleById(requestedId) : null;
    const fallbackArticle = data.getArticleById("article-003") || data.articles[0];
    if (!requestedArticle) renderMissingArticleNotice(requestedId);
    renderArticle(requestedArticle || fallbackArticle);
  }

  init();
})();
