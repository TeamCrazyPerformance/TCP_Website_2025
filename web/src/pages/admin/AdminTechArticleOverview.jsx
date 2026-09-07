import React, { useEffect, useState } from "react";
import {
  getAdminTechArticleOverview,
  techArticleErrorMessage,
} from "../../api/techArticles";
import AdminTechArticleContent from "../../components/tech-articles/AdminTechArticleContent";
import "../../styles/techArticlesOverview.css";

const RANGE_OPTIONS = [14, 30, 90];

function dateRange(days) {
  const format = (date) => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };
  const to = format(new Date());
  const fromDate = new Date(`${to}T00:00:00+09:00`);
  fromDate.setUTCDate(fromDate.getUTCDate() - days + 1);
  return { from: format(fromDate), to };
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let index = -1;
  do {
    size /= 1024;
    index += 1;
  } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function shortDay(value) {
  const [, month, day] = String(value).split("-");
  return month && day ? `${month}.${day}` : value;
}

function chartScale(daily) {
  const highestCount = Math.max(
    0,
    ...daily.flatMap((item) => [
      item.collectedCount || 0,
      item.processedCount || 0,
    ]),
  );
  const roughStep = Math.max(1, highestCount / 4);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const stepFactor =
    normalizedStep <= 1
      ? 1
      : normalizedStep <= 2
        ? 2
        : normalizedStep <= 5
          ? 5
          : 10;
  const step = Math.max(1, stepFactor * magnitude);
  const maximum = Math.max(step, Math.ceil(highestCount / step) * step);
  const ticks = Array.from(
    { length: Math.floor(maximum / step) + 1 },
    (_, index) => index * step,
  );

  return { maximum, ticks };
}

function VersionValue({ children }) {
  return <code>{children || "기록 없음"}</code>;
}

