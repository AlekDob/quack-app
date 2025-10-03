import { useCallback, useEffect, useRef } from "react";
import PreviewPanel from "./PreviewPanel";
import { PreviewManagerProvider } from "../composables/usePreviewManager";
import type { ProcessInfo } from "../types";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  width: number;
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
  explorerPath: string;
  processes: ProcessInfo[];
}

export default function PreviewDrawer({
  open,
  onClose,
  width,
  minWidth,
  maxWidth,
  onResize,
  explorerPath,
  processes,
}: PreviewDrawerProps) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) {
        return;
      }
      const delta = lastXRef.current - event.clientX;
      lastXRef.current = event.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, width + delta));
      onResize(nextWidth);
    },
    [maxWidth, minWidth, onResize, width]
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, [handlePointerMove]);

  const handleHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      lastXRef.current = event.clientX;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [handlePointerMove, handlePointerUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  if (!open) {
    return null;
  }

  return (
    <div className="preview-drawer">
      <div
        className="preview-drawer-backdrop"
        onClick={handleBackdropClick}
        role="presentation"
      />
      <div className="preview-drawer-panel" style={{ width }}>
        <div
          className="preview-drawer-resize"
          onPointerDown={handleHandlePointerDown}
          role="presentation"
        />
        <PreviewManagerProvider processes={processes}>
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="text-sm font-medium text-slate-200">
                Preview inspector
                {explorerPath ? (
                  <span className="ml-3 text-xs font-normal text-slate-500">
                    {explorerPath}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="preview-close"
                onClick={onClose}
              >
                Close
              </button>
            </header>
            <div className="flex flex-1 min-h-0">
              <PreviewPanel />
            </div>
          </div>
        </PreviewManagerProvider>
      </div>
    </div>
  );
}
