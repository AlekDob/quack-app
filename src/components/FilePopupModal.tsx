// File viewer/editor popup for agent mode. Agent mode has no editor
// pane, so clicking a file in the Files tab opens it here instead of as
// a hidden tab. Reuses FileEditorPane (load / edit / save / dirty).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../useModalFocus";
import { confirm as dialogConfirm } from "../dialog";
import { basename, relPath } from "../pathUtils";
import { Icon } from "./Icon";
import { FileEditorPane } from "./lazyHeavy";

interface Props {
  /** Absolute path of the file to view, or null when closed. */
  path: string | null;
  root: string;
  onClose: () => void;
}

export function FilePopupModal({ path, root, onClose }: Props) {
  const open = !!path;
  const modalRef = useRef<HTMLDivElement | null>(null);
  useModalFocus(modalRef, open);
  const [dirty, setDirty] = useState(false);

  const requestClose = useCallback(async () => {
    if (dirty) {
      const ok = await dialogConfirm("Discard unsaved changes?", {
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  if (!open || !path) return null;

  return createPortal(
    <div className="agent-modal-backdrop" onMouseDown={() => void requestClose()}>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="cust-modal file-popup"
        role="dialog"
        aria-modal="true"
        aria-label={basename(path)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="cust-modal-head">
          <div className="cust-modal-title">{basename(path)}</div>
          <button
            className="agent-modal-close"
            onClick={() => void requestClose()}
            aria-label="Close"
            title="Close (Esc)"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <FileEditorPane
          key={path}
          path={path}
          subtitle={relPath(path, root)}
          gitRoot={root}
          onDirtyChange={setDirty}
        />
      </div>
    </div>,
    document.body,
  );
}