function AdminTechArticleOverview() {
  const [rangeDays, setRangeDays] = useState(14);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAdminTechArticleOverview(dateRange(rangeDays));
        if (active) setOverview(data);
      } catch (requestError) {
        if (active) {
          setError(
            techArticleErrorMessage(
              requestError,
              "Overview 정보를 불러오지 못했습니다.",
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [rangeDays]);

  const daily = overview?.statistics?.daily || [];
  const { maximum, ticks } = chartScale(daily);
  const storage = overview?.storage || {};
  const versions = overview?.moduleVersions || {};
  const keywords = overview?.qualityKeywords;
  const keywordAvailable = keywords?.status === "AVAILABLE";
  const keywordWarnings = Array.isArray(keywords?.warnings)
    ? keywords.warnings
    : [];

  return (
    <AdminTechArticleContent>
      <section className="admin-intro" aria-labelledby="techOverviewTitle">
        <div>
          <h2 id="techOverviewTitle" className="orbitron gradient-text">
            Tech Articles Pipeline Status
          </h2>
        </div>
      </section>

      {error && <p className="overview-error">{error}</p>}
      {loading && !overview ? (
        <section className="widget-card overview-loading" aria-live="polite">
          정보를 불러오는 중입니다.
        </section>
      ) : (
        <>
          <section className="overview-section" aria-labelledby="storageTitle">
            <div className="overview-section-heading">
              <div>
                <h3 id="storageTitle">Disk Usage</h3>
                <p>Tech Articles MySQL 스키마의 실제 할당량입니다.</p>
              </div>
              <time dateTime={storage.measuredAt || undefined}>
                측정 {formatDateTime(storage.measuredAt)}
              </time>
            </div>
            <div className="overview-storage-grid">
              <div className="overview-metric-card">
                <span>데이터</span>
                <strong>
                  {storage.available === false
                    ? "—"
                    : formatBytes(storage.dataBytes)}
                </strong>
              </div>
              <div className="overview-metric-card">
                <span>인덱스</span>
                <strong>
                  {storage.available === false
                    ? "—"
                    : formatBytes(storage.indexBytes)}
                </strong>
              </div>
              <div className="overview-metric-card">
                <span>합계</span>
                <strong>
                  {storage.available === false
                    ? "—"
                    : formatBytes(storage.totalBytes)}
                </strong>
              </div>
            </div>
            {storage.available === false && (
              <p className="overview-note">
                메모리 개발 모드에서는 MySQL 사용량을 측정하지 않습니다.
              </p>
            )}
          </section>

          <section className="overview-section" aria-labelledby="versionsTitle">
            <div className="overview-section-heading">
              <div>
                <h3 id="versionsTitle">Module Versions</h3>
                <p>
                  실행 모듈은 SemVer로 기록하며 모델명과 프롬프트 버전은
                  분리합니다.
                </p>
              </div>
            </div>
            <div className="overview-version-grid">
              <article className="overview-version-card overview-crawler-card">
                <h4>크롤링 모듈</h4>
                <div className="overview-version-list">
                  {(versions.crawlers || []).map((crawler) => (
                    <div key={crawler.sourceId}>
                      <span>{crawler.sourceName || crawler.sourceId}</span>
                      <VersionValue>{crawler.moduleVersion}</VersionValue>
                    </div>
                  ))}
                </div>
              </article>
              <article className="overview-version-card">
                <h4>품질 평가</h4>
                <dl>
                  <div>
                    <dt>모듈</dt>
                    <dd>
                      <VersionValue>
                        {versions.qualityEvaluator?.moduleVersion}
                      </VersionValue>
                    </dd>
                  </div>
                </dl>
              </article>
              <article className="overview-version-card">
                <h4>AI 요약</h4>
                <dl>
                  <div>
                    <dt>모듈</dt>
                    <dd>
                      <VersionValue>
                        {versions.aiSummarizer?.moduleVersion}
                      </VersionValue>
                    </dd>
                  </div>
                  <div>
                    <dt>모델</dt>
                    <dd>
                      <VersionValue>
                        {versions.aiSummarizer?.model}
                      </VersionValue>
                    </dd>
                  </div>
                  <div>
                    <dt>프롬프트</dt>
                    <dd>
                      <VersionValue>
                        {versions.aiSummarizer?.promptVersion}
                      </VersionValue>
                    </dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          <section className="overview-section" aria-labelledby="dailyTitle">
            <div className="overview-section-heading overview-chart-heading">
              <div>
                <h3 id="dailyTitle">일별 수집 및 처리 현황</h3>
                <p>
                  KST 기준 신규 등록 시각과 AI 요약 완료 시각을 각각 집계합니다.
                </p>
              </div>
              <div className="overview-range" aria-label="통계 기간">
                {RANGE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={rangeDays === days ? "is-active" : ""}
                    onClick={() => setRangeDays(days)}
                  >
                    {days}일
                  </button>
                ))}
              </div>
            </div>
            <div className="overview-legend" aria-hidden="true">
              <span>
                <i className="is-collected" />
                신규 수집·등록
              </span>
              <span>
                <i className="is-processed" />
                AI 요약 완료
              </span>
            </div>
            <div className="overview-chart-scroll">
              <div
                className="overview-chart"
                style={{ "--day-count": daily.length }}
              >
                <div className="overview-chart-plot">
                  <div className="overview-gridlines" aria-hidden="true">
                    {ticks.map((tick) => (
                      <span
                        key={tick}
                        style={{ bottom: `${(tick / maximum) * 100}%` }}
                      >
                        <b>{tick}</b>
                      </span>
                    ))}
                  </div>
                  {daily.map((item) => {
                    const collectedCount = item.collectedCount || 0;
                    const processedCount = item.processedCount || 0;
                    return (
                      <div className="overview-bars" key={item.date}>
                        <span
                          className="overview-bar-slot"
                          style={{
                            "--bar-height": `${(collectedCount / maximum) * 100}%`,
                          }}
                          title={`${item.date} 신규 수집·등록 ${collectedCount}개`}
                        >
                          {collectedCount > 0 && (
                            <strong>{collectedCount}</strong>
                          )}
                          <i className="overview-bar is-collected" />
                        </span>
                        <span
                          className="overview-bar-slot"
                          style={{
                            "--bar-height": `${(processedCount / maximum) * 100}%`,
                          }}
                          title={`${item.date} AI 요약 완료 ${processedCount}개`}
                        >
                          {processedCount > 0 && (
                            <strong>{processedCount}</strong>
                          )}
                          <i className="overview-bar is-processed" />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="overview-chart-labels">
                  {daily.map((item) => (
                    <time dateTime={item.date} key={item.date}>
                      {shortDay(item.date)}
                    </time>
                  ))}
                </div>
              </div>
            </div>
            <dl className="overview-definitions">
              {Object.entries(overview?.statistics?.definitions || {}).map(
                ([key, definition]) => (
                  <div key={key}>
                    <dt>{definition.label}</dt>
                    <dd>{definition.description}</dd>
                  </div>
                ),
              )}
            </dl>
          </section>
          <section
            className="overview-section"
            aria-labelledby="qualityKeywordsTitle"
          >
            <div className="overview-section-heading">
              <div>
                <h3 id="qualityKeywordsTitle">개발 관련성 평가 키워드</h3>
                <p>
                  현재 파이프라인 프로세스가 로드한 평가 키워드입니다. 모듈 로드
                  시 수집되며 기존 아티클 점수는 유지됩니다.
                </p>
              </div>
              <span
                className={`overview-keyword-status ${
                  keywordAvailable && keywordWarnings.length === 0
                    ? "is-available"
                    : "needs-attention"
                }`}
              >
                {keywordAvailable && keywordWarnings.length === 0
                  ? "정상"
                  : "확인 필요"}
              </span>
            </div>
            {keywordAvailable ? (
              <div className="overview-keywords">
                <p>
                  총 {keywords.totalCount}개 · 로드 시각{" "}
                  {formatDateTime(keywords.loadedAt)}
                </p>
                <p className="overview-keyword-fingerprint">
                  목록 식별값 <code>{keywords.fingerprint}</code>
                </p>
                {keywordWarnings.includes("DYNAMIC_KEYWORDS_EMPTY") && (
                  <p className="overview-keyword-warning" role="status">
                    동적 키워드가 비어 있습니다. 외부 키워드 수집 상태를 확인해
                    주세요.
                  </p>
                )}
                {[
                  ["기본 키워드", keywords.coreKeywords || []],
                  ["동적 키워드", keywords.dynamicKeywords || []],
                ].map(([label, words]) => (
                  <details key={label}>
                    <summary>
                      {label} · {words.length}개
                    </summary>
                    {words.length ? (
                      <ul>
                        {words.map((word) => (
                          <li key={word}>{word}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>현재 적용된 키워드가 없습니다.</p>
                    )}
                  </details>
                ))}
              </div>
            ) : (
              <p className="overview-keyword-warning" role="status">
                실행 중인 평가기의 키워드 상태를 확인할 수 없습니다.
              </p>
            )}
          </section>
        </>
      )}
    </AdminTechArticleContent>
  );
}

export default AdminTechArticleOverview;
