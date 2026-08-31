import React, { useMemo } from "react";
import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

export function formatRelativeFromNow(value, now = Date.now()) {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const minutes = Math.max(0, Math.floor((now - target) / 60000));
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return null;
}

export function formatTechArticleDate(value, withTime = false) {
  if (!value) return "확인되지 않음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인되지 않음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function shouldOpenFromCardClick(event) {
  if (!event || event.defaultPrevented) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (typeof event.button === "number" && event.button !== 0) return false;
  if (event.target?.closest?.("a, button, input, select, textarea, [role]"))
    return false;
  if (window.getSelection?.()?.toString()) return false;
  return true;
}

export function TechArticleTags({ tags = [], limit }) {
  const visible = typeof limit === "number" ? tags.slice(0, limit) : tags;
  const hiddenCount = tags.length - visible.length;
  if (!tags.length)
    return <span className="ta-tag ta-tag-muted">분야 미분류</span>;
  return (
    <div className="ta-tags" aria-label="분야 태그">
      {visible.map((tag) => (
        <span className="ta-tag" key={tag}>
          {tag}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="ta-tag ta-tag-muted">+{hiddenCount}</span>
      )}
    </div>
  );
}

export function SafeMarkdown({
  markdown,
  className = "",
  id,
  emptyMessage = "표시할 상세 요약이 없습니다.",
}) {
  const html = useMemo(() => {
    const normalized = String(markdown || "").trim();
    if (!normalized) return "";

    const renderer = new MarkdownIt({
      html: false,
      linkify: false,
      breaks: false,
    });
    const defaultOpen = renderer.renderer.rules.heading_open;
    const defaultClose = renderer.renderer.rules.heading_close;
    const normalizeHeading = (defaultRule) =>
      function renderHeading(tokens, index, options, environment, self) {
        const level = Number.parseInt(tokens[index].tag.slice(1), 10);
        tokens[index].tag = `h${Math.min(6, Math.max(3, level))}`;
        return defaultRule
          ? defaultRule(tokens, index, options, environment, self)
          : self.renderToken(tokens, index, options);
      };
    renderer.renderer.rules.heading_open = normalizeHeading(defaultOpen);
    renderer.renderer.rules.heading_close = normalizeHeading(defaultClose);

    return DOMPurify.sanitize(renderer.render(normalized), {
      ALLOWED_TAGS: [
        "p",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "code",
        "pre",
        "blockquote",
        "hr",
        "br",
      ],
      ALLOWED_ATTR: [],
    });
  }, [markdown]);

  if (!html) {
    return id ? (
      <div id={id} className={className}>
        {emptyMessage}
      </div>
    ) : (
      <p className="ta-empty-copy">{emptyMessage}</p>
    );
  }
  return (
    <div
      id={id}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function LoadingState({ label = "불러오는 중입니다." }) {
  return (
    <div className="ta-state" role="status">
      <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="ta-state ta-state-error" role="alert">
      <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "표시할 아티클이 없습니다.",
  description,
  onReset,
}) {
  return (
    <div className="ta-state">
      <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {onReset && (
        <button type="button" onClick={onReset}>
          전체 조건 초기화
        </button>
      )}
    </div>
  );
}
