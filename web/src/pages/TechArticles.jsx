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

// 소스는 남의 브랜드라 아이콘과 도메인을 함께 보여줍니다. 분야 태그와 모양이
// 같으면 사용자가 같은 축으로 착각하는데, 이 둘은 서로 다른 질문에 답합니다.
// (분야: 무엇에 관한 글인가 / 소스: 누가 쓴 글인가)
//
// 아이콘은 우리 서버에서만 가져옵니다. 외부 파비콘 서비스를 쓰면 방문자
// 브라우저가 그 서비스에 직접 요청하게 되어, IP 와 "지금 보는 소스"가 제3자로
// 전송됩니다. 개인정보처리방침이 "외부 전송을 하지 않는다"고 밝히고 있으므로
// 그 약속과 어긋납니다.
//
// public/images/sources/{id}.png 를 두면 그 이미지를 쓰고, 없으면 이름 첫 글자로
// 만든 표식으로 떨어집니다. 새 소스를 추가할 때 이미지를 안 넣어도 화면은
// 깨지지 않습니다.
const MONOGRAM_TONES = 6;

// 글자 코드 합으로 색을 고릅니다. 이름 길이로 고르면 글자 수가 같은 소스끼리
// 색이 겹칩니다 ("Cloudflare Blog" 와 "GitHub Trending" 이 둘 다 15자).
function monogramTone(label) {
  let sum = 0;
  for (let i = 0; i < label.length; i += 1) sum += label.charCodeAt(i);
  return sum % MONOGRAM_TONES;
}

