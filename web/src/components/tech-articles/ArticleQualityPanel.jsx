// src/components/tech-articles/ArticleQualityPanel.jsx
//
// 아티클 상세에서 원문 링크와 품질 평가 근거를 보여줍니다.
// 전체 아티클 화면과 검토 큐 화면이 같은 형식으로 쓰도록 여기에 모았습니다.
import React from "react";
import {
  scoreTone,
  scoreToneLabel,
  statusLabel,
  statusTone,
} from "./techArticleStatus";

// 점수와 무관하게 판정을 뒤집는 강제 정책 신호(evaluator.py 의 hard_rejections).
// 원본 키를 그대로 늘어놓으면 읽히지 않아 라벨과 표기를 붙입니다.
const SIGNAL_LABEL = {
  contentLength: ["본문 길이", (v) => `${Number(v).toLocaleString()}자`],
  language: ["언어", (v) => String(v)],
  contentComplete: ["본문 수집", (v) => (v ? "완전" : "불완전")],
  spamSuspected: ["스팸 의심", (v) => (v ? "있음" : "없음")],
  advertisementSuspected: ["광고 의심", (v) => (v ? "있음" : "없음")],
};

// true 면 판정에 불리한 신호. 눈에 띄어야 합니다.
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

/** 서버가 평가 당시 저장한 축 순서와 표시 정보를 그대로 사용합니다. */
export function QualityScoreAxes({ score, variant = "admin" }) {
  const axes = scoreAxes(score);
  if (!axes.length) return null;

  if (variant === "public") {
    return (
      <dl className="score-breakdown">
        {axes.map((axis) => {
          const { contribution } = axisPresentation(axis, score?.scale);
          return (
            <div key={axis.key}>
              <dt>{axis.label}</dt>
              <dd>{contribution ?? "—"}</dd>
            </div>
          );
        })}
      </dl>
    );
  }

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

// 점수만 보여주면 관리자가 판정을 납득할 수 없어 축별 기여도까지 펼칩니다.
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
      {/* 블록 간격을 개별 margin 이 아니라 flex gap 으로 잡습니다.
          문단의 반행간이 위아래로 더해져 margin 만으로는 눈에 같아 보이지 않습니다. */}
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
