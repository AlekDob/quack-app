import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onDiffRequest, type DiffRequest } from "../editorState";
import { useModalFocus } from "../useModalFocus";
import { DiffView } from "./lazyHeavy";
import { Icon } from "./Icon";

export function DiffModal() {
  const [req, setReq] = useState<DiffRequest | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, !!req);

  useEffect(() => {
    return onDiffRequest((r) => setReq(r));
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReq(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  if (!req) return null;
  return createPortal(
    <div className="diff-modal" onMouseDown={() => setReq(null)}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="diff-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="diff-modal-header">
          <span className="diff-modal-title" id="diff-modal-title">
            {req.path}
            <span className="diff-modal-ref">vs {req.refspec}</span>
          </span>
          <button
            className="diff-modal-close"
            onClick={() => setReq(null)}
            title="Close (Esc)"
            aria-label="Close diff view"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="diff-modal-body">
          <DiffView
            originalContent={req.originalContent}
            modifiedContent={req.modifiedContent}
            path={req.path}
            sideBySide
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
