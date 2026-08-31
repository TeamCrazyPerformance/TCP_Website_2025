import React from "react";

const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export default function PublicValueScoreBreakdown({ breakdown }) {
  const items = Array.isArray(breakdown)
    ? breakdown.filter(
        (item) => item && typeof item.label === "string" && item.label.trim(),
      )
    : [];
  if (!items.length) return null;

  return (
    <dl className="score-breakdown">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <dt>{item.label}</dt>
          <dd>{finiteNumber(item.contribution) ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
