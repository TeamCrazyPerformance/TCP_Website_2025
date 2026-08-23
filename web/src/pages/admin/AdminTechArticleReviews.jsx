import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  changeArticlePublication,
  changeArticlePublicationBulk,
  getAdminTechArticleStats,
  getDuplicateReviews,
  getQualityReviews,
  isVersionConflict,
  resolveDuplicateReview,
  resolveDuplicateReviewsBulk,
  resolveQualityReview,
  resolveQualityReviewsBulk,
  techArticleErrorMessage,
} from "../../api/techArticles";
import AdminTechArticleContent from "../../components/tech-articles/AdminTechArticleContent";
import {
  OriginalSourceLink,
  QualityEvaluationPanel,
  QualitySignals,
} from "../../components/tech-articles/ArticleQualityPanel";
import {
  scoreTone,
  scoreToneLabel,
} from "../../components/tech-articles/techArticleStatus";
import { SafeMarkdown } from "../../components/tech-articles/TechArticleCommon";
import { getPageTokens } from "../../components/tech-articles/TechArticlePagination";
import { useV9ConfirmDialog } from "../../components/tech-articles/V9ConfirmDialog";

const PAGE_SIZE = 20;
const VIEW_COPY = {
  duplicates: {
    eyebrow: "POSSIBLE DUPLICATE",
    title: "중복 의심 검토 큐",
    description:
      "Jaccard 계수 0.92 이상으로 POSSIBLE_DUPLICATE 판정을 받은 수집 후보를 기존 아티클과 비교해 처리합니다.",
    listTitle: "판정 대기 후보",
  },
  quality: {
    eyebrow: "ARTICLE REVIEW",
    title: "아티클 검토 큐",
    description:
      "품질 경계 사례와 검토 후 공개 정책에 따라 승인을 기다리는 아티클을 구분해 검토합니다.",
    listTitle: "검토 대기 아티클",
  },
  publication: {
    eyebrow: "ARTICLE REVIEW",
    title: "아티클 검토 큐",
    description:
      "품질 경계 사례와 검토 후 공개 정책에 따라 승인을 기다리는 아티클을 구분해 검토합니다.",
    listTitle: "검토 대기 아티클",
  },
};

function recordId(kind, item) {
  if (kind === "duplicates") {
    return item.reviewCaseId || item.caseId || item.duplicateCaseId;
  }
  return kind === "quality" ? item.caseId || item.reviewTaskId : item.articleId;
}

function candidateTitle(item) {
  return item.candidate?.title || item.title || "제목 없음";
}

function sourceName(source) {
  if (typeof source === "string") return source;
  return source?.name || source?.domain || "확인되지 않음";
}

