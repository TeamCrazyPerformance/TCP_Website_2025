import React, { useCallback, useEffect, useRef, useState } from "react";

function V9ConfirmDialog({ request, onSettle }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  const tone = request?.tone || "primary";
  const iconClass =
    tone === "danger"
      ? "fa-triangle-exclamation"
      : tone === "success"
        ? "fa-check"
        : "fa-shield-halved";
  const buttonClass =
    tone === "danger"
      ? "btn-danger"
      : tone === "success"
        ? "btn-success"
        : "btn-primary";

  return (
    <dialog
      id="confirmDialog"
      ref={dialogRef}
      className="admin-dialog confirm-dialog"
      aria-labelledby="confirmDialogTitle"
      aria-describedby="confirmDialogDescription"
      onCancel={(event) => {
        event.preventDefault();
        onSettle(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSettle(false);
      }}
    >
      <div className="dialog-panel">
        <div
          id="confirmDialogIcon"
          className={`confirm-dialog-icon${tone === "danger" ? " danger-icon" : tone === "success" ? " success-icon" : ""}`}
        >
          <i className={`fas ${iconClass}`} aria-hidden="true"></i>
        </div>
        <h2 id="confirmDialogTitle">
          {request?.title || "작업을 진행할까요?"}
        </h2>
        <p id="confirmDialogDescription">
          {request?.description || "선택한 작업을 확인해 주세요."}
        </p>
        <div className="dialog-actions">
          <button
            className="btn-secondary"
            type="button"
            onClick={() => onSettle(false)}
          >
            취소
          </button>
          <button
            id="confirmDialogButton"
            className={buttonClass}
            type="button"
            onClick={() => onSettle(true)}
          >
            {request?.confirmLabel || "확인"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function useV9ConfirmDialog() {
  const [request, setRequest] = useState(null);
  const requestRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        requestRef.current?.resolve(false);
        const nextRequest = { ...options, resolve };
        requestRef.current = nextRequest;
        setRequest(nextRequest);
      }),
    [],
  );

  const settle = useCallback((accepted) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    current?.resolve(Boolean(accepted));
  }, []);

  useEffect(
    () => () => {
      requestRef.current?.resolve(false);
      requestRef.current = null;
    },
    [],
  );

  return {
    confirm,
    confirmDialog: <V9ConfirmDialog request={request} onSettle={settle} />,
  };
}

export default V9ConfirmDialog;
