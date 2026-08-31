import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import {
  getTechArticles,
  getTechArticleSources,
  getTechArticleTags,
  techArticleErrorMessage,
} from "../api/techArticles";
import {
  formatRelativeFromNow,
  formatTechArticleDate,
  shouldOpenFromCardClick,
} from "../components/tech-articles/TechArticleCommon";
import { shareArticle } from "../components/tech-articles/articleShare";
import {
  readArticleListReturn,
  releaseArticleListReturn,
  rememberArticleListReturn,
} from "../components/tech-articles/articleListReturn";
import { getPageTokens } from "../components/tech-articles/TechArticlePagination";
import TechArticlePublicContent from "../components/tech-articles/TechArticlePublicContent";

const PAGE_SIZE = 20;
const TAG_CLASS_NAMES = {
  AI: "tag-ai-ml",
  "애플리케이션 개발": "tag-frontend",
  모바일: "tag-mobile",
  "프로그래밍 언어": "tag-language-framework",
  데이터: "tag-data-db",
  클라우드: "tag-cloud",
  DevOps: "tag-devops",
  보안: "tag-security",
  네트워크: "tag-backend",
  "소프트웨어 아키텍처": "tag-architecture",
  "개발자 도구": "tag-developer-tools",
  "소프트웨어 품질": "tag-software-quality",
  오픈소스: "tag-open-source",
  "개발 조직": "tag-development-organization",
  "산업 동향": "tag-industry-trends",
};

export function v9TagClassName(tag) {
  return TAG_CLASS_NAMES[tag] || "tag-architecture";
}

