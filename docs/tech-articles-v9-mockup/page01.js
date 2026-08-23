(() => {
  "use strict";

  const data = window.TCPTechArticlesData;
  if (!data) throw new Error("공개 아티클 목업 데이터를 불러오지 못했습니다.");

  const TAGS = data.tags;
  const MOCK_SERVER_ARTICLES = data.articles;
  const PAGE_SIZE = 20;
  const state = {
    query: "",
    selectedTags: new Set(),
    draftTags: new Set(),
    page: 1,
    response: null,
    requestId: 0,
  };

  const elements = {
    articleList: document.querySelector("#articleList"),
    resultCount: document.querySelector("#resultCount"),
    resultsLive: document.querySelector("#resultsLive"),
    resultsStart: document.querySelector("#resultsStart"),
    requestProgress: document.querySelector("#requestProgress"),
    lastCollectedValue: document.querySelector("#lastCollectedValue"),
    categoryFieldset: document.querySelector("#categoryFieldset"),
    searchFieldset: document.querySelector("#searchFieldset"),
    searchForm: document.querySelector("#searchForm"),
    searchInput: document.querySelector("#searchInput"),
    clearSearchButton: document.querySelector("#clearSearchButton"),
    desktopTagFilters: document.querySelector("#desktopTagFilters"),
    searchTagFilters: document.querySelector("#searchTagFilters"),
    mobileTagFilters: document.querySelector("#mobileTagFilters"),
    resetDraftTagsButton: document.querySelector("#resetDraftTagsButton"),
    resetSearchDraftTagsButton: document.querySelector("#resetSearchDraftTagsButton"),
    applyDesktopTagsButton: document.querySelector("#applyDesktopTagsButton"),
    resetAllButton: document.querySelector("#resetAllButton"),
    activeFilters: document.querySelector("#activeFilters"),
    filterChips: document.querySelector("#filterChips"),
    pagination: document.querySelector("#pagination"),
    filterDialog: document.querySelector("#filterDialog"),
    openFilterButton: document.querySelector("#openFilterButton"),
    openSearchFilterButton: document.querySelector("#openSearchFilterButton"),
    mobileFilterCount: document.querySelector("#mobileFilterCount"),
    searchMobileFilterCount: document.querySelector("#searchMobileFilterCount"),
    clearDraftTagsButton: document.querySelector("#clearDraftTagsButton"),
    applyTagsButton: document.querySelector("#applyTagsButton"),
    toast: document.querySelector("#toast"),
    menuButton: document.querySelector("#menuButton"),
    mobileNav: document.querySelector("#mobileNav"),
  };

  let toastTimer;
  let filterDialogOpener = elements.openFilterButton;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value, includeTime = false) {
    const options = {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = false;
    }
    return new Intl.DateTimeFormat("ko-KR", options).format(new Date(value));
  }

  function getTag(tagId) {
    return TAGS.find((tag) => tag.id === tagId);
  }

  function setsAreEqual(left, right) {
    return left.size === right.size && [...left].every((value) => right.has(value));
  }

  function hasConditions() {
    return Boolean(state.query) || state.selectedTags.size > 0;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function requestArticlesFromMockServer({ query = "", tags = [], page = 1 }) {
    await wait(240);
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    const selectedTags = new Set(tags);
    const filteredArticles = MOCK_SERVER_ARTICLES.filter((article) => {
      const searchable = `${article.title} ${article.oneLineSummary}`.toLocaleLowerCase("ko-KR");
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesTags = selectedTags.size === 0 || article.tags.some((tagId) => selectedTags.has(tagId));
      return matchesQuery && matchesTags;
    }).sort((left, right) => {
      const byPublishedAt = new Date(right.publishedAt) - new Date(left.publishedAt);
      if (byPublishedAt !== 0) return byPublishedAt;
      return right.id.localeCompare(left.id);
    });

    const totalCount = filteredArticles.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return {
      items: filteredArticles.slice(startIndex, startIndex + PAGE_SIZE),
      totalCount,
      currentPage,
      totalPages,
      pageSize: PAGE_SIZE,
      lastOriginalCollectedAt: data.lastOriginalCollectedAt,
    };
  }

  function makeTagButton(tag, selected, target) {
    return `
      <button
        class="tag-button tag-${escapeHtml(tag.id)}"
        type="button"
        data-tag="${escapeHtml(tag.id)}"
        data-target="${target}"
        aria-pressed="${selected}"
      >
        <i class="fas fa-check" aria-hidden="true"></i>
        ${escapeHtml(tag.label)}
      </button>`;
  }

  function renderTagFilters() {
    const tagButtons = (target) => TAGS.map((tag) =>
      makeTagButton(tag, state.draftTags.has(tag.id), target),
    ).join("");
    elements.desktopTagFilters.innerHTML = tagButtons("desktop");
    elements.searchTagFilters.innerHTML = tagButtons("search");
    elements.mobileTagFilters.innerHTML = tagButtons("mobile");

    const tagsChanged = !setsAreEqual(state.draftTags, state.selectedTags);
    elements.resetDraftTagsButton.disabled = state.draftTags.size === 0;
    elements.resetSearchDraftTagsButton.disabled = state.draftTags.size === 0;
    elements.applyDesktopTagsButton.disabled = !tagsChanged;
    elements.applyTagsButton.disabled = !tagsChanged;
    elements.mobileFilterCount.textContent = state.selectedTags.size;
    elements.searchMobileFilterCount.textContent = state.selectedTags.size;
    elements.openFilterButton.setAttribute(
      "aria-label",
      `분야 필터, ${state.selectedTags.size}개 적용 중`,
    );
    elements.openSearchFilterButton.setAttribute(
      "aria-label",
      `검색 분야 필터, ${state.selectedTags.size}개 적용 중`,
    );
  }

  function renderArticleTags(article) {
    if (article.tags.length === 0) return "";
    const visibleTags = article.tags.slice(0, 3);
    const hiddenCount = article.tags.length - visibleTags.length;
    const tagMarkup = visibleTags.map((tagId) => {
      const tag = getTag(tagId);
      return tag
        ? `<span class="article-tag tag-${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</span>`
        : "";
    }).join("");

    return `
      <div class="article-tags" aria-label="분야 태그">
        ${tagMarkup}
        ${hiddenCount > 0 ? `<span class="article-tag tag-more">+${hiddenCount}</span>` : ""}
      </div>`;
  }

  function renderArticleCard(article) {
    return `
      <article class="article-card" data-article-id="${escapeHtml(article.id)}">
        <div class="article-card-heading">
          <button class="article-title" type="button" data-action="detail" data-id="${escapeHtml(article.id)}">
            ${escapeHtml(article.title)}
          </button>
        </div>
        <p class="article-summary" title="${escapeHtml(article.oneLineSummary)}">
          ${escapeHtml(article.oneLineSummary)}
        </p>
        <div class="article-card-bottom">
          <div class="article-card-info">
            ${renderArticleTags(article)}
            <div class="article-meta">
              <span><i class="fas fa-building text-blue" aria-hidden="true"></i> 원출처 <strong>${escapeHtml(article.source)}</strong></span>
              <span class="meta-divider" aria-hidden="true">·</span>
              <span><i class="fas fa-calendar-day" aria-hidden="true"></i> <time datetime="${escapeHtml(article.publishedAt)}">${formatDate(article.publishedAt)}</time></span>
            </div>
          </div>
          <button class="share-button" type="button" data-action="share" data-id="${escapeHtml(article.id)}" aria-label="${escapeHtml(article.title)} 세부 페이지 공유">
            공유 <i class="fas fa-share-nodes" aria-hidden="true"></i>
          </button>
        </div>
      </article>`;
  }

  function renderSkeletons() {
    elements.articleList.innerHTML = Array.from({ length: 4 }, () => `
      <div class="article-card skeleton-card" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>`).join("");
  }

  function renderActiveFilters() {
    const chips = [];
    if (state.query) {
      chips.push(`
        <span class="filter-chip">
          검색어: ${escapeHtml(state.query)}
          <button type="button" data-remove-filter="query" aria-label="검색어 ${escapeHtml(state.query)} 조건 해제">×</button>
        </span>`);
    }
    state.selectedTags.forEach((tagId) => {
      const tag = getTag(tagId);
      if (!tag) return;
      chips.push(`
        <span class="filter-chip">
          ${escapeHtml(tag.label)}
          <button type="button" data-remove-filter="${escapeHtml(tag.id)}" aria-label="${escapeHtml(tag.label)} 조건 해제">×</button>
        </span>`);
    });
    elements.filterChips.innerHTML = chips.join("");
    elements.activeFilters.hidden = chips.length === 0;
    elements.resetAllButton.hidden = chips.length === 0;
  }

  function getPageTokens(currentPage, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages = new Set([1, totalPages, currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2]);
    const validPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right);
    const tokens = [];
    validPages.forEach((page, index) => {
      const previousPage = validPages[index - 1];
      if (previousPage && page - previousPage > 1) tokens.push("ellipsis");
      tokens.push(page);
    });
    return tokens;
  }

  function renderPagination(response) {
    if (response.totalCount === 0) {
      elements.pagination.innerHTML = "";
      return;
    }
    const pageButtons = getPageTokens(response.currentPage, response.totalPages).map((token) => {
      if (token === "ellipsis") return '<span class="page-ellipsis" aria-hidden="true">…</span>';
      return `<button class="page-button page-number" type="button" data-page="${token}" ${token === response.currentPage ? 'aria-current="page"' : ""} aria-label="${token}페이지로 이동">${token}</button>`;
    }).join("");
    elements.pagination.innerHTML = `
      <button class="page-button" type="button" data-page="${response.currentPage - 1}" ${response.currentPage === 1 ? "disabled" : ""} aria-label="이전 페이지">이전</button>
      <div class="page-number-list">${pageButtons}</div>
      <button class="page-button" type="button" data-page="${response.currentPage + 1}" ${response.currentPage === response.totalPages ? "disabled" : ""} aria-label="다음 페이지">다음</button>
      <span class="pagination-status">현재 ${response.currentPage} / ${response.totalPages}페이지</span>`;
  }

  function renderResponse(response) {
    const startIndex = (response.currentPage - 1) * response.pageSize;
    const endIndex = Math.min(startIndex + response.items.length, response.totalCount);
    elements.lastCollectedValue.textContent = `${formatDate(response.lastOriginalCollectedAt, true)} KST`;

    if (response.totalCount === 0) {
      elements.resultCount.textContent = "검색 결과 0건";
      elements.articleList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <h3>조건에 맞는 아티클이 없습니다</h3>
          <p>검색어를 바꾸거나 적용된 분야 태그를 초기화해 보세요.</p>
          <button type="button" data-action="reset">전체 조건 초기화</button>
        </div>`;
    } else {
      elements.resultCount.textContent = hasConditions()
        ? `총 ${response.totalCount}건 중 ${startIndex + 1}–${endIndex}건`
        : `전체 ${response.totalCount}건 ⋅ 원문 게시일 최신순`;
      elements.articleList.innerHTML = response.items.map(renderArticleCard).join("");
    }
    renderPagination(response);
    renderActiveFilters();
    renderTagFilters();
  }

  function setLoading(isLoading, isInitial = false) {
    elements.categoryFieldset.disabled = isLoading;
    elements.searchFieldset.disabled = isLoading;
    elements.requestProgress.hidden = !isLoading || isInitial;
    elements.articleList.classList.toggle("is-loading", isLoading && !isInitial);
    if (isLoading && isInitial) {
      elements.resultCount.textContent = "아티클을 불러오는 중입니다.";
      renderSkeletons();
    }
  }

  function updateUrl(mode = "replace") {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.selectedTags.size > 0) params.set("tags", [...state.selectedTags].sort().join(","));
    if (state.page > 1) params.set("page", String(state.page));
    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;
    try {
      window.history[`${mode}State`](null, "", nextUrl);
    } catch {
      // file:// 환경에서 주소 상태 저장이 제한되어도 필터 기능은 유지한다.
    }
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const query = (params.get("q") || "").trim();
    const validTagIds = new Set(TAGS.map((tag) => tag.id));
    const selectedTags = (params.get("tags") || "").split(",").filter((tagId) => validTagIds.has(tagId));
    const requestedPage = Number.parseInt(params.get("page") || "1", 10);
    state.query = query;
    state.selectedTags = new Set(selectedTags);
    state.draftTags = new Set(selectedTags);
    state.page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    elements.searchInput.value = query;
    elements.clearSearchButton.hidden = query.length === 0;
  }

  function announceResults(response) {
    elements.resultsLive.textContent = "";
    window.setTimeout(() => {
      elements.resultsLive.textContent = response.totalCount === 0
        ? "조건에 맞는 아티클이 없습니다."
        : `아티클 ${response.totalCount}건 중 ${response.items.length}건을 표시합니다.`;
    }, 30);
  }

  function moveToResults() {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    elements.resultsStart.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(() => elements.resultsStart.focus({ preventScroll: true }), 350);
  }

  async function loadArticles({ announce = false, historyMode = "replace", syncUrl = true, move = false } = {}) {
    const requestId = state.requestId + 1;
    state.requestId = requestId;
    const isInitial = state.response === null;
    setLoading(true, isInitial);
    try {
      const response = await requestArticlesFromMockServer({ query: state.query, tags: [...state.selectedTags], page: state.page });
      if (requestId !== state.requestId) return;
      state.response = response;
      state.page = response.currentPage;
      renderResponse(response);
      setLoading(false);
      if (syncUrl) updateUrl(historyMode);
      if (announce) announceResults(response);
      if (move) moveToResults();
    } catch {
      if (requestId !== state.requestId) return;
      setLoading(false);
      elements.resultCount.textContent = "목록을 표시할 수 없습니다.";
      elements.articleList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <h3>아티클을 불러오지 못했습니다</h3>
          <p>잠시 후 다시 시도해 주세요.</p>
          <button type="button" data-action="retry">다시 시도</button>
        </div>`;
      elements.pagination.innerHTML = "";
    }
  }

  function applySearch() {
    state.query = elements.searchInput.value.trim();
    state.selectedTags = new Set(state.draftTags);
    state.page = 1;
    elements.clearSearchButton.hidden = state.query.length === 0;
    void loadArticles({ announce: true, historyMode: "push", move: true });
  }

  function applySelectedTags() {
    state.selectedTags = new Set(state.draftTags);
    state.page = 1;
    void loadArticles({ announce: true, historyMode: "push", move: true });
  }

  function resetAll({ move = true } = {}) {
    state.query = "";
    state.selectedTags.clear();
    state.draftTags.clear();
    state.page = 1;
    elements.searchInput.value = "";
    elements.clearSearchButton.hidden = true;
    renderTagFilters();
    void loadArticles({ announce: true, historyMode: "push", move });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.querySelector("p").textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3000);
  }

  function makeDetailUrl(articleId) {
    const detailUrl = new URL("./article-detail.html", window.location.href);
    detailUrl.search = "";
    detailUrl.hash = "";
    detailUrl.searchParams.set("id", articleId);
    return detailUrl.href;
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // 권한이 없으면 아래 호환 복사 방식을 시도한다.
      }
    }
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    textArea.remove();
    return copied;
  }

  async function shareArticle(article) {
    const detailUrl = makeDetailUrl(article.id);
    const canUseNativeShare = typeof navigator.share === "function" && ["http:", "https:"].includes(new URL(detailUrl).protocol);
    if (canUseNativeShare) {
      try {
        await navigator.share({ title: article.title, text: article.oneLineSummary, url: detailUrl });
        showToast("세부 페이지를 공유했습니다.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const copied = await copyText(detailUrl);
    showToast(copied ? "세부 페이지 주소를 복사했습니다." : `세부 페이지 주소: ${detailUrl}`);
  }

  function toggleDraftTag(tagId, target) {
    if (state.draftTags.has(tagId)) state.draftTags.delete(tagId);
    else state.draftTags.add(tagId);
    renderTagFilters();
    document.querySelector(`[data-target="${target}"][data-tag="${tagId}"]`)?.focus();
  }

  function closeMobileMenu() {
    elements.mobileNav.hidden = true;
    elements.menuButton.setAttribute("aria-expanded", "false");
    elements.menuButton.setAttribute("aria-label", "모바일 메뉴 열기");
    elements.menuButton.querySelector("i").className = "fas fa-bars";
  }

  function openTagFilterDialog(opener) {
    filterDialogOpener = opener;
    state.draftTags = new Set(state.selectedTags);
    renderTagFilters();
    elements.filterDialog.returnValue = "";
    opener.setAttribute("aria-expanded", "true");
    elements.filterDialog.showModal();
  }

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applySearch();
  });
  elements.searchInput.addEventListener("input", () => {
    elements.clearSearchButton.hidden = elements.searchInput.value.length === 0;
  });
  elements.clearSearchButton.addEventListener("click", () => {
    elements.searchInput.value = "";
    state.query = "";
    state.page = 1;
    elements.clearSearchButton.hidden = true;
    void loadArticles({ announce: true, historyMode: "push", move: true });
  });
  elements.desktopTagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (button) toggleDraftTag(button.dataset.tag, "desktop");
  });
  elements.searchTagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (button) toggleDraftTag(button.dataset.tag, "search");
  });
  elements.resetDraftTagsButton.addEventListener("click", () => {
    state.draftTags.clear();
    renderTagFilters();
  });
  elements.resetSearchDraftTagsButton.addEventListener("click", () => {
    state.draftTags.clear();
    renderTagFilters();
  });
  elements.applyDesktopTagsButton.addEventListener("click", applySelectedTags);
  elements.resetAllButton.addEventListener("click", () => resetAll());
  elements.filterChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (!button) return;
    if (button.dataset.removeFilter === "query") {
      state.query = "";
      elements.searchInput.value = "";
      elements.clearSearchButton.hidden = true;
    } else {
      state.selectedTags.delete(button.dataset.removeFilter);
      state.draftTags = new Set(state.selectedTags);
    }
    state.page = 1;
    renderTagFilters();
    void loadArticles({ announce: true, historyMode: "push", move: true });
  });
  elements.articleList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button?.dataset.action === "share") {
      const article = state.response?.items.find((item) => item.id === button.dataset.id);
      if (article) void shareArticle(article);
      return;
    }
    if (button?.dataset.action === "detail") {
      window.location.href = `./article-detail.html?id=${encodeURIComponent(button.dataset.id)}`;
      return;
    }
    if (button?.dataset.action === "reset") return resetAll();
    if (button?.dataset.action === "retry") return void loadArticles({ announce: true });
    const card = event.target.closest("[data-article-id]");
    if (card) window.location.href = `./article-detail.html?id=${encodeURIComponent(card.dataset.articleId)}`;
  });
  elements.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    void loadArticles({ announce: true, historyMode: "push", move: true });
  });
  elements.openFilterButton.addEventListener("click", () => openTagFilterDialog(elements.openFilterButton));
  elements.openSearchFilterButton.addEventListener("click", () => openTagFilterDialog(elements.openSearchFilterButton));
  elements.mobileTagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (button) toggleDraftTag(button.dataset.tag, "mobile");
  });
  elements.clearDraftTagsButton.addEventListener("click", () => {
    state.draftTags.clear();
    renderTagFilters();
  });
  elements.applyTagsButton.addEventListener("click", () => {
    elements.filterDialog.close("apply");
    applySelectedTags();
  });
  elements.filterDialog.addEventListener("close", () => {
    if (elements.filterDialog.returnValue !== "apply") {
      state.draftTags = new Set(state.selectedTags);
      renderTagFilters();
    }
    filterDialogOpener.setAttribute("aria-expanded", "false");
    filterDialogOpener.focus();
  });
  elements.filterDialog.addEventListener("click", (event) => {
    if (event.target === elements.filterDialog) elements.filterDialog.close();
  });
  document.querySelectorAll(".demo-action, .demo-link").forEach((control) => {
    control.addEventListener("click", (event) => {
      if (control.matches("a")) event.preventDefault();
      showToast("이 목업에서는 Tech Articles 화면만 동작합니다.");
    });
  });
  elements.menuButton.addEventListener("click", () => {
    const willOpen = elements.mobileNav.hidden;
    elements.mobileNav.hidden = !willOpen;
    elements.menuButton.setAttribute("aria-expanded", String(willOpen));
    elements.menuButton.setAttribute("aria-label", willOpen ? "모바일 메뉴 닫기" : "모바일 메뉴 열기");
    elements.menuButton.querySelector("i").className = willOpen ? "fas fa-times" : "fas fa-bars";
  });
  elements.mobileNav.addEventListener("click", (event) => {
    if (!event.target.closest('a[aria-current="page"]')) closeMobileMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1280) closeMobileMenu();
  });
  window.addEventListener("popstate", () => {
    readUrlState();
    renderTagFilters();
    void loadArticles({ announce: true, syncUrl: false });
  });

  readUrlState();
  renderTagFilters();
  renderSkeletons();
  void loadArticles();
})();
