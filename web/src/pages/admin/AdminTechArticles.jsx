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
  getAdminTechArticle,
  getAdminTechArticles,
  getAdminTechArticleStats,
  getPublicationPolicy,
  isVersionConflict,
  reprocessArticle,
  resolveQualityReview,
  techArticleErrorMessage,
  updatePublicationPolicy,
} from "../../api/techArticles";
import AdminTechArticleContent from "../../components/tech-articles/AdminTechArticleContent";
import { SafeMarkdown } from "../../components/tech-articles/TechArticleCommon";
import { getPageTokens } from "../../components/tech-articles/TechArticlePagination";
import { QualityEvaluationPanel } from "../../components/tech-articles/ArticleQualityPanel";
import { useV9ConfirmDialog } from "../../components/tech-articles/V9ConfirmDialog";
import {
  MISMATCH_FILTER,
  STAGE_EXIT,
  STAGE_FLOW,
  STAGE_ORDER,
  STAGE_WAITING,
  canPublishArticle,
  formatWaiting,
  hasStateMismatch,
  partitionPublishable,
  publishBlockReason,
  resolveStage,
  scoreTone,
  scoreToneLabel,
  stageMeta,
  statusLabel,
  statusTone,
} from "../../components/tech-articles/techArticleStatus";

const PAGE_SIZE = 20;
const PUBLICATION_OPTIONS = [
  ["", "모든 공개 상태"],
  ["PUBLISHED", "공개"],
  ["HIDDEN", "비공개"],
  ["ARCHIVED", "보관"],
  ["UNPUBLISHED", "미공개"],
  ["SCHEDULED", "공개 예정"],
];
const ACTION_LABEL = { PUBLISH: "공개", HIDE: "비공개", ARCHIVE: "보관" };
const MISMATCH_HINT =
  "공개 처리 과정에서 검토 상태가 잘못 올라간 값입니다. 표시에만 영향이 있고 파이프라인 동작은 정상입니다.";

function shortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function fullDate(value) {
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

function sourceLanguage(article) {
  return (
    article.originalLanguage?.label ||
    article.originalLanguage ||
    "확인되지 않음"
  );
}

function pendingQualityReview(article) {
  const review = article?.qualityReview;
  if (
    resolveStage(article) !== "QUALITY_REVIEW" ||
    !review?.caseId ||
    !Number.isInteger(review.caseVersion)
  ) {
    return null;
  }
  return review;
}

function canRetryProcessing(article) {
  return ["FAILED", "FAILED_AFTER_APPROVAL"].includes(resolveStage(article));
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function StageBadge({ article, withHint = false }) {
  const meta = stageMeta(resolveStage(article));
  return (
    <div className="stage-cell">
      <span className={`status-badge stage-badge ${meta.tone}`}>
        <i className={`fas ${meta.icon}`} aria-hidden="true"></i>
        {meta.label}
      </span>
      {hasStateMismatch(article) && (
        <span className="stage-flag" title={MISMATCH_HINT}>
          <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
          검토 상태 표시 오류
        </span>
      )}
      {withHint && meta.hint && (
        <small className="stage-hint">{meta.hint}</small>
      )}
    </div>
  );
}

function ViewCountCell({ counts }) {
  const member = counts?.member ?? 0;
  const guest = counts?.guest ?? 0;
  return (
    <div className="admin-view-grid">
      <strong className="admin-view-total">{member + guest}</strong>
      <span>회원</span>
      <strong>{member}</strong>
      <span>비회원</span>
      <strong>{guest}</strong>
    </div>
  );
}

function PublishControl({ article, isMutating, onToggle }) {
  const published = article.publicationStatus === "PUBLISHED";
  const blockReason = publishBlockReason(article);
  const blocked = !published && Boolean(blockReason);
  return (
    <div className="publish-control-group">
      <label className="publish-control">
        <span className="switch">
          <input
            type="checkbox"
            checked={published}
            onChange={() => onToggle(article, published ? "HIDE" : "PUBLISH")}
            disabled={isMutating || blocked}
            aria-label={`${article.title || article.articleId} 공개 설정`}
            aria-describedby={
              blocked ? `publish-block-${article.articleId}` : undefined
            }
          />
          <span className="switch-track"></span>
        </span>
        <span>{published ? "공개" : "비공개"}</span>
      </label>
      {blocked && (
        <span
          className="publish-blocked-reason"
          id={`publish-block-${article.articleId}`}
        >
          {blockReason}
        </span>
      )}
    </div>
  );
}

function StageToolbar({ total, summary, mismatchCount, value, onChange }) {
  const toggle = (next) => onChange(value === next ? "" : next);
  const selected = summary.find((entry) => entry.stage === value);
  const waiting =
    selected && STAGE_WAITING.includes(selected.stage)
      ? formatWaiting(selected.oldest)
      : null;
  const byStage = Object.fromEntries(
    summary.map((entry) => [entry.stage, entry]),
  );
  const exitTotal = STAGE_EXIT.reduce(
    (sum, stage) => sum + (byStage[stage]?.count ?? 0),
    0,
  );
  const chipTitle = (entry) => {
    if (!entry.count) return "이 단계에 머문 아티클이 없습니다";
    if (!STAGE_WAITING.includes(entry.stage)) return entry.hint || undefined;
    const elapsed = formatWaiting(entry.oldest);
    return elapsed ? `가장 오래 머문 건 ${elapsed} 경과` : undefined;
  };
  const chip = (entry) => (
    <button
      type="button"
      key={entry.stage}
      className={`stage-chip ${entry.tone} ${
        value === entry.stage ? "is-active" : ""
      } ${entry.count ? "" : "is-empty"}`}
      onClick={() => toggle(entry.stage)}
      aria-pressed={value === entry.stage}
      disabled={!entry.count && value !== entry.stage}
      title={chipTitle(entry)}
    >
      <i className={`fas ${entry.icon}`} aria-hidden="true"></i>
      {entry.label}
      <strong>{entry.count}</strong>
    </button>
  );
  return (
    <div className="stage-toolbar">
      <div className="stage-chips" role="group" aria-label="파이프라인 단계">
        <button
          type="button"
          className={`stage-chip ${value ? "" : "is-active"}`}
          onClick={() => onChange("")}
          aria-pressed={!value}
        >
          전체<strong>{total}</strong>
        </button>

        <div
          className="stage-group is-flow"
          role="group"
          aria-label="진행 중인 단계"
        >
          {STAGE_FLOW.map((stage) => byStage[stage])
            .filter(Boolean)
            .map(chip)}
        </div>

        <div
          className="stage-group is-exit"
          role="group"
          aria-label="종료된 상태"
        >
          <span className="stage-group-label">
            <i className="fas fa-arrow-turn-down" aria-hidden="true"></i>
            종료 {exitTotal}
          </span>
          {STAGE_EXIT.map((stage) => byStage[stage])
            .filter(Boolean)
            .map(chip)}
        </div>
        {mismatchCount > 0 && (
          <button
            type="button"
            className={`stage-chip stage-chip-flag ${
              value === MISMATCH_FILTER ? "is-active" : ""
            }`}
            onClick={() => toggle(MISMATCH_FILTER)}
            aria-pressed={value === MISMATCH_FILTER}
          >
            <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
            검토 상태 표시 오류<strong>{mismatchCount}</strong>
          </button>
        )}
        <span className="stage-toolbar-scope">전체 기준</span>
      </div>
      {waiting && (
        <p className="stage-summary-note" role="status">
          <i className="fas fa-clock" aria-hidden="true"></i>이 단계에 가장 오래
          머문 아티클이 <strong>{waiting}</strong> 지났습니다. &nbsp;— 마지막
          수정 시각 기준이라 실제 대기 시간은 이보다 길 수 있습니다. 정렬을{" "}
          <strong>오래 머문 순</strong>으로 바꾸면 그 건부터 보입니다.
        </p>
      )}
      {value === MISMATCH_FILTER && (
        <p className="stage-summary-note" role="status">
          <i className="fas fa-circle-info" aria-hidden="true"></i>
          공개 토글로 공개했다가 되돌린 아티클입니다. 그 과정에서 검토 상태가
          &ldquo;검토 승인&rdquo;으로 잘못 올라갔습니다.{" "}
          <strong>표시에만 영향이 있고 파이프라인 동작은 정상입니다</strong>
          &nbsp;— AI 요약 자격과 공개 검토 큐, 파이프라인 단계는 모두 이 값을
          참조하지 않습니다. 공개 토글에는 처리 단계 가드가 걸려 있지만 관리자
          화면 경로에만 있어, API 를 직접 호출하면 아직 새로 생길 수 있습니다.
        </p>
      )}
    </div>
  );
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

function AdminTechArticles() {
  const [response, setResponse] = useState(null);
  const [stats, setStats] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [policyDraft, setPolicyDraft] = useState("REVIEW");
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [publicationStatus, setPublicationStatus] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [selected, setSelected] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailDialogRef = useRef(null);
  const { confirm: askConfirmation, confirmDialog } = useV9ConfirmDialog();

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAdminTechArticles({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        publicationStatus: publicationStatus || undefined,
        stage:
          stageFilter && stageFilter !== MISMATCH_FILTER
            ? stageFilter
            : undefined,
        statusMismatch: stageFilter === MISMATCH_FILTER ? true : undefined,
        sort,
      });
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
          "전체 아티클을 불러오지 못했습니다.",
        ),
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [keyword, page, publicationStatus, sort, stageFilter]);

  const loadOverview = useCallback(async () => {
    const [statsResult, policyResult] = await Promise.allSettled([
      getAdminTechArticleStats({
        keyword: keyword || undefined,
        publicationStatus: publicationStatus || undefined,
      }),
      getPublicationPolicy(),
    ]);
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (policyResult.status === "fulfilled") {
      setPolicy(policyResult.value);
      setPolicyDraft(policyResult.value?.policy || "REVIEW");
    }
  }, [keyword, publicationStatus]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);
  useEffect(() => {
    setSelected({});
  }, [keyword, page, publicationStatus, sort, stageFilter]);
  useEffect(() => {
    setPage(1);
  }, [stageFilter, keyword, publicationStatus, sort]);

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    if ((detail || detailLoading) && !dialog.open) dialog.showModal();
    if (!detail && !detailLoading && dialog.open) dialog.close();
  }, [detail, detailLoading]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedRecords = useMemo(() => Object.values(selected), [selected]);
  const pageItems = useMemo(() => response?.items || [], [response]);
  const stageSummary = useMemo(
    () =>
      STAGE_ORDER.map((stage) => ({
        stage,
        count: stats?.stages?.[stage] ?? 0,
        oldest: stats?.stageOldest?.[stage] ?? null,
        ...stageMeta(stage),
      })),
    [stats],
  );
  const mismatchCount = stats?.statusMismatch ?? 0;
  const totalCount = response?.pagination?.totalCount ?? 0;
  const allPageSelected =
    pageItems.length > 0 && pageItems.every((item) => selected[item.articleId]);
  const publishedCount = stats?.publication?.PUBLISHED || 0;
  const hiddenCount = stats
    ? (stats.publication?.HIDDEN || 0) +
      (stats.publication?.ARCHIVED || 0) +
      (stats.publication?.UNPUBLISHED || 0)
    : 0;
  const toggleRecord = (record) => {
    setSelected((current) => {
      const next = { ...current };
      if (next[record.articleId]) delete next[record.articleId];
      else if (Object.keys(next).length < 50) next[record.articleId] = record;
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = { ...current };
      if (allPageSelected) {
        pageItems.forEach((item) => delete next[item.articleId]);
      } else {
        pageItems
          .slice(0, Math.max(0, 50 - Object.keys(next).length))
          .forEach((item) => {
            next[item.articleId] = item;
          });
      }
      return next;
    });
  };

  const refreshAfterConflict = async (message) => {
    setNotice({ type: "error", message });
    await Promise.all([loadInventory(), loadOverview()]);
  };

  const runSingleAction = async (article, action) => {
    if (action === "PUBLISH" && !canPublishArticle(article)) {
      setNotice({ type: "error", message: publishBlockReason(article) });
      return;
    }
    if (
      action === "ARCHIVE" &&
      !(await askConfirmation({
        title: "아티클을 보관할까요?",
        description: `“${article.title || article.articleId}” 아티클을 공개 목록에서 제외하고 장기 보관 상태로 전환합니다.`,
        confirmLabel: "보관",
      }))
    ) {
      return;
    }

    setIsMutating(true);
    try {
      await changeArticlePublication(article.articleId, {
        action,
        expectedRecordVersion: article.recordVersion,
        reason: "관리자 화면 단건 작업",
      });
      setSelected((current) => {
        const next = { ...current };
        delete next[article.articleId];
        return next;
      });
      setNotice({
        type: "success",
        message: `${ACTION_LABEL[action]} 처리를 완료했습니다.`,
      });
      await Promise.all([loadInventory(), loadOverview()]);
    } catch (error) {
      if (isVersionConflict(error)) {
        await refreshAfterConflict(techArticleErrorMessage(error));
      } else {
        setNotice({ type: "error", message: techArticleErrorMessage(error) });
      }
    } finally {
      setIsMutating(false);
    }
  };

  const resolvePendingQualityReview = async (article, action) => {
    const review = pendingQualityReview(article);
    if (!review) {
      await refreshAfterConflict(
        "대기 중인 품질검토 정보를 확인할 수 없어 목록을 새로 불러왔습니다.",
      );
      return;
    }
    const approving = action === "APPROVE";
    const accepted = await askConfirmation({
      title: approving
        ? "품질 통과로 판정할까요?"
        : "품질 탈락으로 판정할까요?",
      description: approving
        ? "AI 요약 단계로 전달되며, 요약 완료 후 현재 공개 정책이 적용됩니다."
        : "이 아티클은 후속 AI 요약과 공개 흐름으로 진행하지 않습니다.",
      confirmLabel: approving ? "품질 통과" : "품질 탈락",
      tone: approving ? "success" : "danger",
    });
    if (!accepted) return;

    setIsMutating(true);
    try {
      await resolveQualityReview(review.caseId, {
        action,
        expectedCaseVersion: review.caseVersion,
      });
      setSelected((current) => {
        const next = { ...current };
        delete next[article.articleId];
        return next;
      });
      setDetail(null);
      setNotice({
        type: "success",
        message: approving
          ? "품질 통과 처리를 완료하고 AI 요약 단계로 전달했습니다."
          : "품질 탈락 처리를 완료했습니다.",
      });
      await Promise.all([loadInventory(), loadOverview()]);
    } catch (error) {
      if (isVersionConflict(error)) {
        setDetail(null);
        await refreshAfterConflict(techArticleErrorMessage(error));
      } else {
        setNotice({ type: "error", message: techArticleErrorMessage(error) });
      }
    } finally {
      setIsMutating(false);
    }
  };

  const runReprocessing = async (article, action) => {
    const qualityOverride = action === "APPROVE_QUALITY";
    const accepted = await askConfirmation({
      title: qualityOverride
        ? "품질 미달 판정을 통과로 변경할까요?"
        : "실패한 처리를 다시 실행할까요?",
      description: qualityOverride
        ? "관리자 승인 이력을 남기고 AI 요약 단계로 전달합니다."
        : "마지막으로 실패한 품질 평가 또는 AI 요약 단계부터 다시 실행합니다.",
      confirmLabel: qualityOverride ? "품질 통과" : "재처리",
      tone: "success",
    });
    if (!accepted) return;

    setIsMutating(true);
    try {
      await reprocessArticle(article.articleId, {
        action,
        expectedRecordVersion: article.recordVersion,
      });
      setSelected((current) => {
        const next = { ...current };
        delete next[article.articleId];
        return next;
      });
      setDetail(null);
      setNotice({
        type: "success",
        message: qualityOverride
          ? "품질 통과 처리를 완료하고 AI 요약 단계로 전달했습니다."
          : "실패한 단계를 재처리 대기열에 등록했습니다.",
      });
      await Promise.all([loadInventory(), loadOverview()]);
    } catch (error) {
      if (isVersionConflict(error)) {
        setDetail(null);
        await refreshAfterConflict(techArticleErrorMessage(error));
      } else {
        setNotice({ type: "error", message: techArticleErrorMessage(error) });
      }
    } finally {
      setIsMutating(false);
    }
  };

  const runBulkAction = async (action) => {
    if (!selectedRecords.length) return;
    const { publishable, blocked } =
      action === "PUBLISH"
        ? partitionPublishable(selectedRecords)
        : { publishable: selectedRecords, blocked: [] };

    if (!publishable.length) {
      setNotice({
        type: "error",
        message: `선택한 ${blocked.length}건 모두 처리가 완료되지 않아 공개할 수 없습니다.`,
      });
      return;
    }

    const accepted = await askConfirmation({
      title: `${publishable.length}개 아티클을 ${ACTION_LABEL[action]}할까요?`,
      description: [
        action === "ARCHIVE"
          ? "선택한 아티클을 공개 목록에서 제외하고 장기 보관 상태로 전환합니다."
          : "현재 페이지에서 선택한 아티클의 공개 상태만 변경합니다.",
        blocked.length
          ? `선택한 ${selectedRecords.length}건 중 ${blocked.length}건은 처리가 완료되지 않아 제외됩니다.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      confirmLabel: ACTION_LABEL[action],
    });
    if (!accepted) return;

    setIsMutating(true);
    try {
      const result = await changeArticlePublicationBulk(
        publishable.map((article) => ({
          articleId: article.articleId,
          action,
          expectedRecordVersion: article.recordVersion,
          reason: "관리자 화면 일괄 작업",
        })),
      );
      const succeeded = new Set(
        result.results
          ?.filter((item) => item.status === "SUCCEEDED")
          .map((item) => item.id),
      );
      const failed = result.summary?.failed || 0;
      const excluded = blocked.length
        ? ` ${blocked.length}건은 처리 미완료로 제외했습니다.`
        : "";
      setNotice({
        type: failed ? "error" : "success",
        message: failed
          ? `${result.summary.succeeded}건 성공, ${failed}건 실패했습니다. 실패 항목은 선택을 유지했습니다.${excluded}`
          : `${result.summary?.succeeded || publishable.length}건을 ${ACTION_LABEL[action]} 처리했습니다.${excluded}`,
      });
      const [freshResponse] = await Promise.all([
        loadInventory(),
        loadOverview(),
      ]);
      const freshById = new Map(
        (freshResponse?.items || []).map((article) => [
          article.articleId,
          article,
        ]),
      );
      setSelected((current) =>
        Object.fromEntries(
          Object.entries(current)
            .filter(([id]) => !succeeded.has(id))
            .map(([id, article]) => [id, freshById.get(id) || article]),
        ),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: techArticleErrorMessage(
          error,
          "일괄 작업을 완료하지 못했습니다.",
        ),
      });
    } finally {
      setIsMutating(false);
    }
  };

  const savePolicy = async (event) => {
    event.preventDefault();
    if (!policy || policyDraft === policy.policy) return;
    const accepted = await askConfirmation({
      title:
        policyDraft === "IMMEDIATE"
          ? "즉시 공개 정책으로 변경할까요?"
          : "검토 후 공개 정책으로 변경할까요?",
      description:
        "변경한 정책은 저장 이후 새로 등록되는 아티클부터 적용됩니다.",
      confirmLabel: "정책 저장",
    });
    if (!accepted) {
      setPolicyDraft(policy.policy);
      return;
    }
    setIsMutating(true);
    try {
      const next = await updatePublicationPolicy({
        policy: policyDraft,
        expectedVersion: policy.recordVersion,
      });
      setPolicy(next);
      setPolicyDraft(next.policy);
      setNotice({
        type: "success",
        message: "새 아티클 공개 정책을 변경했습니다.",
      });
    } catch (error) {
      if (isVersionConflict(error)) await loadOverview();
      setNotice({ type: "error", message: techArticleErrorMessage(error) });
    } finally {
      setIsMutating(false);
    }
  };

  const openDetail = async (articleId) => {
    setDetailLoading(true);
    setDetail({ articleId, title: "불러오는 중…" });
    try {
      setDetail(await getAdminTechArticle(articleId));
    } catch (error) {
      setDetail(null);
      setNotice({
        type: "error",
        message: techArticleErrorMessage(
          error,
          "상세 정보를 불러오지 못했습니다.",
        ),
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setPublicationStatus("");
    setSort("NEWEST");
    setPage(1);
  };

  return (
    <AdminTechArticleContent>
      <section className="admin-intro" aria-labelledby="adminViewTitle">
        <div>
          <h2 id="adminViewTitle" className="orbitron gradient-text">
            전체 아티클
          </h2>
          <p>
            중복 검토를 통과해 등록된 아티클의 처리 현황과 공개 상태를
            관리합니다.
            <br />
            중복 검토 대기 항목은 &lsquo;중복 의심&rsquo; 메뉴에서 확인할 수
            있습니다.
          </p>
        </div>
        <div className="admin-intro-actions">
          <Link className="public-page-link" to="/tech-articles">
            공개 페이지 보기
            <i
              className="fas fa-arrow-up-right-from-square"
              aria-hidden="true"
            ></i>
          </Link>
        </div>
      </section>

      <section className="admin-overview-grid" aria-label="아티클 운영 현황">
        <article className="widget-card total-card">
          <div className="overview-card-heading">
            <span
              className="overview-icon overview-icon-blue"
              aria-hidden="true"
            >
              <i className="fas fa-newspaper"></i>
            </span>
            <p className="overview-card-title">등록된 아티클</p>
          </div>
          <p className="total-article-count">
            {stats?.totalCount ?? response?.pagination?.totalCount ?? "—"}
          </p>
          <div
            className="queue-stat-inline"
            aria-label={`공개 ${publishedCount}건, 비공개 ${hiddenCount}건`}
          >
            <span>공개 {publishedCount}</span>
            <span className="queue-stat-divider" aria-hidden="true">
              |
            </span>
            <span>비공개 {hiddenCount}</span>
          </div>
        </article>

        <article className="widget-card policy-card">
          <div className="policy-heading">
            <div>
              <h3>새 아티클 공개 정책</h3>
            </div>
            <span className="policy-scope-badge">전체 적용</span>
          </div>
          <form className="policy-form" onSubmit={savePolicy}>
            <fieldset>
              <legend className="sr-only">새 아티클 공개 방식 선택</legend>
              <div className="policy-options">
                <label className="policy-option">
                  <input
                    type="radio"
                    name="publicationPolicy"
                    value="IMMEDIATE"
                    checked={policyDraft === "IMMEDIATE"}
                    onChange={(event) => setPolicyDraft(event.target.value)}
                  />
                  <span className="policy-option-content">
                    <span className="policy-option-icon" aria-hidden="true">
                      <i className="fas fa-bolt"></i>
                    </span>
                    <span>
                      <strong>즉시 공개</strong>
                      <small>처리가 끝난 새 아티클을 바로 공개</small>
                    </span>
                  </span>
                </label>
                <label className="policy-option">
                  <input
                    type="radio"
                    name="publicationPolicy"
                    value="REVIEW"
                    checked={policyDraft === "REVIEW"}
                    onChange={(event) => setPolicyDraft(event.target.value)}
                  />
                  <span className="policy-option-content">
                    <span className="policy-option-icon" aria-hidden="true">
                      <i className="fas fa-user-check"></i>
                    </span>
                    <span>
                      <strong>검토 후 공개</strong>
                      <small>공개 검토 큐에서 승인 및 공개</small>
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="policy-footer">
              <p className="policy-description">
                {policyDraft === "REVIEW" ? (
                  <>
                    앞으로 등록되는 새 아티클은 AI 요약 완료 후{" "}
                    <strong>공개 검토 큐</strong>로 이동합니다.
                  </>
                ) : (
                  <>
                    앞으로 등록되는 새 아티클은 모든 처리가 정상 완료되면{" "}
                    <strong>즉시 공개</strong>됩니다.
                  </>
                )}
              </p>
              <button
                className="btn-primary btn-small"
                type="submit"
                disabled={
                  !policy || policyDraft === policy.policy || isMutating
                }
              >
                <i className="fas fa-floppy-disk" aria-hidden="true"></i>정책
                저장
              </button>
            </div>
          </form>
        </article>
      </section>

      <section
        className="widget-card filter-card"
        aria-labelledby="filterTitle"
      >
        <div className="section-heading-row">
          <div>
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
                placeholder="제목, 요약, 출처에서 검색"
              />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="recordFilter">공개 상태</label>
            <select
              id="recordFilter"
              className="form-input"
              value={publicationStatus}
              onChange={(event) => {
                setPublicationStatus(event.target.value);
                setPage(1);
              }}
            >
              {PUBLICATION_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
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
              <option value="OLDEST">오래 머문 순</option>
              <option value="SCORE_DESC">가치 점수 높은순</option>
              <option value="SCORE_ASC">가치 점수 낮은순</option>
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
            <h3 id="recordListTitle">아티클 목록</h3>
          </div>
          <p className="result-count" role="status" aria-live="polite">
            총 {totalCount}건 · {response?.pagination?.currentPage || page}
            페이지
          </p>
        </div>

        <StageToolbar
          total={stats?.totalCount ?? 0}
          summary={stageSummary}
          mismatchCount={mismatchCount}
          value={stageFilter}
          onChange={setStageFilter}
        />

        {selectedRecords.length > 0 && (
          <div className="selection-action-bar">
            <div>
              <strong>{selectedRecords.length}개 선택됨</strong>
              <span>현재 페이지에서 선택한 항목에만 적용됩니다.</span>
            </div>
            <div className="selection-actions">
              <button
                className="bulk-action-button"
                type="button"
                onClick={() => runBulkAction("PUBLISH")}
                disabled={isMutating}
              >
                <i className="fas fa-eye" aria-hidden="true"></i>공개
              </button>
              <button
                className="bulk-action-button"
                type="button"
                onClick={() => runBulkAction("HIDE")}
                disabled={isMutating}
              >
                <i className="fas fa-eye-slash" aria-hidden="true"></i>비공개
              </button>
              <button
                className="bulk-action-button"
                type="button"
                onClick={() => runBulkAction("ARCHIVE")}
                disabled={isMutating}
              >
                <i className="fas fa-box-archive" aria-hidden="true"></i>보관
              </button>
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
            <table className="article-table admin-v9-table admin-articles-table">
              <caption className="sr-only">아티클 목록 및 관리 작업</caption>
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

                  <th scope="col">아티클</th>
                  <th className="admin-source-col" scope="col">
                    출처 · 언어
                  </th>
                  <th className="admin-score-col" scope="col">
                    가치 점수
                  </th>
                  <th className="admin-view-col" scope="col">
                    조회수
                  </th>

                  <th className="admin-date-col" scope="col">
                    게시 · 수집
                  </th>
                  <th className="admin-stage-col" scope="col">
                    파이프라인 단계
                  </th>
                  <th className="admin-publish-col" scope="col">
                    공개 설정
                  </th>
                  <th className="admin-actions-col" scope="col">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !response ? (
                  <tr>
                    <td className="admin-empty-state" colSpan="9">
                      <i
                        className="fas fa-circle-notch fa-spin"
                        aria-hidden="true"
                      ></i>
                      <h3>전체 아티클을 불러오는 중입니다.</h3>
                    </td>
                  </tr>
                ) : !pageItems.length ? (
                  <tr>
                    <td className="admin-empty-state" colSpan="9">
                      <i className="fas fa-inbox" aria-hidden="true"></i>
                      <h3>조건에 맞는 항목이 없습니다.</h3>
                      <p>검색어 또는 필터를 변경해 보세요.</p>
                    </td>
                  </tr>
                ) : (
                  pageItems.map((article) => {
                    return (
                      <tr
                        key={article.articleId}
                        className={
                          selected[article.articleId] ? "is-selected" : ""
                        }
                      >
                        <td className="selection-column">
                          <input
                            className="selection-checkbox"
                            type="checkbox"
                            checked={Boolean(selected[article.articleId])}
                            onChange={() => toggleRecord(article)}
                            aria-label={`${article.title} 선택`}
                          />
                        </td>
                        <td className="admin-article-cell">
                          <span className="admin-article-id">
                            {article.articleId}
                          </span>
                          <p className="admin-article-title">
                            {article.title || "제목 없음"}
                          </p>

                          <ArticleTags tags={article.tags} />
                        </td>
                        <td className="admin-source-cell">
                          <strong>
                            {article.source?.name ||
                              article.source?.domain ||
                              "—"}
                          </strong>
                          <span className="source-language">
                            <i
                              className="fas fa-language"
                              aria-hidden="true"
                            ></i>
                            {sourceLanguage(article)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-score ${scoreTone(article)}`}
                            title={scoreToneLabel(article)}
                          >
                            {article.valueScore ?? article.score ?? "—"}
                          </span>
                        </td>
                        <td className="admin-view-cell">
                          <ViewCountCell counts={article.viewCounts} />
                        </td>
                        <td className="admin-date-cell">
                          <span>원문 게시</span>
                          <strong>
                            {shortDate(article.originalPublishedAt)}
                          </strong>
                          <span>수집 완료</span>
                          <strong>
                            {shortDate(
                              article.crawledAt || article.collectedAt,
                            )}
                          </strong>
                        </td>
                        <td>
                          <StageBadge article={article} />
                        </td>
                        <td>
                          <PublishControl
                            article={article}
                            isMutating={isMutating}
                            onToggle={runSingleAction}
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="row-action"
                              type="button"
                              onClick={() => openDetail(article.articleId)}
                            >
                              <i
                                className="fas fa-circle-info"
                                aria-hidden="true"
                              ></i>
                              상세
                            </button>
                            {article.publicationStatus !== "ARCHIVED" && (
                              <button
                                className="row-action"
                                type="button"
                                onClick={() =>
                                  runSingleAction(article, "ARCHIVE")
                                }
                                disabled={isMutating}
                              >
                                <i
                                  className="fas fa-box-archive"
                                  aria-hidden="true"
                                ></i>
                                보관
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="article-card-list">
          {pageItems.map((article) => {
            const published = article.publicationStatus === "PUBLISHED";
            return (
              <article
                className={`admin-mobile-card ${selected[article.articleId] ? "is-selected" : ""}`}
                key={article.articleId}
              >
                <div className="admin-mobile-card-heading">
                  <div>
                    <span className="admin-article-id">
                      {article.articleId}
                    </span>
                    <h3>{article.title || "제목 없음"}</h3>
                  </div>
                  <input
                    className="selection-checkbox"
                    type="checkbox"
                    checked={Boolean(selected[article.articleId])}
                    onChange={() => toggleRecord(article)}
                    aria-label={`${article.title} 선택`}
                  />
                </div>
                <StageBadge article={article} withHint />
                <div className="admin-mobile-meta">
                  <span>
                    출처<strong>{article.source?.name || "—"}</strong>
                  </span>
                  <span>
                    원문 언어<strong>{sourceLanguage(article)}</strong>
                  </span>
                  <span>
                    가치 점수
                    <strong>
                      {article.valueScore ?? article.score ?? "—"}점
                    </strong>
                  </span>
                  <span>
                    공개 상태
                    <strong>
                      {published
                        ? "공개"
                        : article.publicationStatus === "ARCHIVED"
                          ? "보관"
                          : "비공개"}
                    </strong>
                  </span>
                </div>
                <div className="admin-mobile-controls">
                  <PublishControl
                    article={article}
                    isMutating={isMutating}
                    onToggle={runSingleAction}
                  />
                  <div className="row-actions">
                    <button
                      className="row-action"
                      type="button"
                      onClick={() => openDetail(article.articleId)}
                    >
                      상세
                    </button>
                    {article.publicationStatus !== "ARCHIVED" && (
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => runSingleAction(article, "ARCHIVE")}
                      >
                        보관
                      </button>
                    )}
                  </div>
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
              aria-label="이전 페이지"
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
              aria-label="다음 페이지"
            >
              <i className="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </nav>
        )}
      </section>

      <dialog
        ref={detailDialogRef}
        className="admin-dialog admin-dialog-wide"
        aria-labelledby="adminArticleDetailTitle"
        onClose={() => setDetail(null)}
      >
        <div className="dialog-panel">
          <header className="dialog-header">
            <div>
              <h2 id="adminArticleDetailTitle">아티클 상세 정보</h2>
            </div>
            <button
              className="dialog-close-button"
              type="button"
              onClick={() => setDetail(null)}
              aria-label="상세 정보 닫기"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </header>
          <div className="detail-dialog-content">
            {detailLoading ? (
              <p className="admin-boot-state">
                <i
                  className="fas fa-circle-notch fa-spin"
                  aria-hidden="true"
                ></i>
                상세 정보를 불러오는 중입니다.
              </p>
            ) : (
              detail && (
                <article className="admin-detail-record">
                  <span className="admin-article-id">{detail.articleId}</span>
                  <h3 className="admin-detail-title">{detail.title}</h3>
                  <div className="admin-detail-meta">
                    <StageBadge article={detail} />
                  </div>
                  {hasStateMismatch(detail) && (
                    <p className="admin-detail-mismatch" role="status">
                      <i className="fas fa-circle-info" aria-hidden="true"></i>
                      아래 검토 상태 &ldquo;검토 승인&rdquo;은 공개 처리
                      과정에서 잘못 올라간 값입니다. 실제 승인 이력은 없습니다.
                      표시에만 영향이 있고 처리 단계와 공개 여부는 정상입니다.
                    </p>
                  )}
                  <section className="admin-detail-section">
                    <h4>상태 세부</h4>
                    <div className="admin-detail-axes">
                      <div>
                        <span>처리 상태</span>
                        <StatusBadge status={detail.processingStatus} />
                      </div>
                      <div>
                        <span>검토 상태</span>
                        <StatusBadge status={detail.reviewStatus} />
                      </div>
                      <div>
                        <span>공개 상태</span>
                        <StatusBadge status={detail.publicationStatus} />
                      </div>
                    </div>
                  </section>
                  <section className="admin-detail-section">
                    <h4>조회수</h4>

                    <div className="admin-detail-grid">
                      <DetailFact
                        label="전체 조회"
                        value={`${
                          (detail.viewCounts?.member ?? 0) +
                          (detail.viewCounts?.guest ?? 0)
                        }회`}
                      />
                      <DetailFact
                        label="회원 조회"
                        value={`${detail.viewCounts?.member ?? 0}회`}
                      />
                      <DetailFact
                        label="비회원 조회"
                        value={`${detail.viewCounts?.guest ?? 0}회 · 로그인 없이 상세 열람`}
                      />
                      <DetailFact
                        label="마지막 조회"
                        value={
                          detail.viewCounts?.lastViewedAt
                            ? fullDate(detail.viewCounts.lastViewedAt)
                            : "기록 없음"
                        }
                      />
                    </div>
                  </section>
                  <QualityEvaluationPanel
                    evaluation={detail.evaluation}
                    fallbackScore={detail.valueScore ?? detail.score}
                    extraFacts={
                      <div className="admin-detail-grid">
                        <DetailFact
                          label="정규화"
                          value={
                            detail.normalizedAt
                              ? `완료 ${fullDate(detail.normalizedAt)}`
                              : "정규화 기록 없음"
                          }
                        />
                        <DetailFact
                          label="정규화 버전"
                          value={detail.normalizerVersion}
                        />
                      </div>
                    }
                  />
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
                  <section className="admin-detail-section">
                    <h4>분야 태그</h4>
                    <ArticleTags tags={detail.tags} />
                  </section>
                  <section className="admin-detail-section">
                    <h4>원문 및 처리 정보</h4>
                    <div className="admin-detail-grid">
                      <DetailFact
                        label="아티클 ID"
                        value={detail.articleId}
                        mono
                      />
                      <DetailFact
                        label="최신 수집 항목 ID"
                        value={detail.latestCrawlItemId}
                        mono
                      />
                      <DetailFact
                        label="레코드 버전"
                        value={`v${detail.recordVersion ?? "—"}`}
                      />
                      <DetailFact
                        label="소스 ID"
                        value={detail.source?.id}
                        mono
                      />
                      <DetailFact
                        label="수집 방식"
                        value={detail.source?.type}
                      />
                      <DetailFact
                        label="원본 경로"
                        value={detail.source?.path}
                        mono
                      />
                      <DetailFact
                        label="원문 언어"
                        value={sourceLanguage(detail)}
                      />
                      <DetailFact
                        label="원문 게시일"
                        value={fullDate(detail.originalPublishedAt)}
                      />
                      <DetailFact
                        label="수집 완료"
                        value={fullDate(detail.crawledAt || detail.collectedAt)}
                      />
                    </div>
                    {detail.source?.articleUrl && (
                      <div className="canonical-url-block">
                        <span>Canonical URL</span>
                        <a
                          href={detail.source.articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {detail.source.articleUrl}
                          <i
                            className="fas fa-arrow-up-right-from-square"
                            aria-hidden="true"
                          ></i>
                        </a>
                      </div>
                    )}
                  </section>
                </article>
              )
            )}
          </div>
          <footer className="admin-dialog-actions">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setDetail(null)}
            >
              닫기
            </button>
            {pendingQualityReview(detail) && (
              <>
                <button
                  className="btn-danger"
                  type="button"
                  onClick={() => resolvePendingQualityReview(detail, "REJECT")}
                  disabled={isMutating}
                >
                  품질 탈락
                </button>
                <button
                  className="btn-success"
                  type="button"
                  onClick={() => resolvePendingQualityReview(detail, "APPROVE")}
                  disabled={isMutating}
                >
                  <i className="fas fa-check" aria-hidden="true"></i>품질 통과
                </button>
              </>
            )}
            {resolveStage(detail) === "QUALITY_REJECTED" && (
              <button
                className="btn-success"
                type="button"
                onClick={() => runReprocessing(detail, "APPROVE_QUALITY")}
                disabled={isMutating}
              >
                <i className="fas fa-check" aria-hidden="true"></i>품질 통과
              </button>
            )}
            {canRetryProcessing(detail) && (
              <button
                className="btn-success"
                type="button"
                onClick={() => runReprocessing(detail, "RETRY")}
                disabled={isMutating}
              >
                <i className="fas fa-rotate-right" aria-hidden="true"></i>
                재처리
              </button>
            )}
            {detail?.source?.articleUrl && (
              <a
                className="btn-primary dialog-link-button"
                href={detail.source.articleUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i
                  className="fas fa-arrow-up-right-from-square"
                  aria-hidden="true"
                ></i>
                원문 보기
              </a>
            )}
          </footer>
        </div>
      </dialog>

      {confirmDialog}

      {notice && (
        <div className="toast" role="status" aria-live="polite">
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

export default AdminTechArticles;
