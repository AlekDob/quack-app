import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { bootstrapTheme } from "../theme";
import { basename } from "../pathUtils";
import { Icon } from "./Icon";
import { FileEditorPane } from "./FileEditorPane";

(function applyInitialFilePopoutTheme() {
  try {
    const t = new URLSearchParams(window.location.search).get("theme");
    if (t === "dark" || t === "light") {
      document.documentElement.dataset.theme = t;
      return;
    }
  } catch {
    /* fall through */
  }
  bootstrapTheme();
})();

interface FilePopoutParams {
  path: string;
  gitRoot: string;
}

function readParams(): FilePopoutParams | null {
  const sp = new URLSearchParams(window.location.search);
  const path = sp.get("path");
  if (!path) return null;
  return { path, gitRoot: sp.get("gitRoot") ?? path };
}

export function FilePopoutWindow() {
  const [params] = useState<FilePopoutParams | null>(() => readParams());
  const [maximized, setMaximized] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "lcp.theme" || !e.newValue) return;
      if (e.newValue === "dark" || e.newValue === "light") {
        document.documentElement.dataset.theme = e.newValue;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!params) return;
    void getCurrentWindow()
      .setTitle(`${basename(params.path)} — Quack`)
      .catch(() => {});
  }, [params?.path]);

  useEffect(() => {
    void getCurrentWindow()
      .isMaximized()
      .then(setMaximized)
      .catch(() => {});
  }, []);

  const requestClose = useCallback(async () => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    await getCurrentWindow().close().catch(() => {});
  }, [dirty]);

  if (!params) {
    return (
      <div className="popout-error">
        <div>Invalid file window parameters.</div>
      </div>
    );
  }

  const name = basename(params.path);

  return (
    <div className="popout-shell" role="application" aria-label={`File: ${name}`}>
      <div className="popout-bar" data-tauri-drag-region>
        <span className="popout-bar-title">{name}</span>
        <span className="popout-bar-spacer" />
        <div className="window-controls" data-tauri-drag-region={false}>
          <button
            className="winctl"
            title="Minimize"
            aria-label="Minimize window"
            onClick={() => void getCurrentWindow().minimize().catch(() => {})}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0" y="4.5" width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="winctl"
            title={maximized ? "Restore" : "Maximize"}
            aria-label={maximized ? "Restore window" : "Maximize window"}
            onClick={() =>
              void getCurrentWindow().toggleMaximize().catch(() => {})
            }
          >
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect
                  x="0.5"
                  y="2.5"
                  width="7"
                  height="7"
                  fill="none"
                  stroke="currentColor"
                />
                <rect
                  x="2.5"
                  y="0.5"
                  width="7"
                  height="7"
                  fill="var(--bg-elev)"
                  stroke="currentColor"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect
                  x="0.5"
                  y="0.5"
                  width="9"
                  height="9"
                  fill="none"
                  stroke="currentColor"
                />
              </svg>
            )}
          </button>
          <button
            className="winctl close"
            title="Close"
            aria-label="Close window"
            onClick={() => void requestClose()}
          >
            <Icon name="x" size={10} />
          </button>
        </div>
      </div>
      <div className="popout-editor-host">
        <FileEditorPane
          key={params.path}
          path={params.path}
          gitRoot={params.gitRoot}
          onDirtyChange={setDirty}
        />
      </div>
    </div>
  );
}
