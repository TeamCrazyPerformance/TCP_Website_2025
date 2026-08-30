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

// 소스는 이름과 도메인으로만 구분합니다. 아이콘은 여섯 색 표식으로 떨어지는
// 경우가 많았는데, 그 색은 소스를 뜻하지 않으면서 옆의 분야 태그와 같은
// 색 언어를 써서 두 축이 섞여 보였습니다. 이름이 이미 하는 일입니다.

// 소스가 늘어나도 견디도록 검색을 답니다. 목록을 눈으로 훑어 찾는 방식은
// 스무 개를 넘어가면 무너집니다.
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
      // 바깥쪽을 누르면 닫습니다. 분야 선택 시트가 이미 같은 방식이라,
      // 여기만 닫히지 않으면 같은 자리의 두 창이 서로 다르게 굽니다.
      // 대화상자 자신이 대상일 때만 반응하므로 안쪽 클릭은 지나갑니다.
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

// 목록을 새로 받은 뒤 어디로 시선을 옮길지는 누른 버튼마다 다릅니다.
// 목록 위쪽 조작은 목록 머리글로, 페이지 아래 검색 패널의 조작은 그
// 패널로 돌아와야 사용자가 보던 자리를 잃지 않습니다.
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
    moveTo(listScrollTarget.current.id, listScrollTarget.current.block);
  }, [listScrollRevision]);

  useLayoutEffect(() => {
    const returnState = readArticleListReturn();
    if (!returnState) return;

    const listPath = `${location.pathname}${location.search || ""}`;

    // 두 가지 경로로 복원합니다.
    //   1) 브라우저 뒤로가기 — 같은 기록 항목으로 돌아오므로 기록 키까지 맞습니다.
    //   2) 상세의 "아티클 목록으로 돌아가기" — 새 기록 항목(PUSH)이라 키는 다르지만,
    //      그 링크가 저장해 둔 목록 주소를 그대로 요청하며 이 표시를 함께 보냅니다.
    // 헤더의 메뉴처럼 표시가 없는 목록 이동은 지금처럼 목록 시작점으로 갑니다.
    const requestedRestore = Boolean(location.state?.restoreListPosition);
    const shouldRestore =
      returnState.listPath === listPath &&
      (requestedRestore ||
        (navigationType === "POP" &&
          returnState.listLocationKey === (location.key || "default")));

    // 복원 대상이 아니면 기존 상단 이동 정책을 유지하고 남은 정보만 버립니다.
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
  const applyConditions = ({
    nextKeyword = keyword,
    nextTags = selectedTags,
    nextSources = selectedSources,
    nextPage = 1,
    scroll = true,
    scrollTarget = "resultsStart",
    // 목록 머리글은 위쪽 끝을 맞추는 편이 자연스럽지만, 페이지 중간의
    // 검색 패널은 화면 가운데로 와야 방금 누른 버튼이 눈에 남습니다.
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
  const hasConditions = Boolean(
    keyword || selectedTags.length || selectedSources.length,
  );
  // 분야 선택과 같게, 고른 소스가 실제로 달라졌을 때만 적용을 켭니다.
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
            {/* 한글에는 Orbitron 을 쓰지 않습니다. 라틴 제목에만 남깁니다. */}
            {/* 좁은 화면에서 "…뉴스를 이곳에서 / 만나보세요."로 끊기지
                않도록 의미 단위로 나눠 둡니다. */}
            <p className="hero-lead">
              <span>TCP가 한데 모은 여러 개발·기술 뉴스를</span>{" "}
              <span>이곳에서 만나보세요.</span>
            </p>
            <p className="last-collected">
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
              {/* 화면에는 두지 않습니다. 바로 아래가 목록이라 제목이
                  한 줄을 더 쓰는 값을 하지 못합니다. 다만 섹션 제목을 통째로
                  빼면 보조 기술의 문서 구조가 끊기므로 남겨 둡니다. */}
              <h2 className="sr-only">아티클 목록</h2>
              <div className="result-summary">
                <p id="resultCount">
                  {isLoading && !response
                    ? "아티클을 불러오는 중입니다."
                    : pagination?.totalCount
                      ? hasConditions
                        ? `총 ${pagination.totalCount}건 중 ${start}–${end}건`
                        : // 정렬 기준은 좁은 화면에서 버튼과 한 줄을 나눠
                          // 쓸 자리가 없어 따로 감싸 두고 CSS 로 덜어냅니다.
                          [
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

              {/* 좁은 화면에서는 두 트리거가 제목 줄 아래 한 줄을 함께
                  씁니다. 래퍼가 없으면 건수 길이에 따라 소스 선택만 제목
                  줄에 붙는 날이 생겨 줄 구성이 들쭉날쭉해집니다. */}
              <div className="list-filter-row">
                {/* 소스는 분야 태그와 다른 축이라 필터 패널이 아니라 목록
                    머리글에 둡니다. 건수와 같은 줄 오른쪽 끝에 붙여, 버튼만
                    있는 줄이 건수와 목록 사이에 빈 띠를 만들지 않게 합니다. */}
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

                {/* 분야 선택은 데스크톱에서 패널 안 태그 목록으로 펼쳐지지만,
                    모바일에서는 소스 선택과 나란히 놓이는 같은 성격의 트리거라
                    머리글로 함께 올립니다. fieldset 밖으로 나오면서 disabled 가
                    더는 상속되지 않으므로 같은 조건을 직접 넘깁니다. */}
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

                {/* 모바일에서는 선택 조건을 아래에 다시 나열하지 않습니다.
                    조건이 하나라도 있으면 같은 행 오른쪽 끝에 덜 강조된
                    텍스트 동작으로 초기화를 제공합니다. 버튼 요소는 키보드와
                    스크린 리더 동작을 위해 유지하고 외형만 텍스트로 만듭니다. */}
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
                {/* 화면에는 두지 않습니다. 아래에 분야 버튼과 검색창만
                    남기면 무엇을 하는 자리인지 그 자체로 읽힙니다. 섹션
                    이름은 aria-labelledby 가 참조하므로 남겨 둡니다. */}
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
                    {/* 위쪽 분야 패널과 같은 배치(태그 왼쪽 · 버튼 오른쪽
                        한 줄)를 쓰려면 태그 목록과 버튼 줄이 같은 그리드의
                        형제여야 합니다. */}
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
                        // 눈에 보이는 라벨을 뺐으므로 이름은 여기서 답니다.
                        // placeholder 는 값을 입력하면 사라져 이름이 될 수
                        // 없습니다.
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
              <i className="fas fa-circle-info" aria-hidden="true"></i>
              <div>
                {/* 안내 문구 제목이라 브랜드 서체(Orbitron)를 쓰지 않습니다.
                    한글 사이에 섞인 "AI"만 다른 글꼴로 튀어 보입니다. */}
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
        // 초기화는 "고른 것을 지운다"가 아니라 "조건 없는 목록으로 돌아간다"
        // 입니다. 따로 적용을 누르게 하면 한 번 더 확인받는 셈이 됩니다.
        onReset={() => {
          setDraftSources([]);
          setSourceOpen(false);
          applyConditions({ nextSources: [], scroll: false });
        }}
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
          {/* 소스 선택 대화상자와 같은 "초기화 / 적용" 두 동작만 둡니다.
              취소 버튼은 지웁니다 — 오른쪽 위 닫기와 바깥쪽 누르기가 이미
              같은 일을 하고, 소스 쪽에는 없어 두 창의 결이 어긋났습니다. */}
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
