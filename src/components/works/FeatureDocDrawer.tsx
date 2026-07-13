import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "../../useModalFocus";
import { fs } from "../../ipc";
import { joinPath } from "../../pathUtils";
import { useStore } from "../../store";
import {
  openWorkspaceDocPath,
  resolveWorkspaceDocPath,
} from "../../workspaceDocOpen";
import {
  closeFeatureDocDrawer,
  getFeatureDocDrawer,
  subscribeFeatureDocDrawer,
  type FeatureDocDrawerRequest,
} from "../../featureDocDrawer";
import { Icon } from "../Icon";
import { MarkdownPreview } from "../MarkdownPreview";
import { useResizableWorkDrawerWidth } from "../../useResizableWorkDrawerWidth";
import { featureDocPreviewBody, featureDisplayTitle, featureFileLabel } from "../../featureDocPreview";
import {
  drawerPortalTarget,
  isNestedDrawerPortal,
  subscribeDrawerPortal,
} from "../../editorDrawerStack";

export function FeatureDocDrawer() {
  const [req, setReq] = useState<FeatureDocDrawerRequest | null>(
    getFeatureDocDrawer(),
  );
  const [shown, setShown] = useState(false);
  const [, bumpPortal] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { width, onResizeDown } = useResizableWorkDrawerWidth();
  useModalFocus(panelRef, shown && !!req);

  useEffect(() => subscribeFeatureDocDrawer(setReq), []);
  useEffect(() => subscribeDrawerPortal(() => bumpPortal((n) => n + 1)), []);

  useEffect(() => {
    if (!req) {
      setShown(false);
      setContent("");
      setMissing(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setMissing(false);
    requestAnimationFrame(() => setShown(true));
    const abs = joinPath(req.root, req.featurePath);
    void fs
      .readFile(abs)
      .then((md) => {
        if (!alive) return;
        setContent(md);
      })
      .catch(() => {
        if (!alive) return;
        setContent("");
        setMissing(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [req]);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(() => closeFeatureDocDrawer(), 220);
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, close]);

  const openInEditor = () => {
    if (!req || missing) return;
    void resolveWorkspaceDocPath(req.root, req.featurePath).then(async (abs) => {
      if (!abs) return;
      await useStore.getState().openFile(req.wsId, abs);
      close();
    });
  };

  const previewBody = content
    ? featureDocPreviewBody(content, req?.title)
    : "";

  if (!req) return null;

  const portal = drawerPortalTarget(req.wsId);
  const nested = isNestedDrawerPortal(portal);
  const displayTitle = featureDisplayTitle(req.title, req.featureNum);
  const fileLabel = featureFileLabel(req.featurePath, req.featureNum);

  return createPortal(
    <div
      className={`tool-drawer-scrim work-drawer-scrim${
        nested ? " tool-drawer-scrim--nested" : ""
      }${shown ? " shown" : ""}`}
      onMouseDown={close}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer tool-drawer--work tool-drawer--feature${
          shown ? " shown" : ""
        }`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={displayTitle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="work-drawer-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize drawer"
          onMouseDown={onResizeDown}
        />
        <header className="work-drawer-hero">
          <div className="work-drawer-hero-top">
            <div className="work-drawer-hero-meta">
              {req.featureNum != null && (
                <span className="work-drawer-id">
                  {String(req.featureNum).padStart(3, "0")}
                </span>
              )}
              <span className="work-drawer-module">{fileLabel}</span>
            </div>
            <div className="work-drawer-hero-actions">
              <button
                type="button"
                className="work-drawer-icon-btn"
                onClick={openInEditor}
                title="Open in editor"
                aria-label="Open in editor"
                disabled={missing}
              >
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                className="work-drawer-close"
                onClick={close}
                aria-label="Close"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
          <h2 className="work-feature-title">{displayTitle}</h2>
        </header>
        <div className="tool-drawer-body work-feature-body">
          {loading && <div className="works-status">Loading…</div>}
          {!loading && missing && (
            <div className="works-status">
              This document hasn&apos;t been created yet.
            </div>
          )}
          {!loading && !missing && previewBody && (
            <MarkdownPreview
              content={previewBody}
              onFileOpen={(path) => {
                if (!req) return;
                void openWorkspaceDocPath(req.wsId, req.root, path);
              }}
            />
          )}
        </div>
      </div>
    </div>,
    portal,
  );
}
