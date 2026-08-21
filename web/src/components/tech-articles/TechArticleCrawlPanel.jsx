// src/components/tech-articles/TechArticleCrawlPanel.jsx
//
// 기술 아티클의 비동기 수집 실행 패널입니다.
// 별도 관리자 화면이 아니라 "전체 아티클" 화면의 하위 섹션으로 동작합니다.
// 서버가 허용한 소스와 옵션만 선택할 수 있으며, 임의 URL 입력은 제공하지 않습니다.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCrawlRun,
  getCrawlSources,
  startCrawlRun,
  techArticleErrorMessage,
} from "../../api/techArticles";

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "FAILED",
]);

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
  const normalized = String(status || "").toLowerCase();
  const tone =
    normalized === "completed"
      ? "published"
      : normalized === "failed"
        ? "hidden"
        : "processing";
  return (
    <span className={`status-badge status-${tone}`}>{status || "확인 중"}</span>
  );
}

function TechArticleCrawlPanel() {
  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [capabilityIndex, setCapabilityIndex] = useState(0);
  const [options, setOptions] = useState({});
  const [run, setRun] = useState(null);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
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

  useEffect(() => {
    const crawlRunId = run?.crawlRunId;
    if (!crawlRunId || TERMINAL_STATUSES.has(run.status)) return undefined;
    const timer = window.setInterval(() => refreshRun(crawlRunId, true), 3000);
    return () => window.clearInterval(timer);
  }, [refreshRun, run?.crawlRunId, run?.status]);

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

  const statistics =
    run?.statistics || run?.job?.result?.completion?.statistics;

  return (
    <>
      {isLoadingSources ? (
        <section className="widget-card crawl-loading-v9">
          <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <p>허용된 수집 소스를 불러오는 중입니다.</p>
        </section>
      ) : (
        <div className="crawl-layout-v9">
          <form className="widget-card crawl-card-v9" onSubmit={submit}>
            <div className="section-heading-row">
              <div>
                <p className="section-eyebrow orbitron">NEW CRAWL RUN</p>
                <h3>새 수집 실행</h3>
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
                  <label htmlFor="maximumAgeHours">최대 원문 나이 (시간)</label>
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
                  <label htmlFor="requestTimeoutMs">요청 제한 시간 (ms)</label>
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

          <aside className="widget-card crawl-card-v9 crawl-status-v9">
            <div className="section-heading-row">
              <div>
                <p className="section-eyebrow orbitron">RUN STATUS</p>
                <h3>최근 실행 상태</h3>
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
                <p>수집을 시작하면 실행 ID와 진행 상태가 여기에 표시됩니다.</p>
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
                    <dd>{run.sourceId || sourceId}</dd>
                  </div>
                  <div>
                    <dt>시도 횟수</dt>
                    <dd>
                      {run.job?.attemptCount ?? "—"} /{" "}
                      {run.job?.maxAttempts ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>수집 항목</dt>
                    <dd>{run.items?.length ?? "—"}</dd>
                  </div>
                </dl>
                {statistics && (
                  <div className="crawl-statistics-v9">
                    <h4>수집 통계</h4>
                    {Object.entries(statistics).map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>{String(value)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {run.error && (
                  <pre className="crawl-error-v9">
                    {JSON.stringify(run.error, null, 2)}
                  </pre>
                )}
                {!TERMINAL_STATUSES.has(run.status) && (
                  <p className="crawl-refresh-v9">
                    <i
                      className="fas fa-circle-notch fa-spin"
                      aria-hidden="true"
                    ></i>
                    3초마다 상태를 확인하고 있습니다.
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      {/* 부모 화면이 떠 있는 toast 를 쓰므로 겹치지 않게 패널 안쪽 알림 */}
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
