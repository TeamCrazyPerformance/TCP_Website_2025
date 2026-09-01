import React from 'react';

export default function TagMultiSelect({
  tags,
  selectedTags,
  onToggle,
  onReset,
  getTagClassName,
  ariaLabel,
  className = '',
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2" aria-label={ariaLabel}>
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`tag-btn px-3 py-1 rounded-full transition-colors ${getTagClassName(tag)} ${isSelected ? 'is-selected' : 'hover:opacity-80'}`}
              aria-pressed={isSelected}
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
    </div>
  );
}
