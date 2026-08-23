// src/components/tech-articles/TechArticleCrawlPanel.jsx
//
// 기술 아티클의 비동기 수집 실행 패널입니다.
// 별도 "크롤링 관리" 화면에서 수동 실행과 전체 실행 이력을 함께 관리합니다.
// 서버가 허용한 소스와 옵션만 선택할 수 있으며, 임의 URL 입력은 제공하지 않습니다.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCrawlRun,
  getCrawlRuns,
  getCrawlSources,
  startCrawlRun,
  techArticleErrorMessage,
} from "../../api/techArticles";

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "FAILED",
]);
const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING", "RETRY"]);
const RUNS_PAGE_SIZE = 20;
const STATUS_META = {
  QUEUED: { label: "실행 대기", tone: "processing" },
  RUNNING: { label: "실행 중", tone: "processing" },
  RETRY: { label: "재시도 대기", tone: "pending" },
  COMPLETED: { label: "완료", tone: "published" },
  PARTIALLY_COMPLETED: { label: "일부 성공", tone: "pending" },
  FAILED: { label: "실패", tone: "failed" },
};
const OFFICIAL_STATISTICS = [
  ["pagesVisited", "방문 페이지"],
  ["articlesDiscovered", "발견"],
  ["articlesExcludedByAge", "기간 제외"],
  ["articlesAttempted", "처리 시도"],
  ["articlesSucceeded", "수집 성공"],
  ["articlesFailed", "수집 실패"],
];

function optionDefaults(source) {
  return Object.fromEntries(
    Object.entries(source?.crawlOptions || {}).map(([key, contract]) => [
      key,
      contract.default,
    ]),
  );
}

function makeIdempotencyKey() {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `tech-article-crawl-${suffix}`;
}

