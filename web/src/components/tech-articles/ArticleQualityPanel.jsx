// src/components/tech-articles/ArticleQualityPanel.jsx
//
// 아티클 상세에서 원문 링크와 품질 평가 근거를 보여줍니다.
// 전체 아티클 화면과 검토 큐 화면이 같은 형식으로 쓰도록 여기에 모았습니다.
import React from "react";
import { statusLabel, statusTone } from "./techArticleStatus";

// 파이프라인 가중치(evaluator.py). 값이 바뀌면 판정 결과 설명이 어긋납니다.
const QUALITY_DIMENSIONS = [
  ["relevance", "개발 관련성", 0.45],
  ["timeliness", "시의성", 0.3],
  ["sourceReliability", "출처 신뢰도", 0.25],
];

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
  // 일부 응답은 dimensions 없이 축을 score 에 평면으로 담습니다.
  const dimensions = score?.dimensions ?? score;
  const overall = score?.overall ?? fallbackScore;
  if (!evaluation && overall == null) return null;

  return (
    <section className="admin-detail-section">
      <h4>품질 평가</h4>
      {/* 블록 간격을 개별 margin 이 아니라 flex gap 으로 잡습니다.
          문단의 반행간이 위아래로 더해져 margin 만으로는 눈에 같아 보이지 않습니다. */}
      <div className="quality-body">
        <div className="quality-overall">
          <span className="admin-score">{overall ?? "—"}</span>
          {evaluation?.decision && (
            <span className={`status-badge ${statusTone(evaluation.decision)}`}>
              {statusLabel(evaluation.decision)}
            </span>
          )}
        </div>
        {dimensions && (
          <ul className="quality-dimensions">
            {QUALITY_DIMENSIONS.map(([key, label, weight]) => {
              const value = dimensions[key];
              return (
                <li key={key}>
                  <span className="quality-dimension-label">{label}</span>
                  <span className="quality-dimension-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
                      }}
                    />
                  </span>
                  <span className="quality-dimension-value">
                    {value ?? "—"}
                    <small>
                      × {Math.round(weight * 100)}% ={" "}
                      {value == null ? "—" : (value * weight).toFixed(1)}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {evaluation?.reason && (
          <p className="quality-reason">{evaluation.reason}</p>
        )}
        {extraFacts}
      </div>
    </section>
  );
}
