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
import { SimpleMonacoEditor } from "../SimpleMonacoEditor";
import { useResizableWorkDrawerWidth } from "../../useResizableWorkDrawerWidth";
import {
  featureDocPreviewBody,
  featureDisplayTitle,
  featureFileLabel,
} from "../../featureDocPreview";
import {
  drawerPortalTarget,
  isNestedDrawerPortal,
  subscribeDrawerPortal,
} from "../../editorDrawerStack";
import {
  appendFeatureComment,
  listFeatureTaskLines,
  setFeatureFrontmatterField,
  setFeatureStatusInMd,
  toggleFeatureTaskInMd,
  type FeatureStatus,
} from "../../featureCatalog";
import { errMsg, error as toastError } from "../../notify";

const STATUSES: FeatureStatus[] = ["draft", "active", "done", "archived"];

function readFmDate(src: string, key: string): string {
  const m = src.match(new RegExp(`^${key}:\\s*(\\d{4}-\\d{2}-\\d{2})`, "m"));
  return m?.[1] ?? "";
}
export function FeatureDocDrawer() {
  const [req, setReq] = useState<FeatureDocDrawerRequest | null>(
    getFeatureDocDrawer(),
  );
  const [shown, setShown] = useState(false);
  const [, bumpPortal] = useState(0);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
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
      setEditing(false);
      setComment("");
      return;
    }
    let alive = true;
    setLoading(true);
    setMissing(false);
    setEditing(false);
    requestAnimationFrame(() => setShown(true));
    const abs = joinPath(req.root, req.featurePath);
    void fs
      .readFile(abs)
      .then((md) => {
        if (!alive) return;
        setContent(md);
        setDraft(md);
      })
      .catch(() => {
        if (!alive) return;
        setContent("");
        setDraft("");
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

  const persist = async (next: string) => {
    if (!req) return;
    setSaving(true);
    try {
      await fs.writeFile(joinPath(req.root, req.featurePath), next);
      setContent(next);
      setDraft(next);
    } catch (e) {
      toastError(`Couldn't save feature: ${errMsg(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const openInEditor = () => {
    if (!req || missing) return;
    void resolveWorkspaceDocPath(req.root, req.featurePath).then(async (abs) => {
      if (!abs) return;
      await useStore.getState().openFile(req.wsId, abs);
      close();
    });
  };

  // While Monaco is open, draft is the live source — props must read/write it.
  const liveMd = editing ? draft : content;
  const statusMatch = liveMd.match(/^status:\s*(\w+)/m);
  const status = (statusMatch?.[1]?.toLowerCase() ?? "active") as FeatureStatus;
  const startDate =
    readFmDate(liveMd, "startDate") || readFmDate(liveMd, "created");
  const endDate = readFmDate(liveMd, "endDate");
  const tasks = listFeatureTaskLines(content);
  const previewBody = content
    ? featureDocPreviewBody(content, req?.title)
    : "";

  const patchMeta = (apply: (src: string) => string) => {
    void persist(apply(editing ? draft : content));
  };

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
              {!missing && (
                <button
                  type="button"
                  className="work-drawer-icon-btn"
                  onClick={() => {
                    if (editing) void persist(draft);
                    setEditing((v) => !v);
                  }}
                  title={editing ? "Save & preview" : "Edit markdown"}
                  aria-label={editing ? "Save and preview" : "Edit markdown"}
                  disabled={saving}
                >
                  <Icon name={editing ? "check" : "edit"} size={14} />
                </button>
              )}
              <button
                type="button"
                className="work-drawer-icon-btn"
                onClick={openInEditor}
                title="Open in editor"
                aria-label="Open in editor"
                disabled={missing}
              >
                <Icon name="file-text" size={14} />
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
          {!missing && !loading && (
            <div className="work-feature-props">
              <label className="work-feature-status">
                <span>Status</span>
                <select
                  value={STATUSES.includes(status) ? status : "active"}
                  disabled={saving}
                  onChange={(e) => {
                    const next = e.target.value as FeatureStatus;
                    patchMeta((src) => setFeatureStatusInMd(src, next));
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="work-feature-status">
                <span>Start</span>
                <input
                  type="date"
                  value={startDate}
                  disabled={saving}
                  onChange={(e) =>
                    patchMeta((src) =>
                      setFeatureFrontmatterField(
                        src,
                        "startDate",
                        e.target.value,
                      ),
                    )
                  }
                />
              </label>
              <label className="work-feature-status">
                <span>End</span>
                <input
                  type="date"
                  value={endDate}
                  disabled={saving}
                  onChange={(e) =>
                    patchMeta((src) =>
                      setFeatureFrontmatterField(
                        src,
                        "endDate",
                        e.target.value,
                      ),
                    )
                  }
                />
              </label>
            </div>
          )}
        </header>
        <div
          className={`tool-drawer-body work-feature-body${
            editing ? " work-feature-body--editing" : ""
          }`}
        >
          {loading && <div className="works-status">Loading…</div>}
          {!loading && missing && (
            <div className="works-status">
              This document hasn&apos;t been created yet.
            </div>
          )}
          {!loading && !missing && editing && (
            <div className="work-feature-monaco">
              <SimpleMonacoEditor
                path={joinPath(req.root, req.featurePath)}
                value={draft}
                onChange={setDraft}
              />
            </div>
          )}
          {!loading && !missing && !editing && (
            <>
              {tasks.length > 0 && (
                <section className="work-feature-tasks" aria-label="Tasks">
                  <div className="work-feature-section-title">Tasks</div>
                  <ul className="work-feature-task-list">
                    {tasks.map((t) => (
                      <li key={t.index}>
                        <label className="work-feature-task">
                          <input
                            type="checkbox"
                            checked={t.done}
                            disabled={saving}
                            onChange={() =>
                              void persist(
                                toggleFeatureTaskInMd(content, t.index),
                              )
                            }
                          />
                          <span
                            className={
                              t.done ? "work-feature-task-done" : undefined
                            }
                          >
                            {t.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {previewBody && (
                <MarkdownPreview
                  content={previewBody}
                  onFileOpen={(path) => {
                    if (!req) return;
                    void openWorkspaceDocPath(req.wsId, req.root, path);
                  }}
                />
              )}
              <section className="work-feature-comment" aria-label="Add comment">
                <div className="work-feature-section-title">Add comment</div>
                <div className="work-feature-comment-row">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Note (stays in the .md, not injected)"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || !comment.trim()) return;
                      e.preventDefault();
                      const next = appendFeatureComment(content, comment);
                      setComment("");
                      void persist(next);
                    }}
                  />
                  <button
                    type="button"
                    className="works-new-btn"
                    disabled={!comment.trim() || saving}
                    onClick={() => {
                      const next = appendFeatureComment(content, comment);
                      setComment("");
                      void persist(next);
                    }}
                  >
                    Add
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>,
    portal,
  );
}
