import React, { useEffect, useId, useRef } from "react";
import "../../styles/writingPreview.css";

export default function WritingPreviewModal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll(
        'button, a[href], [tabindex="0"]',
      );
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      className="writing-preview-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="writing-preview"
      >
        <header className="writing-preview-bar">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            aria-label="미리보기 닫기"
            onClick={onClose}
            className="writing-preview-close"
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </header>
        <div className="writing-preview-scroll">{children}</div>
        <footer className="writing-preview-footer">
          <p>등록 전 작성한 내용을 확인해주세요.</p>
          <button
            type="button"
            className="writing-preview-return"
            onClick={onClose}
          >
            계속 작성하기
          </button>
        </footer>
      </div>
    </div>
  );
}
