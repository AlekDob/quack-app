import { useCallback } from "react";
import PreviewPanel from "./PreviewPanel";
import { PreviewManagerProvider } from "../composables/usePreviewManager";

interface PreviewDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function PreviewDrawer({ open, onClose }: PreviewDrawerProps) {
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

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
      <div className="preview-drawer-panel">
        <PreviewManagerProvider>
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="text-sm font-medium text-slate-200">Preview inspector</div>
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
