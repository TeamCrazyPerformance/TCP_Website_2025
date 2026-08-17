import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getTechArticles,
  getTechArticleTags,
  techArticleErrorMessage,
} from "../api/techArticles";
import {
  formatTechArticleDate,
  shouldOpenFromCardClick,
} from "../components/tech-articles/TechArticleCommon";
import { getPageTokens } from "../components/tech-articles/TechArticlePagination";
import TechArticlePublicContent from "../components/tech-articles/TechArticlePublicContent";

const PAGE_SIZE = 20;
const TAG_CLASS_NAMES = {
  AI: "tag-ai-ml",
  "애플리케이션 개발": "tag-frontend",
  모바일: "tag-mobile",
  "프로그래밍 언어": "tag-language-framework",
  데이터: "tag-data-db",
  클라우드: "tag-cloud-devops",
  DevOps: "tag-cloud-devops",
  보안: "tag-security",
  네트워크: "tag-backend",
  "소프트웨어 아키텍처": "tag-architecture",
  "개발자 도구": "tag-language-framework",
  "소프트웨어 품질": "tag-industry-career",
  오픈소스: "tag-open-source",
  "개발 조직": "tag-industry-career",
  "산업 동향": "tag-blockchain-web3",
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

function sameValues(left, right) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
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
            <i className="fas fa-check" aria-hidden="true"></i>
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

function TechArticles() {
  const navigate = useNavigate();
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

  const [tags, setTags] = useState([]);
  const [draftTags, setDraftTags] = useState(selectedTags);
  const [searchInput, setSearchInput] = useState(keyword);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [tagError, setTagError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [toast, setToast] = useState("");
  const requestId = useRef(0);
  const filterDialogRef = useRef(null);

  useEffect(() => {
    setDraftTags(readTags(searchParams));
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
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (filterOpen && !dialog.open) dialog.showModal();
    if (!filterOpen && dialog.open) dialog.close();
  }, [filterOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      });
      if (requestId.current !== currentRequest) return;
      setResponse(data);
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
      }
    } finally {
      if (requestId.current === currentRequest) setIsLoading(false);
    }
  }, [keyword, page, searchParams, selectedTagKey, setSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const applyConditions = ({
    nextKeyword = keyword,
    nextTags = selectedTags,
    nextPage = 1,
    scroll = true,
  } = {}) => {
    const next = new URLSearchParams();
    if (nextKeyword.trim()) next.set("q", nextKeyword.trim());
    if (nextTags.length) next.set("tags", nextTags.join(","));
    if (nextPage > 1) next.set("page", String(nextPage));
    setSearchParams(next);
    if (scroll) {
      window.setTimeout(() => {
        document
          .getElementById("resultsStart")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
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
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const removeFilter = (filter) => {
    if (filter === "query") {
      setSearchInput("");
      applyConditions({ nextKeyword: "", nextTags: selectedTags });
      return;
    }
    const nextTags = selectedTags.filter((tag) => tag !== filter);
    setDraftTags(nextTags);
    applyConditions({ nextTags });
  };

  // 카드 전체를 상세 이동 영역으로 사용. 예외 규칙은 shouldOpenFromCardClick 참고
  const openArticleFromCard = (event, articleId) => {
    if (!shouldOpenFromCardClick(event)) return;
    navigate(`/tech-articles/${encodeURIComponent(articleId)}`);
  };

  const handleShare = async (article) => {
    const url = `${window.location.origin}/tech-articles/${encodeURIComponent(article.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.title,
          text: article.oneLineSummary,
          url,
        });
        setToast("세부 페이지를 공유했습니다.");
      } else {
        await navigator.clipboard.writeText(url);
        setToast("세부 페이지 주소를 복사했습니다.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setToast("세부 페이지 주소를 복사하지 못했습니다.");
      }
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
  const hasConditions = Boolean(keyword || selectedTags.length);
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
            <p className="hero-lead orbitron">
              개발과 기술 분야의 읽을 만한 정보를 한곳에서 만나보세요
            </p>
            <p className="hero-description">
              AI가 정리한 한 줄 요약과 분야, 원출처를 확인해 보세요.
            </p>
            <p className="last-collected">
              <i className="fas fa-clock" aria-hidden="true"></i>
              마지막 원문 수집:{" "}
              <span>
                {response?.lastCrawledAt
                  ? `${formatTechArticleDate(response.lastCrawledAt, true)} KST`
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
              <h2 className="orbitron gradient-text">아티클 목록</h2>
              <div className="result-summary">
                <p id="resultCount">
                  {isLoading && !response
                    ? "아티클을 불러오는 중입니다."
                    : pagination?.totalCount
                      ? hasConditions
                        ? `총 ${pagination.totalCount}건 중 ${start}–${end}건`
                        : `전체 ${pagination.totalCount}건 ⋅ 원문 게시일 최신순`
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
                    onClick={() => setDraftTags([])}
                    disabled={!draftTags.length}
                  >
                    초기화
                  </button>
                  <button
                    id="applyDesktopTagsButton"
                    className="apply-filter-button"
                    type="button"
                    disabled={!tagsChanged}
                    onClick={() => applyConditions({ nextTags: draftTags })}
                  >
                    적용
                  </button>
                </div>
              </div>
              <button
                id="openFilterButton"
                className="mobile-filter-button"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={filterOpen}
                onClick={() => {
                  setDraftTags(selectedTags);
                  setFilterOpen(true);
                }}
              >
                <span>
                  <i className="fas fa-sliders-h" aria-hidden="true"></i>
                  분야 선택
                </span>
                <strong id="mobileFilterCount">{selectedTags.length}</strong>
              </button>
            </fieldset>

            {tagError && <p className="detail-data-error">{tagError}</p>}

            {hasConditions && (
              <div className="active-filters">
                <span>적용 중</span>
                <div className="filter-chips">
                  {keyword && (
                    <span className="filter-chip">
                      검색어: {keyword}
                      <button
                        type="button"
                        onClick={() => removeFilter("query")}
                        aria-label={`검색어 ${keyword} 조건 해제`}
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {selectedTags.map((tag) => (
                    <span className="filter-chip" key={tag}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeFilter(tag)}
                        aria-label={`${tag} 조건 해제`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={resetAll}
                >
                  <i className="fas fa-rotate-left" aria-hidden="true"></i>
                  전체 초기화
                </button>
              </div>
            )}

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
                      >
                        {article.title || "제목 없음"}
                      </Link>
                    </div>
                    <p
                      className="article-summary"
                      title={article.oneLineSummary}
                    >
                      {article.oneLineSummary || "한 줄 요약이 없습니다."}
                    </p>
                    <div className="article-card-bottom">
                      <div className="article-card-info">
                        <V9ArticleTags tags={article.tags} />
                        <div className="article-meta">
                          <span>
                            <i
                              className="fas fa-building text-blue"
                              aria-hidden="true"
                            ></i>
                            원출처{" "}
                            <strong>
                              {article.source?.name ||
                                article.source?.domain ||
                                "확인되지 않음"}
                            </strong>
                          </span>
                          <span className="meta-divider" aria-hidden="true">
                            ·
                          </span>
                          <span>
                            <i
                              className="fas fa-calendar-day"
                              aria-hidden="true"
                            ></i>
                            <time dateTime={article.originalPublishedAt}>
                              {formatTechArticleDate(
                                article.originalPublishedAt,
                              )}
                            </time>
                          </span>
                        </div>
                      </div>
                      <button
                        className="share-button"
                        type="button"
                        onClick={() => handleShare(article)}
                        aria-label={`${article.title} 세부 페이지 공유`}
                      >
                        공유{" "}
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
                  현재 {pagination.currentPage} / {pagination.totalPages}페이지
                </span>
              </nav>
            )}

            <section
              id="article-filters"
              className="explore-section"
              aria-labelledby="exploreHeading"
            >
              <div className="explore-heading">
                <div>
                  <p className="orbitron explore-eyebrow">SEARCH</p>
                  <h2 id="exploreHeading">필요한 아티클 검색하기</h2>
                  <p>
                    전체 아티클의 제목과 한 줄 요약에서 원하는 내용을 검색할 수
                    있습니다.
                  </p>
                </div>
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
                    <div className="search-category-heading">
                      <span>분야 선택</span>
                      <button
                        id="resetSearchDraftTagsButton"
                        className="text-button search-tag-reset"
                        type="button"
                        onClick={() => setDraftTags([])}
                        disabled={!draftTags.length}
                      >
                        초기화
                      </button>
                    </div>
                    <V9TagButtons
                      id="searchTagFilters"
                      className="tag-filter-list search-desktop-filter"
                      tags={tags}
                      selectedTags={draftTags}
                      onToggle={toggleDraftTag}
                      label="검색할 분야 선택 항목"
                    />
                    <button
                      id="openSearchFilterButton"
                      className="mobile-filter-button search-mobile-filter-button"
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={filterOpen}
                      onClick={() => {
                        setDraftTags(selectedTags);
                        setFilterOpen(true);
                      }}
                    >
                      <span>
                        <i className="fas fa-sliders-h" aria-hidden="true"></i>
                        분야 선택
                      </span>
                      <strong id="searchMobileFilterCount">
                        {selectedTags.length}
                      </strong>
                    </button>
                  </div>
                  <label htmlFor="searchInput">검색</label>
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
                        placeholder="제목과 요약에서 아티클을 검색하세요."
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
              <i className="fas fa-circle-info" aria-hidden="true"></i>
              <div>
                <h2 className="orbitron">데이터 출처 및 AI 요약 안내</h2>
                <p>
                  공식 기술 블로그와 개발자 커뮤니티 등에서 수집한 자료 중 원문
                  게시일과 출처가 확인되고 AI 요약이 완료된 아티클만 제공합니다.
                </p>
                <p>
                  모든 한 줄 요약은 AI로 생성되며 원문의 전체 맥락을 대체하지
                  않습니다. 표시되는 건수와 페이지는 서버의 최신 응답을 기준으로
                  갱신됩니다.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

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
            <div>
              <p className="orbitron">FILTER</p>
              <h2>분야 선택</h2>
            </div>
            <button
              className="sheet-close"
              type="button"
              onClick={() => setFilterOpen(false)}
              aria-label="필터 닫기"
            >
              <i className="fas fa-times" aria-hidden="true"></i>
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
              type="button"
              onClick={() => setDraftTags([])}
            >
              초기화
            </button>
            <button type="button" onClick={() => setFilterOpen(false)}>
              취소
            </button>
            <button
              id="applyTagsButton"
              className="cta-button"
              type="button"
              disabled={!tagsChanged}
              onClick={() => {
                setFilterOpen(false);
                applyConditions({ nextTags: draftTags });
              }}
            >
              선택 조건으로 보기
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
