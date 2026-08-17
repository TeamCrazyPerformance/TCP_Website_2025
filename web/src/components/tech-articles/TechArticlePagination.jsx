import React from "react";

export function getPageTokens(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ]);
  const validPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  return validPages.flatMap((page, index) => {
    const previousPage = validPages[index - 1];
    return previousPage && page - previousPage > 1
      ? ["ellipsis", page]
      : [page];
  });
}

function TechArticlePagination({ pagination, onPageChange, className = "" }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { currentPage, totalPages } = pagination;
  return (
    <nav className={`ta-pagination ${className}`} aria-label="페이지 이동">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="이전 페이지"
      >
        <i className="fas fa-chevron-left" aria-hidden="true"></i>
        <span>이전</span>
      </button>
      <div className="ta-page-numbers">
        {getPageTokens(currentPage, totalPages).map((token, index) =>
          token === "ellipsis" ? (
            <span
              className="ta-page-ellipsis"
              key={`ellipsis-${index}`}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              type="button"
              key={token}
              onClick={() => onPageChange(token)}
              aria-current={token === currentPage ? "page" : undefined}
              aria-label={`${token}페이지로 이동`}
            >
              {token}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="다음 페이지"
      >
        <span>다음</span>
        <i className="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
      <span className="ta-pagination-status">
        {currentPage} / {totalPages}페이지
      </span>
    </nav>
  );
}

export default TechArticlePagination;
