import React from "react";
import {
  scoreTone,
  scoreToneLabel,
  statusLabel,
  statusTone,
} from "./techArticleStatus";

const SIGNAL_LABEL = {
  contentLength: ["본문 길이", (v) => `${Number(v).toLocaleString()}자`],
  language: ["언어", (v) => String(v)],
  contentComplete: ["본문 수집", (v) => (v ? "완전" : "불완전")],
  spamSuspected: ["스팸 의심", (v) => (v ? "있음" : "없음")],
  advertisementSuspected: ["광고 의심", (v) => (v ? "있음" : "없음")],
};

const ADVERSE_WHEN_TRUE = ["spamSuspected", "advertisementSuspected"];

const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function scoreAxes(score) {
  return Array.isArray(score?.axes)
    ? score.axes.filter(
        (axis) =>
          axis &&
          typeof axis.key === "string" &&
          typeof axis.label === "string" &&
          finiteNumber(axis.value) !== null,
      )
    : [];
}

function axisPresentation(axis, scale) {
  const minimum = finiteNumber(scale?.min) ?? 0;
  const maximum = finiteNumber(scale?.max) ?? 100;
  const range = maximum > minimum ? maximum - minimum : 100;
  const percent = Math.max(
    0,
    Math.min(100, ((axis.value - minimum) / range) * 100),
  );
  const weight = finiteNumber(axis.weight);
  const contribution = finiteNumber(axis.contribution);
  const detail = [
    weight === null ? null : `가중치 ${Math.round(weight * 100)}%`,
    contribution === null ? null : `기여 ${contribution}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return { minimum, maximum, percent, contribution, detail };
}

export function QualityScoreAxes({ score }) {
  const axes = scoreAxes(score);
  if (!axes.length) return null;

  return (
    <ul className="quality-dimensions">
      {axes.map((axis) => {
        const { percent, detail } = axisPresentation(axis, score?.scale);
        return (
          <li key={axis.key}>
            <span className="quality-dimension-label">{axis.label}</span>
            <span className="quality-dimension-bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
            <span className="quality-dimension-value">
              {axis.value}
              {detail && <small>{detail}</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function QualitySignals({ signals }) {
  const entries = Object.entries(signals || {});
  if (!entries.length) return null;
  return (
    <div className="quality-signal-list">
      <h5>평가 신호</h5>
      <ul>
        {entries.map(([key, value]) => {
          const [label, format] = SIGNAL_LABEL[key] || [key, null];
          const adverse = ADVERSE_WHEN_TRUE.includes(key) && Boolean(value);
          const shown = format
            ? format(value)
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
          return (
            <li key={key} className={adverse ? "is-adverse" : undefined}>
              <span>{label}</span>
              <strong>{shown}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OriginalSourceLink({ url, label = "원문 링크" }) {
  if (!url) return null;
  return (
    <div className="canonical-url-block">
      <span>{label}</span>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {url}
        <i className="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </div>
  );
}

export function QualityEvaluationPanel({
  evaluation,
  fallbackScore,
  extraFacts = null,
}) {
  const score = evaluation?.score;
  const overall = score?.overall ?? fallbackScore;
  if (!evaluation && overall == null) return null;

  return (
    <section className="admin-detail-section">
      <h4>품질 평가</h4>

      <div className="quality-body">
        <div className="quality-overall">
          <span
            className={`admin-score ${scoreTone({ evaluation, valueScore: overall })}`}
            title={scoreToneLabel({ evaluation, valueScore: overall })}
          >
            {overall ?? "—"}
          </span>
          {evaluation?.decision && (
            <span className={`status-badge ${statusTone(evaluation.decision)}`}>
              {statusLabel(evaluation.decision)}
            </span>
          )}
        </div>
        <QualityScoreAxes score={score} />
        {evaluation?.reason && (
          <p className="quality-reason">{evaluation.reason}</p>
        )}
        {extraFacts}
      </div>
    </section>
  );
}
