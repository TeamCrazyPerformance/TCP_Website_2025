import React, { useId, useLayoutEffect, useRef, useState } from 'react';

export default function TagMultiSelect({
  tags,
  selectedTags,
  onToggle,
  onReset,
  getTagClassName,
  ariaLabel,
  className = '',
  collapsedRows,
  getTagStyle,
}) {
  const listRef = useRef(null);
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const [layout, setLayout] = useState(null);

  useLayoutEffect(() => {
    if (!collapsedRows || !listRef.current) return;
    const list = listRef.current;
    const measure = () => {
      const buttons = [...list.children];
      const rows = [...new Set(buttons.map((button) => button.offsetTop))];
      const hidden = buttons.map((button) => rows.indexOf(button.offsetTop) >= collapsedRows);
      const visible = buttons.filter((_, index) => !hidden[index]);
      const height = Math.max(0, ...visible.map((button) => button.offsetTop + button.offsetHeight)) + 2;
      setLayout({ hidden, height, overflow: rows.length > collapsedRows });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(list);
    window.addEventListener('resize', measure);
    let active = true;
    document.fonts?.ready.then(() => { if (active) measure(); });
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [tags, collapsedRows]);

  return (
    <div className={className}>
      <div ref={listRef} id={listId} className="flex flex-wrap gap-2" aria-label={ariaLabel}
        style={collapsedRows ? { position: 'relative', overflow: 'hidden', maxHeight: !expanded && layout?.overflow ? layout.height : undefined, padding: 2 } : undefined}>
        {tags.map((tag, index) => {
          const isSelected = selectedTags.includes(tag);
          const hidden = !expanded && layout?.overflow && layout.hidden[index];
          return (
            <button
              key={tag}
              type="button"
              className={`tag-btn transition-colors ${getTagClassName(tag)} ${isSelected ? 'is-selected' : 'hover:opacity-80'}`}
              aria-pressed={isSelected}
              aria-hidden={hidden || undefined}
              tabIndex={hidden ? -1 : undefined}
              style={{ ...getTagStyle?.(tag), visibility: hidden ? 'hidden' : undefined }}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {selectedTags.length > 0 && (
        <div className="service-tag-filter-summary">
          <span>{selectedTags.length}개 선택</span>
          <button type="button" className="service-tag-filter-reset" onClick={onReset}>
            초기화
          </button>
        </div>
      )}
      {collapsedRows && layout?.overflow && (
        <button type="button" className="service-tag-filter-expand"
          aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>
          {expanded ? '태그 접기' : '태그 더 보기'}
          <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
      )}
    </div>
  );
}