function readTags(searchParams) {
  return [
    ...new Set(
      searchParams
        .getAll("tags")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function readSources(searchParams) {
  return (searchParams.get("sources") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function SourcePickerDialog({
  dialogRef,
  sources,
  draft,
  onToggle,
  onApply,
  applyDisabled,
  onReset,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? sources.filter(
        (source) =>
          source.name.toLowerCase().includes(normalized) ||
          source.domain.toLowerCase().includes(normalized) ||
          (source.category || "").toLowerCase().includes(normalized),
      )
    : sources;
  return (
    <dialog
      className="source-dialog"
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form method="dialog" className="source-dialog-inner">
        <header className="source-dialog-header">
          <h2>소스 선택</h2>
          <button
            className="source-dialog-close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <i className="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </header>

        <div className="source-search">
          <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            value={query}
            placeholder="소스 이름이나 주소로 찾기"
            aria-label="소스 검색"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <ul className="source-option-list">
          {visible.length === 0 && (
            <li className="source-empty">검색 결과가 없습니다.</li>
          )}
          {visible.map((source) => {
            const checked = draft.includes(source.id);
            return (
              <li key={source.id}>
                <label
                  className={`source-option ${checked ? "is-checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(source.id)}
                  />
                  <span className="source-option-text">
                    <strong>{source.name}</strong>
                    <small>{source.domain}</small>
                  </span>
                  <span className="source-option-count">{source.count}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <footer className="source-dialog-actions">
          <button type="button" className="source-reset" onClick={onReset}>
            초기화
          </button>
          <button
            type="button"
            className="source-apply"
            onClick={onApply}
            disabled={applyDisabled}
          >
            적용
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function sameValues(left, right) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function moveTo(id, block = "start") {
  document.getElementById(id)?.scrollIntoView({ behavior: "auto", block });
}

function moveToResults() {
  moveTo("resultsStart");
}

function V9TagButtons({
  tags,
  selectedTags,
  onToggle,
  label,
  id,
  className = "tag-filter-list",
}) {
  return (
    <div id={id} className={className} aria-label={label}>
      {tags.map((tag) => {
        const selected = selectedTags.includes(tag);
        return (
          <button
            className={`tag-button ${v9TagClassName(tag)}`}
            type="button"
            key={tag}
            aria-pressed={selected}
            onClick={() => onToggle(tag)}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

export function V9ArticleTags({
  tags = [],
  className = "article-tags",
  limit = 3,
  id,
}) {
  const visibleTags = Number.isFinite(limit) ? tags.slice(0, limit) : tags;
  const hiddenCount = tags.length - visibleTags.length;
  return (
    <div id={id} className={className} aria-label="분야 태그">
      {visibleTags.map((tag) => (
        <span className={`article-tag ${v9TagClassName(tag)}`} key={tag}>
          {tag}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="article-tag tag-more">+{hiddenCount}</span>
      )}
    </div>
  );
}

function ArticleMeta({ article, className = "" }) {
  return (
    <div className={`article-meta ${className}`.trim()}>
      <span>
        <i className="fas fa-building text-blue" aria-hidden="true"></i>
        <span className="article-source-label">원출처</span>{" "}
        <strong>
          {article.source?.name || article.source?.domain || "확인되지 않음"}
        </strong>
      </span>
      <span className="meta-divider" aria-hidden="true">
        ·
      </span>
      <span>
        <i className="fas fa-calendar-day" aria-hidden="true"></i>
        <time dateTime={article.originalPublishedAt}>
          {formatTechArticleDate(article.originalPublishedAt)}
        </time>
      </span>
    </div>
  );
}

function TechArticles() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10) || 1,
  );
  const keyword = (
    searchParams.get("q") ||
    searchParams.get("keyword") ||
    ""
  ).trim();
  const selectedTags = readTags(searchParams);
  const selectedTagKey = selectedTags.join("\u0000");
  const selectedSources = readSources(searchParams);
  const selectedSourceKey = selectedSources.join("\u0000");

  const [tags, setTags] = useState([]);
  const [sources, setSources] = useState([]);
  const [draftSources, setDraftSources] = useState(selectedSources);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [draftTags, setDraftTags] = useState(selectedTags);
  const [searchInput, setSearchInput] = useState(keyword);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [tagError, setTagError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [listScrollRevision, setListScrollRevision] = useState(0);
  const requestId = useRef(0);
  const pendingListScroll = useRef(null);
  const listScrollTarget = useRef({ id: "resultsStart", block: "start" });
  const filterDialogRef = useRef(null);
  const sourceDialogRef = useRef(null);

  useEffect(() => {
    setDraftTags(readTags(searchParams));
    setDraftSources(readSources(searchParams));
    setSearchInput(
      (searchParams.get("q") || searchParams.get("keyword") || "").trim(),
    );
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    getTechArticleTags()
      .then((data) => {
        if (active) setTags(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((requestError) => {
        if (active) {
          setTagError(
            techArticleErrorMessage(
              requestError,
              "분야 목록을 불러오지 못했습니다.",
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getTechArticleSources()
      .then((data) => {
        if (active) setSources(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setSources([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (filterOpen && !dialog.open) dialog.showModal();
    if (!filterOpen && dialog.open) dialog.close();
  }, [filterOpen]);

  useEffect(() => {
    const dialog = sourceDialogRef.current;
    if (!dialog) return;
    if (sourceOpen && !dialog.open) dialog.showModal();
    if (!sourceOpen && dialog.open) dialog.close();
  }, [sourceOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useLayoutEffect(() => {
    if (listScrollRevision === 0) return;
    moveTo(listScrollTarget.current.id, listScrollTarget.current.block);
  }, [listScrollRevision]);

  useLayoutEffect(() => {
    const returnState = readArticleListReturn();
    if (!returnState) return;

    const listPath = `${location.pathname}${location.search || ""}`;

    const requestedRestore = Boolean(location.state?.restoreListPosition);
    const shouldRestore =
      returnState.listPath === listPath &&
      (requestedRestore ||
        (navigationType === "POP" &&
          returnState.listLocationKey === (location.key || "default")));

    if (!shouldRestore) {
      releaseArticleListReturn(returnState);
      return;
    }

    if (isLoading) return;

    const card = Array.from(
      document.querySelectorAll(".article-card[data-article-id]"),
    ).find((element) => element.dataset.articleId === returnState.articleId);

    if (card) {
      const currentCardTop = card.getBoundingClientRect().top + window.scrollY;
      const viewportOffset = Number.isFinite(returnState.viewportOffset)
        ? returnState.viewportOffset
        : 0;
      window.scrollTo({
        top: Math.max(0, currentCardTop - viewportOffset),
        behavior: "auto",
      });
    } else {
      moveToResults();
    }

    releaseArticleListReturn(returnState);
  }, [
    isLoading,
    location.key,
    location.pathname,
    location.search,
    location.state,
    navigationType,
  ]);

  const completePendingListScroll = useCallback(() => {
    if (!pendingListScroll.current) return;
    listScrollTarget.current = pendingListScroll.current;
    pendingListScroll.current = null;
    setListScrollRevision((current) => current + 1);
  }, []);

  const loadArticles = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError("");
    try {
      const data = await getTechArticles({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        tags: selectedTags,
        sources: selectedSources,
      });
      if (requestId.current !== currentRequest) return;
      setResponse(data);
      completePendingListScroll();
      if (data?.pagination?.totalPages && page > data.pagination.totalPages) {
        const next = new URLSearchParams(searchParams);
        next.set("page", String(data.pagination.totalPages));
        setSearchParams(next, { replace: true });
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setError(
          techArticleErrorMessage(
            requestError,
            "아티클 목록을 불러오지 못했습니다.",
          ),
        );
        completePendingListScroll();
      }
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    keyword,
    page,
    searchParams,
    selectedTagKey,
    selectedSourceKey,
    completePendingListScroll,
    setSearchParams,
  ]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const lastCheckedRelative = useMemo(
    () => formatRelativeFromNow(response?.lastCrawledAt),
    [response],
  );
  const lastCheckedAbsolute = response?.lastCrawledAt
    ? `${formatTechArticleDate(response.lastCrawledAt, true)} KST`
    : undefined;
  const newCount = useMemo(
    () => (response?.items || []).filter((item) => item.isNew).length,
    [response],
  );
  const applyConditions = ({
    nextKeyword = keyword,
    nextTags = selectedTags,
    nextSources = selectedSources,
    nextPage = 1,
    scroll = true,
    scrollTarget = "resultsStart",
    scrollBlock = "start",
  } = {}) => {
    const conditionsChanged =
      nextKeyword.trim() !== keyword ||
      !sameValues(nextTags, selectedTags) ||
      !sameValues(nextSources, selectedSources) ||
      nextPage !== page;
    const next = new URLSearchParams();
    if (nextKeyword.trim()) next.set("q", nextKeyword.trim());
    if (nextTags.length) next.set("tags", nextTags.join(","));
    if (nextSources.length) next.set("sources", nextSources.join(","));
    if (nextPage > 1) next.set("page", String(nextPage));
    if (scroll) {
      if (conditionsChanged)
        pendingListScroll.current = { id: scrollTarget, block: scrollBlock };
      else moveTo(scrollTarget, scrollBlock);
    }
    setSearchParams(next);
  };

  const toggleDraftTag = (tag) => {
    setDraftTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const resetAll = () => {
    setDraftTags([]);
    setDraftSources([]);
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const openArticleFromCard = (event, articleId) => {
    if (!shouldOpenFromCardClick(event)) return;
    rememberArticleListReturn({
      articleId,
      location,
      card: event.currentTarget,
    });
    navigate(`/tech-articles/${encodeURIComponent(articleId)}`);
  };

  const rememberReturnFromTitle = (event, articleId) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    rememberArticleListReturn({
      articleId,
      location,
      card: event.currentTarget.closest(".article-card"),
    });
  };

  const handleShare = async (article) => {
    const url = `${window.location.origin}/tech-articles/${encodeURIComponent(article.id)}`;
    const result = await shareArticle({
      title: article.title,
      text: article.oneLineSummary,
      url,
    });

    if (result === "shared") {
      setToast("세부 페이지를 공유했습니다.");
    } else if (result === "copied") {
      setToast("세부 페이지 주소를 복사했습니다.");
    } else if (result === "failed") {
      setToast("세부 페이지 주소를 복사하지 못했습니다.");
    }
  };

  const pagination = response?.pagination;
  const start = pagination
    ? (pagination.currentPage - 1) * pagination.pageSize + 1
    : 0;
  const end = pagination
    ? Math.min(
        start + (response?.items?.length || 0) - 1,
        pagination.totalCount,
      )
    : 0;
  const hasConditions = Boolean(
    keyword || selectedTags.length || selectedSources.length,
  );
  const sourcesChanged = useMemo(
    () => !sameValues(draftSources, selectedSources),
    [draftSources, selectedSources],
  );

  const tagsChanged = useMemo(
    () => !sameValues(draftTags, selectedTags),
    [draftTags, selectedTags],
  );

  return (
    <TechArticlePublicContent>
      <main id="top">
        <section className="page-hero">
          <div className="container hero-content">
            <div className="hero-icon" aria-hidden="true">
              <i className="fas fa-newspaper"></i>
            </div>
            <h1 className="orbitron gradient-text">Tech Articles</h1>

            <p className="hero-lead">
              <span>TCP가 한데 모은 여러 개발·기술 뉴스를</span>{" "}
              <span>이곳에서 만나보세요.</span>
            </p>
            <p className="last-collected">
              <span title={lastCheckedAbsolute}>
                {lastCheckedRelative
                  ? newCount > 0
                    ? `${lastCheckedRelative}에 업데이트 · 새 글 ${newCount}개`
                    : `${lastCheckedRelative}에 확인`
                  : lastCheckedAbsolute
                    ? `마지막 확인 ${lastCheckedAbsolute}`
                    : "확인 중"}
              </span>
            </p>
          </div>
        </section>

        <section id="tech-articles-list" className="articles-section">
          <div className="container">
            <div
              id="resultsStart"
              className="section-heading article-list-heading"
              tabIndex="-1"
            >
              <h2 className="sr-only">아티클 목록</h2>
              <div className="result-summary">
                <p id="resultCount">
                  {isLoading && !response
                    ? "아티클을 불러오는 중입니다."
                    : pagination?.totalCount
                      ? hasConditions
                        ? `총 ${pagination.totalCount}건 중 ${start}–${end}건`
                        : [
                            `전체 ${pagination.totalCount}건`,
                            <span className="result-sort" key="sort">
                              {" ⋅ 최신순"}
                            </span>,
                          ]
                      : error
                        ? "목록을 표시할 수 없습니다."
                        : "검색 결과 0건"}
                </p>
                {isLoading && response && (
                  <span className="request-progress">
                    <i
                      className="fas fa-circle-notch fa-spin"
                      aria-hidden="true"
                    ></i>
                    목록 갱신 중
                  </span>
                )}
              </div>

              <div className="list-filter-row">
                <button
                  type="button"
                  className={`filter-trigger source-trigger ${selectedSources.length ? "is-active" : ""}`}
                  onClick={() => setSourceOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={sourceOpen}
                >
                  <i className="fas fa-rss" aria-hidden="true"></i>
                  {selectedSources.length
                    ? `소스 ${selectedSources.length}곳`
                    : "소스 선택"}
                </button>

                <button
                  id="openFilterButton"
                  className={`filter-trigger mobile-filter-button ${selectedTags.length ? "is-active" : ""}`}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={filterOpen}
                  disabled={isLoading || Boolean(tagError)}
                  onClick={() => {
                    setDraftTags(selectedTags);
                    setFilterOpen(true);
                  }}
                >
                  <i className="fas fa-sliders-h" aria-hidden="true"></i>
                  {selectedTags.length
                    ? `분야 ${selectedTags.length}개`
                    : "분야 선택"}
                </button>

                {hasConditions && (
                  <button
                    id="mobileResetAllButton"
                    className="mobile-reset-button"
                    type="button"
                    onClick={resetAll}
                  >
                    전체 초기화
                  </button>
                )}
              </div>
            </div>

            <fieldset
              id="categoryFieldset"
              className="filter-panel filter-panel-v2 category-filter-panel"
              disabled={isLoading || Boolean(tagError)}
            >
              <legend id="category-filter">분야 선택</legend>
              <div className="desktop-filter">
                <V9TagButtons
                  id="desktopTagFilters"
                  tags={tags}
                  selectedTags={draftTags}
                  onToggle={toggleDraftTag}
                  label="분야 선택 항목"
                />
                <div className="filter-apply-row">
                  <button
                    id="resetDraftTagsButton"
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setDraftTags([]);
                      applyConditions({ nextTags: [], scroll: false });
                    }}
                    disabled={!draftTags.length}
                  >
                    초기화
                  </button>
                  <button
                    id="applyDesktopTagsButton"
                    className="apply-filter-button"
                    type="button"
                    disabled={!tagsChanged}
                    onClick={() =>
                      applyConditions({ nextTags: draftTags, scroll: false })
                    }
                  >
                    적용
                  </button>
                </div>
              </div>
            </fieldset>

            {tagError && <p className="detail-data-error">{tagError}</p>}

            <p className="sr-only" aria-live="polite">
              {pagination?.totalCount
                ? `아티클 ${pagination.totalCount}건 중 ${response?.items?.length || 0}건을 표시합니다.`
                : "조건에 맞는 아티클이 없습니다."}
            </p>

            <div
              className={`article-list ${isLoading && response ? "is-loading" : ""}`}
            >
              {isLoading && !response ? (
                Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="article-card skeleton-card"
                    aria-hidden="true"
                    key={index}
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ))
              ) : error ? (
                <div className="empty-state">
                  <i
                    className="fas fa-triangle-exclamation"
                    aria-hidden="true"
                  ></i>
                  <h3>아티클을 불러오지 못했습니다</h3>
                  <p>{error}</p>
                  <button type="button" onClick={loadArticles}>
                    다시 시도
                  </button>
                </div>
              ) : !response?.items?.length ? (
                <div className="empty-state">
                  <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
                  <h3>조건에 맞는 아티클이 없습니다</h3>
                  <p>검색어를 바꾸거나 적용된 분야 태그를 초기화해 보세요.</p>
                  <button type="button" onClick={resetAll}>
                    전체 조건 초기화
                  </button>
                </div>
              ) : (
                response.items.map((article) => (
                  <article
                    className="article-card"
                    data-article-id={article.id}
                    key={article.id}
                    onClick={(event) => openArticleFromCard(event, article.id)}
                  >
                    <div className="article-card-heading">
                      <Link
                        className="article-title"
                        to={`/tech-articles/${encodeURIComponent(article.id)}`}
                        onClick={(event) =>
                          rememberReturnFromTitle(event, article.id)
                        }
                      >
                        {article.isNew && (
                          <span className="article-new-badge">NEW</span>
                        )}
                        {article.title || "제목 없음"}
                      </Link>
                    </div>
                    <div className="article-summary-row">
                      <p
                        className="article-summary"
                        title={article.oneLineSummary}
                      >
                        {article.oneLineSummary || "한 줄 요약이 없습니다."}
                      </p>
                      <ArticleMeta
                        article={article}
                        className="article-meta-mobile"
                      />
                    </div>
                    <div className="article-card-bottom">
                      <div className="article-card-info">
                        <V9ArticleTags tags={article.tags} />
                        <ArticleMeta
                          article={article}
                          className="article-meta-desktop"
                        />
                      </div>
                      <button
                        className="share-button"
                        type="button"
                        onClick={() => handleShare(article)}
                        aria-label={`${article.title} 세부 페이지 공유`}
                        title="공유"
                      >
                        <i
                          className="fas fa-share-nodes"
                          aria-hidden="true"
                        ></i>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            {pagination?.totalCount > 0 && (
              <nav
                className="pagination pagination-v3"
                aria-label="아티클 목록 페이지 이동"
              >
                <button
                  className="page-button"
                  type="button"
                  disabled={pagination.currentPage === 1}
                  onClick={() =>
                    applyConditions({
                      nextPage: pagination.currentPage - 1,
                    })
                  }
                  aria-label="이전 페이지"
                >
                  이전
                </button>
                <div className="page-number-list">
                  {getPageTokens(
                    pagination.currentPage,
                    pagination.totalPages,
                  ).map((token, index) =>
                    token === "ellipsis" ? (
                      <span
                        className="page-ellipsis"
                        aria-hidden="true"
                        key={`ellipsis-${index}`}
                      >
                        …
                      </span>
                    ) : (
                      <button
                        className="page-button page-number"
                        type="button"
                        key={token}
                        aria-current={
                          token === pagination.currentPage ? "page" : undefined
                        }
                        aria-label={`${token}페이지로 이동`}
                        onClick={() => applyConditions({ nextPage: token })}
                      >
                        {token}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="page-button"
                  type="button"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() =>
                    applyConditions({
                      nextPage: pagination.currentPage + 1,
                    })
                  }
                  aria-label="다음 페이지"
                >
                  다음
                </button>
                <span className="pagination-status">
                  전체 {pagination.totalPages}페이지
                </span>
              </nav>
            )}

            <section
              id="article-filters"
              className="explore-section"
              aria-labelledby="exploreHeading"
            >
              <div className="explore-heading">
                <h2 id="exploreHeading" className="sr-only">
                  아티클 검색하기
                </h2>
                <a className="back-to-list-link" href="#resultsStart">
                  목록으로 돌아가기{" "}
                  <i className="fas fa-arrow-up" aria-hidden="true"></i>
                </a>
              </div>

              <fieldset
                id="searchFieldset"
                className="filter-panel filter-panel-v2"
                disabled={isLoading}
              >
                <legend className="sr-only">아티클 검색</legend>
                <form
                  id="searchForm"
                  role="search"
                  aria-label="분야와 검색어로 아티클 검색"
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyConditions({
                      nextKeyword: searchInput,
                      nextTags: draftTags,
                    });
                  }}
                >
                  <div className="search-category-filter">
                    <div className="desktop-filter">
                      <V9TagButtons
                        id="searchTagFilters"
                        className="tag-filter-list search-desktop-filter"
                        tags={tags}
                        selectedTags={draftTags}
                        onToggle={toggleDraftTag}
                        label="검색할 분야 선택 항목"
                      />
                      <div className="filter-apply-row">
                        <button
                          id="resetSearchDraftTagsButton"
                          className="text-button"
                          type="button"
                          onClick={() => {
                            setDraftTags([]);
                            applyConditions({
                              nextTags: [],
                              scrollTarget: "article-filters",
                              scrollBlock: "center",
                            });
                          }}
                          disabled={!draftTags.length}
                        >
                          초기화
                        </button>
                        <button
                          id="applySearchTagsButton"
                          className="apply-filter-button"
                          type="button"
                          disabled={!tagsChanged}
                          onClick={() =>
                            applyConditions({
                              nextTags: draftTags,
                              scrollTarget: "article-filters",
                              scrollBlock: "center",
                            })
                          }
                        >
                          적용
                        </button>
                      </div>
                    </div>
                    <button
                      id="openSearchFilterButton"
                      className={`filter-trigger mobile-filter-button search-mobile-filter-button ${
                        selectedTags.length ? "is-active" : ""
                      }`}
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={filterOpen}
                      onClick={() => {
                        setDraftTags(selectedTags);
                        setFilterOpen(true);
                      }}
                    >
                      <i className="fas fa-sliders-h" aria-hidden="true"></i>
                      {selectedTags.length
                        ? `분야 ${selectedTags.length}개`
                        : "분야 선택"}
                    </button>
                  </div>
                  <div className="search-row">
                    <div className="search-input-wrap">
                      <input
                        id="searchInput"
                        name="q"
                        type="search"
                        autoComplete="off"
                        maxLength={100}
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="검색어"
                        aria-label="검색어"
                      />
                      <button
                        id="clearSearchButton"
                        className="search-clear"
                        type="button"
                        hidden={!searchInput}
                        onClick={() => {
                          setSearchInput("");
                          if (keyword) {
                            applyConditions({
                              nextKeyword: "",
                              nextTags: selectedTags,
                            });
                          }
                        }}
                        aria-label="검색어 지우기"
                      >
                        <i className="fas fa-times" aria-hidden="true"></i>
                      </button>
                      <i
                        className="fas fa-search search-icon"
                        aria-hidden="true"
                      ></i>
                    </div>
                    <button className="cta-button search-submit" type="submit">
                      검색
                    </button>
                  </div>
                </form>
              </fieldset>
            </section>

            <aside className="source-notice">
              <div>
                <h2>데이터 출처 및 AI 생성 정보 안내</h2>
                <p>
                  TCP는 기술 블로그, 개발자 뉴스·커뮤니티 및 공개 저장소 등 외부
                  출처의 콘텐츠를 수집, 제공합니다. 원문 주소와 출처 정보는 각
                  아티클에서 확인할 수 있습니다. 원문 콘텐츠의 모든 권리는 원문
                  발행처 또는 작성자에게 있습니다.
                </p>
                <p>
                  번역 제목, 한 줄 요약, 상세 요약과 분야 태그는 원문을 바탕으로
                  AI가 생성합니다. AI는 실수를 할 수 있으므로, 중요한 내용은
                  반드시 원문을 확인해 주세요.
                </p>
                <p>
                  가치 점수는 TCP 내부 기준을 통해 산정한 참고 지표입니다. 이
                  점수는 글의 정확성을 의미하지 않으며, 개별 아티클에 대한
                  절대적인 품질 또한 보증하지 않습니다.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SourcePickerDialog
        dialogRef={sourceDialogRef}
        sources={sources}
        draft={draftSources}
        onToggle={(id) =>
          setDraftSources((current) =>
            current.includes(id)
              ? current.filter((value) => value !== id)
              : [...current, id],
          )
        }
        applyDisabled={!sourcesChanged}
        onApply={() => {
          setSourceOpen(false);
          applyConditions({ nextSources: draftSources, scroll: false });
        }}
        onReset={() => {
          setDraftSources([]);
          setSourceOpen(false);
          applyConditions({ nextSources: [], scroll: false });
        }}
        onClose={() => {
          setSourceOpen(false);
          setDraftSources(selectedSources);
        }}
      />

      <dialog
        id="filterDialog"
        ref={filterDialogRef}
        className="filter-dialog"
        onClose={() => {
          setFilterOpen(false);
          setDraftTags(selectedTags);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setFilterOpen(false);
        }}
      >
        <div className="filter-sheet">
          <div className="filter-sheet-heading">
            <h2>분야 선택</h2>
            <button
              className="sheet-close"
              type="button"
              onClick={() => setFilterOpen(false)}
              aria-label="닫기"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <V9TagButtons
            id="mobileTagFilters"
            tags={tags}
            selectedTags={draftTags}
            onToggle={toggleDraftTag}
            label="분야 선택 항목"
          />

          <div className="sheet-actions">
            <button
              id="clearDraftTagsButton"
              className="source-reset"
              type="button"
              onClick={() => {
                setDraftTags([]);
                setFilterOpen(false);
                applyConditions({ nextTags: [], scroll: false });
              }}
            >
              초기화
            </button>
            <button
              id="applyTagsButton"
              className="source-apply"
              type="button"
              disabled={!tagsChanged}
              onClick={() => {
                setFilterOpen(false);
                applyConditions({ nextTags: draftTags, scroll: false });
              }}
            >
              적용
            </button>
          </div>
        </div>
      </dialog>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <i className="fas fa-circle-info" aria-hidden="true"></i>
          <p>{toast}</p>
        </div>
      )}
    </TechArticlePublicContent>
  );
}

export default TechArticles;