function languageLabel(value) {
  if (typeof value === "string") return value;
  return value?.label || "확인되지 않음";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function similarityValue(item) {
  const value = item.jaccardCoefficient ?? item.similarity;
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function ArticleTags({ tags = [] }) {
  return (
    <div className="admin-article-tags">
      {tags.map((tag) => (
        <span className="article-tag" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ children, tone = "pending" }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

function DetailFact({ label, value, mono = false }) {
  return (
    <div className="admin-detail-fact">
      <span>{label}</span>
      <strong className={mono ? "mono-value" : undefined}>
        {value || "—"}
      </strong>
    </div>
  );
}

function AdminTechArticleReviews({ kind }) {
  const copy = VIEW_COPY[kind];
  const [response, setResponse] = useState(null);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [selected, setSelected] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const detailDialogRef = useRef(null);
  const { confirm: askConfirmation, confirmDialog } = useV9ConfirmDialog();

  useEffect(() => {
    setPage(1);
    setKeywordInput("");
    setKeyword("");
    setFilter("");
    setSort("NEWEST");
    setSelected({});
    setResponse(null);
    setDetail(null);
  }, [kind]);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = {
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        filter: filter || undefined,
        sort: kind === "duplicates" ? sort : "NEWEST",
      };
      const data =
        kind === "duplicates"
          ? await getDuplicateReviews(query)
          : await getQualityReviews(kind, query);
      setResponse(data);
      if (data?.pagination?.totalPages && page > data.pagination.totalPages) {
        setPage(data.pagination.totalPages);
      }
      return data;
    } catch (error) {
      setNotice({
        type: "error",
        message: techArticleErrorMessage(
          error,
          "검토 큐를 불러오지 못했습니다.",
        ),
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [filter, keyword, kind, page, sort]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);
  useEffect(() => {
    getAdminTechArticleStats()
      .then(setStats)
      .catch(() => undefined);
  }, [kind]);
  useEffect(() => {
    setSelected({});
  }, [page, keyword, filter, sort]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if (detail && !dialog.open) dialog.showModal();
    if (!detail && dialog.open) dialog.close();
  }, [detail]);

  const records = response?.items || [];
  const selectedRecords = useMemo(() => Object.values(selected), [selected]);
  const allPageSelected =
    records.length > 0 &&
    records.every((item) => selected[recordId(kind, item)]);
  const qualityCount = stats?.reviews?.quality ?? stats?.reviews?.QUALITY;
  const publicationCount =
    stats?.reviews?.publication ?? stats?.reviews?.PUBLICATION;
  const currentCount = response?.pagination?.totalCount || 0;

  const toggleRecord = (item) => {
    const id = recordId(kind, item);
    setSelected((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else if (Object.keys(next).length < 50) next[id] = item;
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = { ...current };
      if (allPageSelected)
        records.forEach((item) => delete next[recordId(kind, item)]);
      else
        records
          .slice(0, Math.max(0, 50 - Object.keys(next).length))
          .forEach((item) => {
            next[recordId(kind, item)] = item;
          });
      return next;
    });
  };

  const singlePayload = (item, action) => {
    if (kind === "duplicates") {
      return {
        expectedCaseVersion: item.caseVersion,
        action,
        ...(action === "CONFIRM_DUPLICATE"
          ? {
              matchedArticleId:
                item.matched?.articleId || item.candidates?.[0]?.articleId,
            }
          : {}),
      };
    }
    if (kind === "quality")
      return { expectedCaseVersion: item.caseVersion, action };
    return {
      action: "PUBLISH",
      expectedRecordVersion: item.recordVersion,
      reason: "공개 검토 승인",
    };
  };

  const actionText = (action) =>
    ({
      APPROVE_UNIQUE: "Unique 판정",
      CONFIRM_DUPLICATE: "Duplicate 판정",
      APPROVE: "품질 통과",
      REJECT: "품질 탈락",
      PUBLISH: "승인 및 공개",
    })[action] || action;

  const confirmationFor = (action, item) => {
    const duplicateScore = similarityValue(item);
    return (
      {
        APPROVE_UNIQUE: {
          title: "Unique로 판정할까요?",
          description:
            "후보를 UNIQUE로 판정하고 아티클 생성·품질 평가 흐름으로 전달합니다.",
          confirmLabel: "Unique",
          tone: "success",
        },
        CONFIRM_DUPLICATE: {
          title: "Duplicate로 판정할까요?",
          description: `Jaccard 계수 ${duplicateScore}가 기준 0.92 이상인 후보를 기존 아티클에 연결하고 중복 처리 흐름을 종료합니다.`,
          confirmLabel: "Duplicate",
          tone: "danger",
        },
        APPROVE: {
          title: "품질 통과로 판정할까요?",
          description:
            "AI 요약 단계로 전달되며, 요약 완료 후 현재 공개 정책이 적용됩니다.",
          confirmLabel: "품질 통과",
          tone: "success",
        },
        REJECT: {
          title: "품질 탈락으로 판정할까요?",
          description:
            "이 아티클은 후속 AI 요약과 공개 흐름으로 진행하지 않습니다.",
          confirmLabel: "품질 탈락",
          tone: "danger",
        },
        PUBLISH: {
          title: "공개를 승인할까요?",
          description: "검토가 완료되면 아티클이 공개 페이지에 표시됩니다.",
          confirmLabel: "승인 및 공개",
          tone: "success",
        },
      }[action] || {
        title: `${actionText(action)} 처리할까요?`,
        description: "선택한 작업을 확인해 주세요.",
        confirmLabel: actionText(action),
      }
    );
  };

  const runSingle = async (item, action) => {
    if (!(await askConfirmation(confirmationFor(action, item)))) return;
    setIsMutating(true);
    try {
      if (kind === "duplicates")
        await resolveDuplicateReview(
          recordId(kind, item),
          singlePayload(item, action),
        );
      else if (kind === "quality")
        await resolveQualityReview(
          recordId(kind, item),
          singlePayload(item, action),
        );
      else
        await changeArticlePublication(
          item.articleId,
          singlePayload(item, action),
        );
      setSelected((current) => {
        const next = { ...current };
        delete next[recordId(kind, item)];
        return next;
      });
      setDetail(null);
      setNotice({
        type: "success",
        message: `${actionText(action)} 처리를 완료했습니다.`,
      });
      await loadQueue();
    } catch (error) {
      if (isVersionConflict(error)) await loadQueue();
      setNotice({ type: "error", message: techArticleErrorMessage(error) });
    } finally {
      setIsMutating(false);
    }
  };

  const runBulk = async (action) => {
    if (!selectedRecords.length) return;
    const unsupported =
      kind === "duplicates" && action === "CONFIRM_DUPLICATE"
        ? selectedRecords.filter(
            (item) =>
              !(item.matched?.articleId || item.candidates?.[0]?.articleId),
          )
        : [];
    if (unsupported.length) {
      setNotice({
        type: "error",
        message: "연결할 기존 아티클이 없는 중복 후보가 포함되어 있습니다.",
      });
      return;
    }

    const actionConfirmation = confirmationFor(action, selectedRecords[0]);
    const accepted = await askConfirmation({
      ...actionConfirmation,
      title: `${selectedRecords.length}건을 ${actionConfirmation.confirmLabel} 처리할까요?`,
    });
    if (!accepted) return;

    setIsMutating(true);
    try {
      let result;
      if (kind === "duplicates") {
        result = await resolveDuplicateReviewsBulk(
          selectedRecords.map((item) => ({
            caseId: recordId(kind, item),
            ...singlePayload(item, action),
          })),
        );
      } else if (kind === "quality") {
        result = await resolveQualityReviewsBulk(
          selectedRecords.map((item) => ({
            caseId: recordId(kind, item),
            ...singlePayload(item, action),
          })),
        );
      } else {
        result = await changeArticlePublicationBulk(
          selectedRecords.map((item) => ({
            articleId: item.articleId,
            ...singlePayload(item, action),
          })),
        );
      }
      const succeeded = new Set(
        result.results
          ?.filter((item) => item.status === "SUCCEEDED")
          .map((item) => item.id),
      );
      const failed = result.summary?.failed || 0;
      setNotice({
        type: failed ? "error" : "success",
        message: failed
          ? `${result.summary.succeeded}건 성공, ${failed}건 실패했습니다. 실패 항목은 선택을 유지했습니다.`
          : `${result.summary?.succeeded || selectedRecords.length}건을 처리했습니다.`,
      });
      const freshResponse = await loadQueue();
      const freshById = new Map(
        (freshResponse?.items || []).map((item) => [
          recordId(kind, item),
          item,
        ]),
      );
      setSelected((current) =>
        Object.fromEntries(
          Object.entries(current)
            .filter(([id]) => !succeeded.has(id))
            .map(([id, item]) => [id, freshById.get(id) || item]),
        ),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: techArticleErrorMessage(
          error,
          "일괄 검토 작업을 완료하지 못했습니다.",
        ),
      });
    } finally {
      setIsMutating(false);
    }
  };

  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setFilter("");
    setSort("NEWEST");
    setPage(1);
  };

  const bulkButtons = () => {
    if (kind === "duplicates")
      return (
        <>
          <button
            className="bulk-action-button success"
            type="button"
            onClick={() => runBulk("APPROVE_UNIQUE")}
            disabled={isMutating}
          >
            <i className="fas fa-check" aria-hidden="true"></i>Unique
          </button>
          <button
            className="bulk-action-button danger"
            type="button"
            onClick={() => runBulk("CONFIRM_DUPLICATE")}
            disabled={isMutating}
          >
            <i className="fas fa-link" aria-hidden="true"></i>Duplicate
          </button>
        </>
      );
    if (kind === "quality")
      return (
        <>
          <button
            className="bulk-action-button success"
            type="button"
            onClick={() => runBulk("APPROVE")}
            disabled={isMutating}
          >
            <i className="fas fa-check" aria-hidden="true"></i>품질 통과
          </button>
          <button
            className="bulk-action-button danger"
            type="button"
            onClick={() => runBulk("REJECT")}
            disabled={isMutating}
          >
            <i className="fas fa-ban" aria-hidden="true"></i>품질 탈락
          </button>
        </>
      );
    return (
      <button
        className="bulk-action-button success"
        type="button"
        onClick={() => runBulk("PUBLISH")}
        disabled={isMutating}
      >
        <i className="fas fa-check" aria-hidden="true"></i>승인 및 공개
      </button>
    );
  };

  const matchedArticle = (item) =>
    item.matched || item.candidates?.[0]?.article || item.candidates?.[0];

  // 응답에 따라 articleUrl 이 항목에 직접 오기도 하고 source 안에 오기도 합니다.
  const matchedUrl = (item) => {
    const matched = matchedArticle(item);
    return matched?.articleUrl || matched?.source?.articleUrl || null;
  };

  return (
    <AdminTechArticleContent>
      <section className="admin-intro" aria-labelledby="adminViewTitle">
        <div>
          <p className="section-eyebrow orbitron">{copy.eyebrow}</p>
          <h2 id="adminViewTitle" className="orbitron gradient-text">
            {copy.title}
          </h2>
          <p>{copy.description}</p>
        </div>
        <Link className="public-page-link" to="/tech-articles">
          공개 페이지 보기
          <i
            className="fas fa-arrow-up-right-from-square"
            aria-hidden="true"
          ></i>
        </Link>
      </section>

      {kind === "duplicates" ? (
        <section
          className="queue-overview-grid queue-overview-grid-single"
          aria-label="중복 의심 큐 현황"
        >
          <article className="widget-card queue-stat-card">
            <span className="queue-stat-icon tone-purple" aria-hidden="true">
              <i className="fas fa-code-compare"></i>
            </span>
            <div>
              <p>판정 대기</p>
              <strong>{currentCount}</strong>
              <small>POSSIBLE_DUPLICATE</small>
            </div>
          </article>
        </section>
      ) : (
        <>
          <section
            className="queue-overview-grid queue-overview-grid-two"
            aria-label="아티클 검토 큐 현황"
          >
            <article className="widget-card queue-stat-card">
              <span className="queue-stat-icon tone-warning" aria-hidden="true">
                <i className="fas fa-scale-balanced"></i>
              </span>
              <div>
                <p>품질 검토</p>
                <strong>
                  {qualityCount ?? (kind === "quality" ? currentCount : "—")}
                </strong>
                <small>REVIEW_REQUIRED</small>
              </div>
            </article>
            <article className="widget-card queue-stat-card">
              <span className="queue-stat-icon tone-purple" aria-hidden="true">
                <i className="fas fa-eye"></i>
              </span>
              <div>
                <p>공개 검토</p>
                <strong>
                  {publicationCount ??
                    (kind === "publication" ? currentCount : "—")}
                </strong>
                <small>정책에 따른 공개 승인</small>
              </div>
            </article>
          </section>
          <div className="review-tabs" aria-label="검토 유형 필터">
            <Link
              className={`review-tab ${kind === "quality" ? "is-active" : ""}`}
              to="/admin/tech-articles/reviews/quality"
              aria-pressed={kind === "quality"}
            >
              <i className="fas fa-scale-balanced" aria-hidden="true"></i>품질
              검토
              <span>
                {qualityCount ?? (kind === "quality" ? currentCount : "—")}
              </span>
            </Link>
            <Link
              className={`review-tab ${kind === "publication" ? "is-active" : ""}`}
              to="/admin/tech-articles/reviews/publication"
              aria-pressed={kind === "publication"}
            >
              <i className="fas fa-eye" aria-hidden="true"></i>공개 검토
              <span>
                {publicationCount ??
                  (kind === "publication" ? currentCount : "—")}
              </span>
            </Link>
          </div>
          <p className="review-tab-help">
            {kind === "quality"
              ? "품질 평가 경계값에 있어 사람의 판단이 필요한 아티클입니다. 이 단계에는 AI 요약이 아직 없습니다."
              : "AI 요약까지 완료됐지만 ‘검토 후 공개’ 정책에 따라 최종 승인을 기다리는 아티클입니다."}
          </p>
        </>
      )}

      <section
        className="widget-card filter-card"
        aria-labelledby="filterTitle"
      >
        <div className="section-heading-row">
          <div>
            <p className="section-eyebrow orbitron">SEARCH &amp; FILTER</p>
            <h3 id="filterTitle">검색 및 필터</h3>
          </div>
          <button
            className="btn-secondary btn-small"
            type="button"
            onClick={resetFilters}
          >
            <i className="fas fa-rotate-left" aria-hidden="true"></i>필터 초기화
          </button>
        </div>
        <form
          className="filter-grid"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setKeyword(keywordInput.trim());
          }}
        >
          <div className="form-field form-field-search">
            <label htmlFor="queryInput">검색</label>
            <div className="input-with-icon">
              <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
              <input
                id="queryInput"
                className="form-input"
                type="search"
                autoComplete="off"
                maxLength={100}
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                placeholder={
                  kind === "duplicates"
                    ? "후보 제목, 기존 아티클, 출처에서 검색"
                    : "제목, 출처, 검토 사유에서 검색"
                }
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="recordFilter">
              {kind === "duplicates" ? "검토 기준" : "수집 방식"}
            </label>
            <select
              id="recordFilter"
              className="form-input"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {kind === "duplicates"
                  ? "Jaccard 계수 0.92 이상"
                  : "모든 수집 방식"}
              </option>
              {kind !== "duplicates" && (
                <>
                  <option value="RSS">RSS</option>
                  <option value="WEB_CRAWL">WEB_CRAWL</option>
                  <option value="API">API</option>
                </>
              )}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="sortSelect">정렬</label>
            <select
              id="sortSelect"
              className="form-input"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="NEWEST">최근 대기·등록순</option>
              {kind === "duplicates" && (
                <option value="SIMILARITY_DESC">Jaccard 계수 높은순</option>
              )}
            </select>
          </div>
        </form>
      </section>

      <section
        className="article-management-section"
        aria-labelledby="recordListTitle"
      >
        <div className="list-heading-row">
          <div>
            <p className="section-eyebrow orbitron">QUEUE &amp; RECORDS</p>
            <h3 id="recordListTitle">{copy.listTitle}</h3>
          </div>
          <p className="result-count" role="status">
            총 {currentCount}건 · {response?.pagination?.currentPage || page}
            페이지
          </p>
        </div>
        {selectedRecords.length > 0 && (
          <div className="selection-action-bar">
            <div>
              <strong>{selectedRecords.length}개 선택됨</strong>
              <span>현재 페이지에서 선택한 항목에만 적용됩니다.</span>
            </div>
            <div className="selection-actions">
              {bulkButtons()}
              <button
                className="bulk-clear-button"
                type="button"
                onClick={() => setSelected({})}
              >
                <i className="fas fa-xmark" aria-hidden="true"></i>선택 해제
              </button>
            </div>
          </div>
        )}
        <div className="widget-card article-table-card">
          <div className="article-table-wrap">
            <table className="article-table admin-v9-table">
              <caption className="sr-only">
                {copy.listTitle} 및 관리 작업
              </caption>
              <thead>
                <tr>
                  <th className="selection-column" scope="col">
                    <input
                      className="selection-checkbox"
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePage}
                      aria-label="현재 페이지 전체 선택"
                    />
                  </th>
                  {kind === "duplicates" ? (
                    <>
                      <th scope="col">수집 후보</th>
                      <th scope="col">기존 아티클</th>
                      <th scope="col">검토 기준</th>
                      <th scope="col">Jaccard 계수</th>
                      <th scope="col">대기 시각</th>
                      <th scope="col">작업</th>
                    </>
                  ) : (
                    <>
                      <th scope="col">아티클</th>
                      <th scope="col">출처 · 언어</th>
                      <th scope="col">검토 유형</th>
                      <th scope="col">검토 사유</th>
                      <th scope="col">가치 점수</th>
                      <th scope="col">대기 시각</th>
                      <th scope="col">작업</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading && !response ? (
                  <tr>
                    <td className="admin-empty-state" colSpan="8">
                      <i
                        className="fas fa-circle-notch fa-spin"
                        aria-hidden="true"
                      ></i>
                      <h3>검토 큐를 불러오는 중입니다.</h3>
                    </td>
                  </tr>
                ) : !records.length ? (
                  <tr>
                    <td className="admin-empty-state" colSpan="8">
                      <i className="fas fa-inbox" aria-hidden="true"></i>
                      <h3>조건에 맞는 항목이 없습니다.</h3>
                      <p>검색어 또는 필터를 변경해 보세요.</p>
                    </td>
                  </tr>
                ) : (
                  records.map((item) => {
                    const id = recordId(kind, item);
                    const matched = matchedArticle(item);
                    const isQuality = kind === "quality";
                    return (
                      <tr
                        key={id}
                        className={selected[id] ? "is-selected" : ""}
                      >
                        <td className="selection-column">
                          <input
                            className="selection-checkbox"
                            type="checkbox"
                            checked={Boolean(selected[id])}
                            onChange={() => toggleRecord(item)}
                            aria-label={`${candidateTitle(item)} 선택`}
                          />
                        </td>
                        {kind === "duplicates" ? (
                          <>
                            <td className="admin-article-cell">
                              <span className="admin-article-id">
                                {item.crawlItemId || id}
                              </span>
                              <p className="admin-article-title">
                                {candidateTitle(item)}
                              </p>
                              <p className="admin-article-summary">
                                {sourceName(item.candidate?.source)} ·{" "}
                                {languageLabel(
                                  item.candidate?.originalLanguage,
                                )}
                              </p>
                            </td>
                            <td className="duplicate-match-cell">
                              <span className="admin-article-id">
                                {matched?.articleId || "—"}
                              </span>
                              <strong>
                                {matched?.title || "연결된 기존 아티클 없음"}
                              </strong>
                              <small>{sourceName(matched?.source)}</small>
                            </td>
                            <td className="duplicate-method-cell">
                              <span className="duplicate-method-badge">
                                <i
                                  className="fas fa-calculator"
                                  aria-hidden="true"
                                ></i>
                                Jaccard 계수 0.92 이상
                              </span>
                            </td>
                            <td>
                              <span className="jaccard-score">
                                {similarityValue(item)}
                              </span>
                            </td>
                            <td className="admin-date-cell">
                              <strong>{formatDate(item.queuedAt)}</strong>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="row-action primary-row-action"
                                  type="button"
                                  onClick={() => setDetail(item)}
                                >
                                  <i
                                    className="fas fa-code-compare"
                                    aria-hidden="true"
                                  ></i>
                                  비교·판정
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="admin-article-cell">
                              <span className="admin-article-id">
                                {item.articleId}
                              </span>
                              <p className="admin-article-title">
                                {item.title || "제목 없음"}
                              </p>
                              <p className="admin-article-summary">
                                {isQuality
                                  ? "AI 요약 생성 전"
                                  : item.oneLineSummary || "한 줄 요약 없음"}
                              </p>
                            </td>
                            <td className="admin-source-cell">
                              <strong>{sourceName(item.source)}</strong>
                              <span className="source-language">
                                <i
                                  className="fas fa-language"
                                  aria-hidden="true"
                                ></i>
                                {languageLabel(
                                  item.originalLanguage || item.language,
                                )}
                              </span>
                            </td>
                            <td>
                              <StatusBadge
                                tone={isQuality ? "pending" : "processing"}
                              >
                                {isQuality ? "품질 검토" : "공개 검토"}
                              </StatusBadge>
                            </td>
                            <td className="review-reason-cell">
                              <p>
                                {item.reason ||
                                  (isQuality
                                    ? "관리자 품질 검토가 필요합니다."
                                    : "공개 승인 대기")}
                              </p>
                            </td>
                            <td>
                              <span
                                className={`admin-score ${scoreTone(item)}`}
                                title={scoreToneLabel(item)}
                              >
                                {item.valueScore ?? item.score ?? "—"}
                              </span>
                            </td>
                            <td className="admin-date-cell">
                              <strong>{formatDate(item.queuedAt)}</strong>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="row-action primary-row-action"
                                  type="button"
                                  onClick={() => setDetail(item)}
                                >
                                  <i
                                    className="fas fa-magnifying-glass"
                                    aria-hidden="true"
                                  ></i>
                                  검토
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="article-card-list">
          {records.map((item) => {
            const id = recordId(kind, item);
            const isQuality = kind === "quality";
            return (
              <article
                className={`admin-mobile-card ${selected[id] ? "is-selected" : ""}`}
                key={id}
              >
                <div className="admin-mobile-card-heading">
                  <div>
                    <span className="admin-article-id">
                      {item.articleId || item.crawlItemId || id}
                    </span>
                    <h3>{candidateTitle(item)}</h3>
                  </div>
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={Boolean(selected[id])}
                    onChange={() => toggleRecord(item)}
                  />
                </div>
                <p className="admin-mobile-card-summary">
                  {kind === "duplicates"
                    ? `기존: ${matchedArticle(item)?.title || "연결 후보 없음"}`
                    : item.reason || item.oneLineSummary}
                </p>
                <div className="admin-mobile-meta">
                  <span>
                    {kind === "duplicates" ? "검토 기준" : "검토 유형"}
                    <strong>
                      {kind === "duplicates"
                        ? "Jaccard 계수 0.92 이상"
                        : isQuality
                          ? "품질 검토"
                          : "공개 검토"}
                    </strong>
                  </span>
                  <span>
                    {kind === "duplicates" ? "Jaccard 계수" : "가치 점수"}
                    <strong>
                      {kind === "duplicates"
                        ? similarityValue(item)
                        : `${item.valueScore ?? item.score ?? "—"}점`}
                    </strong>
                  </span>
                </div>
                <div className="admin-mobile-controls">
                  <StatusBadge
                    tone={kind === "publication" ? "processing" : "pending"}
                  >
                    {kind === "duplicates"
                      ? "POSSIBLE_DUPLICATE"
                      : isQuality
                        ? "REVIEW_REQUIRED"
                        : "공개 승인 대기"}
                  </StatusBadge>
                  <button
                    className="row-action primary-row-action"
                    type="button"
                    onClick={() => setDetail(item)}
                  >
                    {kind === "duplicates" ? "비교·판정" : "검토"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {response?.pagination?.totalPages > 1 && (
          <nav className="admin-pagination" aria-label="목록 페이지 이동">
            <button
              className="admin-page-button"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            {getPageTokens(page, response.pagination.totalPages).map(
              (token, index) =>
                token === "ellipsis" ? (
                  <span key={`ellipsis-${index}`}>…</span>
                ) : (
                  <button
                    className="admin-page-button"
                    type="button"
                    key={token}
                    aria-current={token === page ? "page" : undefined}
                    onClick={() => setPage(token)}
                  >
                    {token}
                  </button>
                ),
            )}
            <button
              className="admin-page-button"
              type="button"
              disabled={page >= response.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <i className="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </nav>
        )}
      </section>

      <dialog
        ref={detailDialogRef}
        className="admin-dialog admin-dialog-wide"
        onClose={() => setDetail(null)}
      >
        <div className="dialog-panel">
          <header className="dialog-header">
            <div>
              <p className="section-eyebrow orbitron">
                {kind === "duplicates"
                  ? "DUPLICATE COMPARISON"
                  : kind === "quality"
                    ? "QUALITY REVIEW"
                    : "PUBLICATION REVIEW"}
              </p>
              <h2>
                {kind === "duplicates"
                  ? "중복 후보 비교·판정"
                  : kind === "quality"
                    ? "품질 검토 상세"
                    : "공개 검토 상세"}
              </h2>
            </div>
            <button
              className="dialog-close-button"
              type="button"
              onClick={() => setDetail(null)}
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </header>
          <div className="detail-dialog-content">
            {detail &&
              (kind === "duplicates" ? (
                <>
                  <div className="case-id-row">
                    <span>중복 검사 건</span>
                    <strong>{recordId(kind, detail)}</strong>
                    <span>수집 항목</span>
                    <strong>{detail.crawlItemId || "—"}</strong>
                  </div>
                  <div className="duplicate-comparison-grid">
                    <article className="comparison-card candidate-card">
                      <span className="comparison-label">신규 수집 후보</span>
                      <h3>{candidateTitle(detail)}</h3>
                      <dl>
                        <div>
                          <dt>출처</dt>
                          <dd>{sourceName(detail.candidate?.source)}</dd>
                        </div>
                        <div>
                          <dt>원문 언어</dt>
                          <dd>
                            {languageLabel(detail.candidate?.originalLanguage)}
                          </dd>
                        </div>
                        <div>
                          <dt>원문 게시일</dt>
                          <dd>
                            {formatDate(
                              detail.candidate?.originalPublishedAt ||
                                detail.candidate?.publishedAt,
                            )}
                          </dd>
                        </div>
                      </dl>
                      {detail.candidate?.source?.articleUrl && (
                        <a
                          href={detail.candidate.source.articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          후보 원문 보기
                          <i
                            className="fas fa-arrow-up-right-from-square"
                            aria-hidden="true"
                          ></i>
                        </a>
                      )}
                    </article>
                    <div className="comparison-score">
                      <span>Jaccard 계수</span>
                      <strong>{similarityValue(detail)}</strong>
                      <small>기준 0.92 이상</small>
                    </div>
                    <article className="comparison-card existing-card">
                      <span className="comparison-label">기존 아티클</span>
                      <span className="admin-article-id">
                        {matchedArticle(detail)?.articleId || "—"}
                      </span>
                      <h3>
                        {matchedArticle(detail)?.title ||
                          "연결된 기존 아티클 없음"}
                      </h3>
                      <dl>
                        <div>
                          <dt>출처</dt>
                          <dd>{sourceName(matchedArticle(detail)?.source)}</dd>
                        </div>
                        <div>
                          <dt>원문 언어</dt>
                          <dd>
                            {languageLabel(
                              matchedArticle(detail)?.originalLanguage,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>원문 게시일</dt>
                          <dd>
                            {formatDate(
                              matchedArticle(detail)?.originalPublishedAt,
                            )}
                          </dd>
                        </div>
                      </dl>
                      {matchedUrl(detail) && (
                        <a
                          href={matchedUrl(detail)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          기존 원문 보기
                          <i
                            className="fas fa-arrow-up-right-from-square"
                            aria-hidden="true"
                          ></i>
                        </a>
                      )}
                    </article>
                  </div>
                  <p className="decision-guidance">
                    <i className="fas fa-circle-info" aria-hidden="true"></i>
                    Duplicate 판정 시 기존 아티클과 연결하고 후보 처리를
                    종료합니다. Unique 판정 시 신규 아티클 흐름으로 이동합니다.
                  </p>
                </>
              ) : kind === "quality" ? (
                <article className="admin-detail-record">
                  <span className="admin-article-id">{detail.articleId}</span>
                  <h3 className="admin-detail-title">{detail.title}</h3>
                  <div className="admin-detail-meta">
                    <StatusBadge>REVIEW_REQUIRED</StatusBadge>
                    <StatusBadge tone="hidden">AI 요약 생성 전</StatusBadge>
                  </div>
                  <section className="quality-review-reason">
                    <div>
                      <span className="quality-reason-icon">
                        <i
                          className="fas fa-scale-balanced"
                          aria-hidden="true"
                        ></i>
                      </span>
                      <div>
                        <h4>검토 필요 사유</h4>
                        <p>
                          {detail.reason || "관리자 품질 검토가 필요합니다."}
                        </p>
                      </div>
                    </div>
                  </section>
                  <OriginalSourceLink url={detail.source?.articleUrl} />
                  <QualityEvaluationPanel
                    evaluation={detail.evaluation}
                    fallbackScore={detail.valueScore ?? detail.score}
                    extraFacts={<QualitySignals signals={detail.signals} />}
                  />
                  <section className="admin-detail-section">
                    <h4>원문 및 처리 정보</h4>
                    <div className="admin-detail-grid">
                      <DetailFact
                        label="검토 작업 ID"
                        value={recordId(kind, detail)}
                        mono
                      />
                      <DetailFact
                        label="아티클 ID"
                        value={detail.articleId}
                        mono
                      />
                      <DetailFact
                        label="수집 방식"
                        value={detail.source?.type || detail.sourceType}
                      />
                      <DetailFact
                        label="원문 언어"
                        value={languageLabel(
                          detail.originalLanguage || detail.language,
                        )}
                      />
                      <DetailFact
                        label="대기 등록"
                        value={formatDate(detail.queuedAt)}
                      />
                      <DetailFact label="처리 상태" value="QUALITY_EVALUATED" />
                    </div>
                  </section>
                  <p className="decision-guidance">
                    <i className="fas fa-circle-info" aria-hidden="true"></i>
                    품질 통과 후 AI 요약을 생성합니다. 현재 공개 정책이 검토 후
                    공개이므로 요약 완료 뒤 공개 검토 큐로 이동합니다.
                  </p>
                </article>
              ) : (
                <article className="admin-detail-record">
                  <span className="admin-article-id">{detail.articleId}</span>
                  <h3 className="admin-detail-title">{detail.title}</h3>
                  <div className="admin-detail-meta">
                    <StatusBadge tone="processing">공개 승인 대기</StatusBadge>
                    <StatusBadge tone="published">AI 요약 완료</StatusBadge>
                  </div>
                  <section className="admin-detail-section">
                    <h4>한 줄 요약</h4>
                    <p className="detail-one-line-summary">
                      {detail.oneLineSummary || "한 줄 요약 없음"}
                    </p>
                  </section>
                  <section className="admin-detail-section">
                    <h4>상세 요약</h4>
                    <SafeMarkdown
                      markdown={detail.summaryMarkdown}
                      className="admin-markdown-body"
                    />
                  </section>
                  <OriginalSourceLink
                    url={detail.source?.articleUrl || detail.canonicalUrl}
                  />
                  <QualityEvaluationPanel
                    evaluation={detail.evaluation}
                    fallbackScore={detail.valueScore ?? detail.score}
                  />
                  <section className="admin-detail-section">
                    <h4>분야 태그</h4>
                    <ArticleTags tags={detail.tags} />
                  </section>
                </article>
              ))}
          </div>
          <footer className="admin-dialog-actions">
            {detail && kind === "duplicates" ? (
              <>
                <button
                  className="btn-success"
                  type="button"
                  onClick={() => runSingle(detail, "APPROVE_UNIQUE")}
                  disabled={isMutating}
                >
                  <i className="fas fa-check" aria-hidden="true"></i>Unique
                </button>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => runSingle(detail, "CONFIRM_DUPLICATE")}
                  disabled={isMutating || !matchedArticle(detail)?.articleId}
                >
                  Duplicate
                </button>
              </>
            ) : detail && kind === "quality" ? (
              <>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => runSingle(detail, "REJECT")}
                  disabled={isMutating}
                >
                  품질 탈락
                </button>
                <button
                  className="btn-success"
                  type="button"
                  onClick={() => runSingle(detail, "APPROVE")}
                  disabled={isMutating}
                >
                  품질 통과
                </button>
              </>
            ) : detail ? (
              <button
                className="btn-success"
                type="button"
                onClick={() => runSingle(detail, "PUBLISH")}
                disabled={isMutating}
              >
                <i className="fas fa-check" aria-hidden="true"></i>승인 및 공개
              </button>
            ) : null}
          </footer>
        </div>
      </dialog>
      {confirmDialog}
      {notice && (
        <div className="toast" role="status">
          <i
            className={`fas ${notice.type === "error" ? "fa-triangle-exclamation" : "fa-circle-check"}`}
            aria-hidden="true"
          ></i>
          <p>{notice.message}</p>
        </div>
      )}
    </AdminTechArticleContent>
  );
}

export default AdminTechArticleReviews;