function RunStatus({ status }) {
  const meta = STATUS_META[status] || {
    label: status || "확인 중",
    tone: "processing",
  };
  return (
    <span className={`status-badge status-${meta.tone}`}>{meta.label}</span>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function runDuration(run) {
  if (!run?.startedAt) return "—";
  const start = new Date(run.startedAt);
  const terminalFallback = TERMINAL_STATUSES.has(run.status)
    ? run.updatedAt
    : Date.now();
  const end = new Date(run?.completedAt || terminalFallback);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const seconds = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}분 ${seconds % 60}초`
    : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

function finalStatistics(run) {
  return run?.statistics || null;
}

function executionStateText(run) {
  if (run?.status === "QUEUED") return "작업자 배정 대기";
  if (run?.status === "RUNNING") return "실행 중 · 결과 집계 전";
  if (run?.status === "RETRY") {
    const attempt = run?.job?.attemptCount;
    const maximum = run?.job?.maxAttempts;
    return Number.isInteger(attempt) && Number.isInteger(maximum)
      ? `재시도 대기 · ${attempt} / ${maximum}`
      : "재시도 대기";
  }
  return STATUS_META[run?.status]?.label || "상태 확인 중";
}

function resultText(run) {
  if (run?.status === "QUEUED") return "실행 전";
  if (run?.status === "RUNNING") return "결과 집계 전";
  if (run?.status === "RETRY") return "재시도 후 확정";
  if (run?.status === "FAILED") return "실행 실패";

  const statistics = finalStatistics(run);
  const succeeded = statistics?.articlesSucceeded;
  const failed = statistics?.articlesFailed;
  if (Number.isInteger(succeeded) && Number.isInteger(failed) && failed > 0) {
    return `${succeeded}건 성공 · ${failed}건 실패`;
  }
  if (Number.isInteger(succeeded)) return `${succeeded}건 성공`;
  return `${run?.itemCount ?? run?.items?.length ?? 0}건 저장`;
}

function resultDescription(run) {
  if (ACTIVE_STATUSES.has(run?.status)) return "종료 후 최종 통계 제공";
  return `저장된 수집 항목 ${run?.itemCount ?? run?.items?.length ?? 0}건`;
}

function TechArticleCrawlPanel() {
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [capabilityIndex, setCapabilityIndex] = useState(0);
  const [options, setOptions] = useState({});
  const [run, setRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsPagination, setRunsPagination] = useState(null);
  const [runsPage, setRunsPage] = useState(1);
  const [runFilters, setRunFilters] = useState({
    status: "",
    sourceId: "",
    trigger: "",
  });
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  const currentSource = useMemo(
    () => sources.find((source) => source.sourceId === sourceId),
    [sourceId, sources],
  );
  const capability =
    currentSource?.capabilities?.[capabilityIndex] ||
    currentSource?.capabilities?.[0];
  const optionContract = currentSource?.crawlOptions || {};
  const canFollowPagination =
    sourceId === "infoq" &&
    Boolean(optionContract.followPagination) &&
    capability?.sourceType === "WEB_CRAWL";
  const hasActiveRuns = runs.some((item) => ACTIVE_STATUSES.has(item.status));
  const pollingInterval = hasActiveRuns ? 3000 : 15000;

  useEffect(() => {
    let active = true;
    setIsLoadingSources(true);
    getCrawlSources()
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setSources(items);
        if (items[0]) setSourceId(items[0].sourceId);
      })
      .catch((error) => {
        if (active)
          setNotice({
            type: "error",
            message: techArticleErrorMessage(
              error,
              "수집 소스 목록을 불러오지 못했습니다.",
            ),
          });
      })
      .finally(() => {
        if (active) setIsLoadingSources(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadRuns = useCallback(
    async (quiet = false) => {
      if (!quiet) setIsLoadingRuns(true);
      try {
        const data = await getCrawlRuns({
          page: runsPage,
          pageSize: RUNS_PAGE_SIZE,
          status: runFilters.status || undefined,
          sourceId: runFilters.sourceId || undefined,
          trigger: runFilters.trigger || undefined,
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        const totalPages = Math.max(
          1,
          Number(data?.pagination?.totalPages) || 1,
        );
        if (runsPage > totalPages) {
          setRunsPage(totalPages);
          return;
        }
        setRuns(items);
        setRunsPagination(data?.pagination || null);
        setRun((current) => {
          if (!current) return items[0] || null;
          const updated = items.find(
            (item) => item.crawlRunId === current.crawlRunId,
          );
          return updated
            ? { ...current, ...updated, items: current.items }
            : items[0] || null;
        });
      } catch (error) {
        if (!quiet) {
          setNotice({
            type: "error",
            message: techArticleErrorMessage(
              error,
              "크롤링 실행 이력을 불러오지 못했습니다.",
            ),
          });
        }
      } finally {
        if (!quiet) setIsLoadingRuns(false);
      }
    },
    [runFilters.sourceId, runFilters.status, runFilters.trigger, runsPage],
  );

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    let stopped = false;
    let requestInFlight = false;
    let timer;
    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState !== "hidden";
    const schedule = () => {
      if (!stopped && isVisible()) {
        timer = window.setTimeout(poll, pollingInterval);
      }
    };
    const poll = async () => {
      if (stopped || requestInFlight || !isVisible()) return;
      requestInFlight = true;
      try {
        await loadRuns(true);
      } finally {
        requestInFlight = false;
        schedule();
      }
    };
    const handleVisibilityChange = () => {
      window.clearTimeout(timer);
      if (isVisible() && !requestInFlight) void poll();
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRuns, pollingInterval]);

  useEffect(() => {
    if (!currentSource) return;
    setCapabilityIndex(0);
    setOptions(optionDefaults(currentSource));
    setIdempotencyKey("");
  }, [currentSource]);

  useEffect(() => {
    if (!canFollowPagination && options.followPagination) {
      setOptions((current) => ({ ...current, followPagination: false }));
    }
    setIdempotencyKey("");
  }, [canFollowPagination, capabilityIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const refreshRun = useCallback(async (crawlRunId, quiet = false) => {
    if (!crawlRunId) return;
    if (!quiet) setIsRefreshing(true);
    try {
      setRun(await getCrawlRun(crawlRunId));
    } catch (error) {
      setNotice({
        type: "error",
        message: techArticleErrorMessage(
          error,
          "수집 실행 상태를 조회하지 못했습니다.",
        ),
      });
    } finally {
      if (!quiet) setIsRefreshing(false);
    }
  }, []);

  const updateOption = (key, value) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setIdempotencyKey("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!currentSource || !capability) return;
    const key = idempotencyKey || makeIdempotencyKey();
    setIdempotencyKey(key);
    setIsSubmitting(true);
    setNotice(null);
    try {
      const crawlOptions = Object.fromEntries(
        Object.entries(optionContract).map(([key, contract]) => {
          const value = options[key];
          if (typeof contract.default === "boolean") {
            return [
              key,
              key === "followPagination" && !canFollowPagination
                ? false
                : Boolean(value),
            ];
          }
          return [key, Number(value)];
        }),
      );
      const accepted = await startCrawlRun(
        {
          source: {
            sourceId,
            sourceType: capability.sourceType,
            sectionKey: capability.sectionKey,
          },
          crawlOptions,
        },
        key,
      );
      setRun(accepted);
      setRunFilters({ status: "", sourceId: "", trigger: "" });
      setRunsPage(1);
      setNotice({
        type: "success",
        message:
          "수집 실행을 요청했습니다. 완료될 때까지 상태를 자동으로 갱신합니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: `${techArticleErrorMessage(error, "수집 실행을 요청하지 못했습니다.")} 같은 요청을 재시도하면 동일한 멱등성 키를 사용합니다.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statistics = finalStatistics(run);
  const visibleStatistics = OFFICIAL_STATISTICS.filter(([key]) =>
    Object.prototype.hasOwnProperty.call(statistics || {}, key),
  );

  const selectRun = (selected) => {
    setRun(selected);
    refreshRun(selected.crawlRunId, true);
  };

  const updateRunFilter = (key, value) => {
    setRun(null);
    setRunFilters((current) => ({ ...current, [key]: value }));
    setRunsPage(1);
  };

  const operations = (
    <>
      {isLoadingSources ? (
        <section className="widget-card crawl-loading-v9">
          <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <p>허용된 수집 소스를 불러오는 중입니다.</p>
        </section>
      ) : (
        <div
          className={`crawl-layout-v9 ${isRunnerOpen ? "" : "is-detail-only"}`}
        >
          {isRunnerOpen && (
            <form
              id="asyncCrawlRunner"
              className="widget-card crawl-card-v9"
              onSubmit={submit}
            >
              <div className="section-heading-row">
                <div>
                  <p className="section-eyebrow orbitron">ASYNC CRAWL RUN</p>
                  <h3>비동기 수집 실행</h3>
                </div>
                <span className="policy-scope-badge">임의 URL 입력 없음</span>
              </div>

              <div className="form-field crawl-field-v9">
                <label htmlFor="crawlSource">수집 소스</label>
                <select
                  id="crawlSource"
                  className="form-input"
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                >
                  {sources.map((source) => (
                    <option value={source.sourceId} key={source.sourceId}>
                      {source.name} · {source.domain}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="crawl-capabilities-v9">
                <legend>허용된 수집 방식</legend>
                <div>
                  {currentSource?.capabilities?.map((item, index) => (
                    <label key={`${item.sourceType}-${item.sectionKey}`}>
                      <input
                        type="radio"
                        name="capability"
                        checked={capabilityIndex === index}
                        onChange={() => setCapabilityIndex(index)}
                      />
                      <span>
                        <strong>{item.sourceType}</strong>
                        <small>{item.sectionKey}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="crawl-options-v9">
                {optionContract.maximumArticleCount && (
                  <div className="form-field">
                    <label htmlFor="maximumArticleCount">최대 아티클 수</label>
                    <input
                      id="maximumArticleCount"
                      className="form-input"
                      type="number"
                      required
                      min={optionContract.maximumArticleCount.minimum ?? 1}
                      max={optionContract.maximumArticleCount.maximum ?? 100}
                      value={options.maximumArticleCount ?? ""}
                      onChange={(event) =>
                        updateOption("maximumArticleCount", event.target.value)
                      }
                    />
                  </div>
                )}
                {optionContract.maximumAgeHours && (
                  <div className="form-field">
                    <label htmlFor="maximumAgeHours">
                      최대 원문 나이 (시간)
                    </label>
                    <input
                      id="maximumAgeHours"
                      className="form-input"
                      type="number"
                      required
                      min={optionContract.maximumAgeHours.minimum ?? 1}
                      value={options.maximumAgeHours ?? ""}
                      onChange={(event) =>
                        updateOption("maximumAgeHours", event.target.value)
                      }
                    />
                  </div>
                )}
                {optionContract.maximumPageCount && (
                  <div className="form-field">
                    <label htmlFor="maximumPageCount">최대 페이지 수</label>
                    <input
                      id="maximumPageCount"
                      className="form-input"
                      type="number"
                      required
                      min={optionContract.maximumPageCount.minimum ?? 1}
                      max={optionContract.maximumPageCount.maximum ?? 10}
                      value={options.maximumPageCount ?? ""}
                      onChange={(event) =>
                        updateOption("maximumPageCount", event.target.value)
                      }
                    />
                  </div>
                )}
                {optionContract.requestTimeoutMs && (
                  <div className="form-field">
                    <label htmlFor="requestTimeoutMs">
                      요청 제한 시간 (ms)
                    </label>
                    <input
                      id="requestTimeoutMs"
                      className="form-input"
                      type="number"
                      required
                      step="1000"
                      min={optionContract.requestTimeoutMs.minimum ?? 1000}
                      max={optionContract.requestTimeoutMs.maximum ?? 60000}
                      value={options.requestTimeoutMs ?? ""}
                      onChange={(event) =>
                        updateOption("requestTimeoutMs", event.target.value)
                      }
                    />
                  </div>
                )}
              </div>

              {optionContract.followPagination && (
                <label
                  className={`crawl-follow-v9 ${canFollowPagination ? "" : "is-disabled"}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(options.followPagination)}
                    disabled={!canFollowPagination}
                    onChange={(event) =>
                      updateOption("followPagination", event.target.checked)
                    }
                  />
                  <span>
                    <strong>페이지네이션 따라가기</strong>
                    <small>
                      {canFollowPagination
                        ? "현재 WEB_CRAWL 방식에서 지원됩니다."
                        : "현재 소스·방식 조합에서는 사용할 수 없습니다."}
                    </small>
                  </span>
                </label>
              )}
              {idempotencyKey && (
                <p className="crawl-idempotency-v9">
                  <i className="fas fa-key" aria-hidden="true"></i>재시도 키{" "}
                  <code>{idempotencyKey}</code>
                </p>
              )}
              <button
                className="btn-primary crawl-submit-v9"
                type="submit"
                disabled={isSubmitting || !capability}
              >
                {isSubmitting ? (
                  <>
                    <i
                      className="fas fa-circle-notch fa-spin"
                      aria-hidden="true"
                    ></i>
                    요청 중
                  </>
                ) : (
                  <>
                    <i className="fas fa-play" aria-hidden="true"></i>수집 시작
                  </>
                )}
              </button>
            </form>
          )}

          <aside className="widget-card crawl-card-v9 crawl-status-v9">
            <div className="section-heading-row">
              <div>
                <p className="section-eyebrow orbitron">RUN STATUS</p>
                <h3>선택 실행 상세</h3>
              </div>
              {run?.crawlRunId && (
                <button
                  className="btn-secondary btn-small"
                  type="button"
                  onClick={() => refreshRun(run.crawlRunId)}
                  disabled={isRefreshing}
                  aria-label="실행 상태 새로고침"
                >
                  <i
                    className={`fas fa-rotate ${isRefreshing ? "fa-spin" : ""}`}
                    aria-hidden="true"
                  ></i>
                </button>
              )}
            </div>
            {!run ? (
              <div className="crawl-empty-v9">
                <i className="fas fa-satellite-dish" aria-hidden="true"></i>
                <p>
                  실행 이력에서 항목을 선택하면 실행 ID와 서버 상태가 여기에
                  표시됩니다.
                </p>
              </div>
            ) : (
              <>
                <div className="crawl-run-heading-v9">
                  <RunStatus status={run.status} />
                  <small>job {run.jobStatus || run.job?.status || "—"}</small>
                </div>
                <dl className="crawl-run-facts-v9">
                  <div>
                    <dt>실행 ID</dt>
                    <dd>{run.crawlRunId}</dd>
                  </div>
                  <div>
                    <dt>소스</dt>
                    <dd>
                      {run.sourceId || sourceId}
                      {run.sourceType ? ` · ${run.sourceType}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>실행 구분</dt>
                    <dd>{run.trigger === "SCHEDULED" ? "자동" : "수동"}</dd>
                  </div>
                  <div>
                    <dt>실행 상태</dt>
                    <dd>{executionStateText(run)}</dd>
                  </div>
                  <div>
                    <dt>시도 횟수</dt>
                    <dd>
                      {run.job?.attemptCount ?? "—"} /{" "}
                      {run.job?.maxAttempts ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>저장 결과</dt>
                    <dd>
                      {ACTIVE_STATUSES.has(run.status)
                        ? "종료 후 확정"
                        : `${run.itemCount ?? run.items?.length ?? 0}건`}
                    </dd>
                  </div>
                  <div>
                    <dt>요청 시각</dt>
                    <dd>{formatDate(run.requestedAt || run.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>시작 시각</dt>
                    <dd>{formatDate(run.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>종료 시각</dt>
                    <dd>{formatDate(run.completedAt)}</dd>
                  </div>
                  <div>
                    <dt>소요 시간</dt>
                    <dd>{run.startedAt ? runDuration(run) : "—"}</dd>
                  </div>
                </dl>
                {visibleStatistics.length > 0 && (
                  <div className="crawl-statistics-v9">
                    <h4>최종 수집 통계</h4>
                    {visibleStatistics.map(([key, label]) => (
                      <div key={key}>
                        <span>{label}</span>
                        <strong>{String(statistics[key])}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {run.error && (
                  <div className="crawl-error-v9">
                    <strong>실행 오류</strong>
                    <p>
                      {run.error.message ||
                        run.job?.error?.message ||
                        "수집 실행 중 오류가 발생했습니다."}
                    </p>
                    <details>
                      <summary>기술 정보 보기</summary>
                      <pre>{JSON.stringify(run.error, null, 2)}</pre>
                    </details>
                  </div>
                )}
                {!TERMINAL_STATUSES.has(run.status) && (
                  <p className="crawl-refresh-v9">
                    <i
                      className="fas fa-circle-notch fa-spin"
                      aria-hidden="true"
                    ></i>
                    3초마다 실행 상태를 확인합니다. 수집 통계는 종료 후
                    확정됩니다.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );

  return (
    <>
      <section
        className="widget-card crawl-history-v9"
        aria-labelledby="crawlHistoryTitle"
      >
        <div className="section-heading-row crawl-history-heading-v9">
          <div>
            <p className="section-eyebrow orbitron">RUN HISTORY</p>
            <div className="crawl-history-title-v9">
              <h3 id="crawlHistoryTitle">크롤링 실행 이력</h3>
              <span
                className="crawl-history-total-v9"
                aria-label={`크롤링 실행 이력 총 ${runsPagination?.totalCount ?? runs.length}건`}
              >
                총 <strong>{runsPagination?.totalCount ?? runs.length}</strong>
                건
              </span>
            </div>
            <p className="crawl-history-contract-v9">
              실행 중에는 서버 상태만 제공되며 수집 건수는 종료 후 집계됩니다.
            </p>
          </div>
          <button
            className="btn-secondary btn-small"
            type="button"
            onClick={() => loadRuns()}
            disabled={isLoadingRuns}
          >
            <i
              className={`fas fa-rotate ${isLoadingRuns ? "fa-spin" : ""}`}
              aria-hidden="true"
            ></i>
            새로고침
          </button>
        </div>

        <div className="crawl-history-filters-v9" aria-label="실행 이력 필터">
          <select
            className="form-input"
            aria-label="실행 상태 필터"
            value={runFilters.status}
            onChange={(event) => updateRunFilter("status", event.target.value)}
          >
            <option value="">모든 실행 상태</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <select
            className="form-input"
            aria-label="수집 소스 필터"
            value={runFilters.sourceId}
            onChange={(event) =>
              updateRunFilter("sourceId", event.target.value)
            }
          >
            <option value="">모든 수집 소스</option>
            {sources.map((source) => (
              <option key={source.sourceId} value={source.sourceId}>
                {source.name}
              </option>
            ))}
          </select>
          <select
            className="form-input"
            aria-label="실행 구분 필터"
            value={runFilters.trigger}
            onChange={(event) => updateRunFilter("trigger", event.target.value)}
          >
            <option value="">수동 + 자동</option>
            <option value="MANUAL">수동 실행</option>
            <option value="SCHEDULED">자동 실행</option>
          </select>
        </div>

        {isLoadingRuns && runs.length === 0 ? (
          <div className="crawl-history-empty-v9">
            <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            실행 이력을 불러오는 중입니다.
          </div>
        ) : runs.length === 0 ? (
          <div className="crawl-history-empty-v9">
            <i className="fas fa-clock-rotate-left" aria-hidden="true"></i>
            조건에 맞는 크롤링 실행이 없습니다.
          </div>
        ) : (
          <div className="crawl-history-table-wrap-v9">
            <table className="crawl-history-table-v9">
              <thead>
                <tr>
                  <th scope="col">상태</th>
                  <th scope="col">소스·방식</th>
                  <th scope="col">실행 구분</th>
                  <th scope="col">결과</th>
                  <th scope="col">요청 시각</th>
                  <th scope="col">소요 시간</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((item) => (
                  <tr
                    key={item.crawlRunId}
                    className={
                      run?.crawlRunId === item.crawlRunId ? "is-selected" : ""
                    }
                    onClick={() => selectRun(item)}
                  >
                    <td>
                      <RunStatus status={item.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectRun(item);
                        }}
                      >
                        <strong>{item.sourceId}</strong>
                        <small>
                          {item.sourceType || "—"} · {item.sectionKey || "—"}
                        </small>
                      </button>
                    </td>
                    <td>{item.trigger === "SCHEDULED" ? "자동" : "수동"}</td>
                    <td>
                      <strong>{resultText(item)}</strong>
                      <small>{resultDescription(item)}</small>
                    </td>
                    <td>{formatDate(item.requestedAt || item.createdAt)}</td>
                    <td>{runDuration(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {runsPagination?.totalPages > 1 && (
          <div className="crawl-history-pagination-v9">
            <button
              className="btn-secondary btn-small"
              type="button"
              disabled={runsPage <= 1}
              onClick={() => setRunsPage(1)}
            >
              처음
            </button>
            <button
              className="btn-secondary btn-small"
              type="button"
              disabled={runsPage <= 1}
              onClick={() => setRunsPage((page) => Math.max(1, page - 1))}
            >
              이전
            </button>
            <span className="crawl-history-page-v9">
              <span>
                <strong>{runsPage}</strong> / {runsPagination.totalPages} 페이지
              </span>
              <small>페이지당 {RUNS_PAGE_SIZE}건</small>
            </span>
            <button
              className="btn-secondary btn-small"
              type="button"
              disabled={runsPage >= runsPagination.totalPages}
              onClick={() => setRunsPage((page) => page + 1)}
            >
              다음
            </button>
            <button
              className="btn-secondary btn-small"
              type="button"
              disabled={runsPage >= runsPagination.totalPages}
              onClick={() => setRunsPage(runsPagination.totalPages)}
            >
              마지막
            </button>
          </div>
        )}
      </section>

      <div className="crawl-runner-toggle-v9">
        <button
          className="btn-secondary"
          type="button"
          aria-expanded={isRunnerOpen}
          aria-controls="asyncCrawlRunner"
          onClick={() => setIsRunnerOpen((current) => !current)}
        >
          <i
            className={`fas ${isRunnerOpen ? "fa-chevron-up" : "fa-play"}`}
            aria-hidden="true"
          ></i>
          {isRunnerOpen ? "실행 설정 닫기" : "비동기 수집 실행"}
        </button>
      </div>

      {operations}

      {notice && (
        <p
          className={`crawl-panel-notice-v9 ${notice.type === "error" ? "is-error" : "is-success"}`}
          role="status"
        >
          <i
            className={`fas ${notice.type === "error" ? "fa-triangle-exclamation" : "fa-circle-check"}`}
            aria-hidden="true"
          ></i>
          {notice.message}
        </p>
      )}
    </>
  );
}

export default TechArticleCrawlPanel;