function SourceIcon({ id, name, domain }) {
  const [failed, setFailed] = useState(false);
  const label = (name || domain || "?").trim();
  if (!id || failed) {
    // 같은 소스는 언제나 같은 색이 됩니다.
    const tone = monogramTone(label);
    return (
      <span
        className={`source-icon source-icon-monogram tone-${tone}`}
        aria-hidden="true"
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="source-icon"
      src={`/images/sources/${id}.png`}
      alt=""
      loading="lazy"
      width="20"
      height="20"
      onError={() => setFailed(true)}
    />
  );
}

// 소스가 늘어나도 견디도록 검색을 답니다. 목록을 눈으로 훑어 찾는 방식은
// 스무 개를 넘어가면 무너집니다.
function SourcePickerDialog({
  dialogRef,
  sources,
  draft,
  onToggle,
  onApply,
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
    <dialog className="source-dialog" ref={dialogRef} onClose={onClose}>
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
                  <SourceIcon
                    id={source.id}
                    name={source.name}
                    domain={source.domain}
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
            전체 해제
          </button>
          <button type="button" className="source-apply" onClick={onApply}>
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

function moveToResults() {
  document
    .getElementById("resultsStart")
    ?.scrollIntoView({ behavior: "auto", block: "start" });
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
  const pendingListScroll = useRef(false);
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
        // 소스 목록을 못 받아도 아티클 목록은 그대로 보여야 합니다.
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
    moveToResults();
  }, [listScrollRevision]);

  useLayoutEffect(() => {
    const returnState = readArticleListReturn();
    if (!returnState) return;

    const listPath = `${location.pathname}${location.search || ""}`;
    const shouldRestore =
      navigationType === "POP" &&
      returnState.listPath === listPath &&
      returnState.listLocationKey === (location.key || "default");

    // 화면 안의 "목록으로 돌아가기"나 헤더 링크는 새 목록 이동(PUSH)입니다.
    // 이때는 기존 상단 이동 정책을 유지하고 남아 있던 복원 정보만 버립니다.
    if (!shouldRestore) {
      releaseArticleListReturn(returnState);
      return;
    }

    // 네 개의 스켈레톤 높이를 기준으로 복원하면 실제 카드가 들어올 때 위치가
    // 다시 밀립니다. 목록 요청이 끝난 뒤 실제 아티클 ID를 앵커로 사용합니다.
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
      // 글이 삭제되거나 필터 결과에서 사라졌다면 예측 가능한 목록 시작점으로 갑니다.
      moveToResults();
    }

    releaseArticleListReturn(returnState);
  }, [
    isLoading,
    location.key,
    location.pathname,
    location.search,
    navigationType,
  ]);

  const completePendingListScroll = useCallback(() => {
    if (!pendingListScroll.current) return;
    pendingListScroll.current = false;
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
    // selectedTags / selectedSources 는 매 렌더 새 배열이라 그대로 넣으면
    // 무한 조회가 됩니다. 문자열로 접은 ...Key 를 대신 씁니다.
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

  // "14:32 KST" 는 지금 시각과 빼기를 시켜야 읽힙니다. 상대 시각은 그냥 읽힙니다.
  const lastCheckedRelative = useMemo(
    () => formatRelativeFromNow(response?.lastCrawledAt),
    [response],
  );
  const lastCheckedAbsolute = response?.lastCrawledAt
    ? `${formatTechArticleDate(response.lastCrawledAt, true)} KST`
    : undefined;
  // 배지가 붙은 개수와 같은 값이라, 두 표시가 서로를 설명해 줍니다.
  const newCount = useMemo(
    () => (response?.items || []).filter((item) => item.isNew).length,
    [response],
  );
  const sourceById = useMemo(
    () => Object.fromEntries(sources.map((source) => [source.id, source])),
    [sources],
  );

  const applyConditions = ({
    nextKeyword = keyword,
    nextTags = selectedTags,
    nextSources = selectedSources,
    nextPage = 1,
    scroll = true,
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
      if (conditionsChanged) pendingListScroll.current = true;
      else moveToResults();
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
            {/* 한글에는 Orbitron 을 쓰지 않습니다. 라틴 제목에만 남깁니다. */}
            <p className="hero-lead">
              여러 개발·기술 뉴스를 한 곳에서 만나보세요
            </p>
            <p className="hero-description">
              TCP가 한데 모은 여러 소식을 이곳에서 확인할 수 있어요.
            </p>
            <p className="last-collected">
              <i className="fas fa-clock" aria-hidden="true"></i>
              {/* 새 글이 없을 때 "업데이트"라고 하면 사실이 아니게 됩니다. */}
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

            {/* 소스는 분야 태그와 다른 축이라 필터 패널 밖, 목록 바로 위에
                따로 둡니다. 한 줄에 섞으면 같은 종류로 읽힙니다. */}
            <div className="source-bar">
              <button
                type="button"
                className={`source-trigger ${selectedSources.length ? "is-active" : ""}`}
                onClick={() => setSourceOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sourceOpen}
              >
                <i className="fas fa-rss" aria-hidden="true"></i>
                {selectedSources.length
                  ? `소스 ${selectedSources.length}곳`
                  : "소스 선택"}
                <i className="fas fa-chevron-down" aria-hidden="true"></i>
              </button>

              {selectedSources.length > 0 && (
                <ul className="source-chip-list" aria-label="선택한 소스">
                  {selectedSources.map((id) => {
                    const source = sourceById[id];
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="source-chip"
                          onClick={() =>
                            applyConditions({
                              nextSources: selectedSources.filter(
                                (value) => value !== id,
                              ),
                            })
                          }
                          aria-label={`${source?.name || id} 해제`}
                        >
                          <SourceIcon
                            id={source?.id}
                            name={source?.name || id}
                            domain={source?.domain}
                          />
                          {source?.name || id}
                          <i className="fas fa-xmark" aria-hidden="true"></i>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <button
                      type="button"
                      className="text-button source-clear"
                      onClick={() => applyConditions({ nextSources: [] })}
                    >
                      모두 해제
                    </button>
                  </li>
                </ul>
              )}
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
                        onClick={(event) =>
                          rememberReturnFromTitle(event, article.id)
                        }
                      >
                        {/* 목록이 원문 게시일 순이라 새로 들어온 글이 위로
                            오지 않습니다. 배지가 없으면 찾을 방법이 없습니다.
                            제목 링크 안에 두어야 글자 흐름을 타고 첫 줄과
                            정렬이 맞습니다. 바깥에 두면 카드 헤딩이 flex 라
                            제목 첫 줄과 어긋납니다. */}
                        {article.isNew && (
                          <span className="article-new-badge">NEW</span>
                        )}
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
        onApply={() => {
          setSourceOpen(false);
          applyConditions({ nextSources: draftSources });
        }}
        onReset={() => setDraftSources([])}
        onClose={() => {
          setSourceOpen(false);
          // 적용하지 않고 닫으면 선택을 되돌립니다.
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
