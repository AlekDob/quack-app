import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errMsg, error as toastError, success as toastSuccess } from "../../notify";
import { useModalFocus } from "../../useModalFocus";
import { pushWorkToPlane } from "../../planeSync";
import {
  closeWorkDrawer,
  getWorkDrawer,
  subscribeWorkDrawer,
  type WorkDrawerRequest,
} from "../../workDrawer";
import { addWorkComment, hydrateWorks, subscribeWorks, updateWorkItem } from "../../worksCache";
import { findWork, statusLabel, type WorkItem, type WorksSnapshot } from "../../works";
import { openFeatureDocDrawer } from "../../featureDocDrawer";
import { Icon } from "../Icon";
import { WorkItemEditor } from "./WorkItemEditor";
import { WorkComments } from "./WorkComments";
import { useResizableWorkDrawerWidth } from "../../useResizableWorkDrawerWidth";

export function WorkItemDrawer() {
  const [req, setReq] = useState<WorkDrawerRequest | null>(getWorkDrawer());
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [planeBusy, setPlaneBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { width, onResizeDown } = useResizableWorkDrawerWidth();
  useModalFocus(panelRef, shown && !!req);

  const item = req && snap ? findWork(snap, req.workId) : undefined;
  const module = item
    ? snap?.modules.find((m) => m.id === item.moduleId)
    : undefined;

  useEffect(() => subscribeWorkDrawer(setReq), []);

  useEffect(() => {
    if (!req) {
      setShown(false);
      setSnap(null);
      return;
    }
    let alive = true;
    void hydrateWorks(req.root).then((next) => {
      if (!alive) return;
      setSnap(next);
      const w = findWork(next, req.workId);
      if (w) setTitle(w.title);
      requestAnimationFrame(() => setShown(true));
    });
    const unsub = subscribeWorks(req.root, (next) => {
      if (!alive) return;
      setSnap(next);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [req]);

  useEffect(() => {
    if (item) setTitle(item.title);
  }, [item?.id, item?.title]);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(() => closeWorkDrawer(), 220);
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, close]);

  const onUpdate = async (patch: Partial<WorkItem>) => {
    if (!req || !item) return;
    try {
      await updateWorkItem(req.root, item.id, patch);
    } catch (e) {
      toastError(`Couldn't update work: ${errMsg(e)}`);
    }
  };

  const onStatusChange = async (status: WorkItem["status"]) => {
    if (!req || !item) return;
    try {
      await updateWorkItem(req.root, item.id, { status });
    } catch (e) {
      toastError(`Couldn't update status: ${errMsg(e)}`);
    }
  };

  if (!req || !item) return null;

  const toggleLabel = (labelId: string) => {
    const next = item.labelIds.includes(labelId)
      ? item.labelIds.filter((id) => id !== labelId)
      : [...item.labelIds, labelId];
    void onUpdate({ labelIds: next });
  };

  const saveTitle = () => {
    const t = title.trim();
    if (t && t !== item.title) void onUpdate({ title: t });
  };

  const postComment = async () => {
    const body = comment.trim();
    if (!body || !req) return;
    try {
      await addWorkComment(req.root, item.id, "You", body);
      setComment("");
    } catch (e) {
      toastError(`Couldn't add comment: ${errMsg(e)}`);
    }
  };

  const syncPlane = async () => {
    if (!req) return;
    setPlaneBusy(true);
    try {
      const id = await pushWorkToPlane(req.wsId, req.root, item);
      if (id) toastSuccess(`Synced to Plane (${id.slice(0, 8)}…)`);
      else toastError("Plane sync is disabled or missing config");
    } catch (e) {
      toastError(`Plane sync failed: ${errMsg(e)}`);
    } finally {
      setPlaneBusy(false);
    }
  };

  const labels = snap?.labels ?? [];

  const openFeatureDoc = () => {
    if (!req || !module?.featurePath) return;
    openFeatureDocDrawer({
      wsId: req.wsId,
      root: req.root,
      featurePath: module.featurePath,
      title: module.name,
      featureNum: module.featureNum,
    });
  };

  return createPortal(
    <div
      className={`tool-drawer-scrim work-drawer-scrim${shown ? " shown" : ""}`}
      onMouseDown={close}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer tool-drawer--work${shown ? " shown" : ""}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
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
              <span className="work-drawer-id">{item.shortId}</span>
              {module && (
                <span className="work-drawer-module">
                  {module.featureNum != null
                    ? `${String(module.featureNum).padStart(3, "0")} · `
                    : ""}
                  {module.name}
                </span>
              )}
            </div>
            <div className="work-drawer-hero-actions">
              {module?.featurePath && (
                <button
                  type="button"
                  className="work-drawer-icon-btn"
                  onClick={openFeatureDoc}
                  title="Open feature doc"
                  aria-label="Open feature doc"
                >
                  <Icon name="file-text" size={14} />
                </button>
              )}
              <button
                type="button"
                className="work-drawer-icon-btn"
                disabled={planeBusy}
                onClick={() => void syncPlane()}
                title="Sync to Plane"
                aria-label="Sync to Plane"
              >
                <Icon name="cloud" size={14} />
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
          <input
            className="work-drawer-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Untitled work"
            aria-label="Title"
          />
        </header>

        <section className="work-drawer-fields" aria-label="Properties">
          <WorkDrawerField label="Status">
            <select
              className="work-drawer-field-select"
              value={item.status}
              onChange={(e) =>
                void onStatusChange(e.target.value as WorkItem["status"])
              }
              aria-label="Status"
            >
              {(
                ["backlog", "todo", "in_progress", "done", "cancelled"] as const
              ).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </WorkDrawerField>
          <WorkDrawerField label="Priority">
            <span className="work-drawer-field-text">{item.priority}</span>
          </WorkDrawerField>
          <WorkDrawerField label="Start">
            <input
              type="date"
              className="work-drawer-field-input"
              value={item.startDate ?? ""}
              onChange={(e) =>
                void onUpdate({ startDate: e.target.value || undefined })
              }
              aria-label="Start date"
            />
          </WorkDrawerField>
          <WorkDrawerField label="Target">
            <input
              type="date"
              className="work-drawer-field-input"
              value={item.targetDate ?? ""}
              onChange={(e) =>
                void onUpdate({ targetDate: e.target.value || undefined })
              }
              aria-label="Target date"
            />
          </WorkDrawerField>
          {labels.length > 0 && (
            <div className="work-drawer-field work-drawer-field--wide">
              <span className="work-drawer-field-label">Labels</span>
              <div className="work-drawer-labels">
                {labels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`work-drawer-label${
                      item.labelIds.includes(l.id) ? " active" : ""
                    }`}
                    onClick={() => toggleLabel(l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <div className="tool-drawer-body works-detail-body">
          <div className="works-detail-scroll">
            <WorkItemEditor
              blocks={item.descriptionBlocks}
              onChange={(blocks) => void onUpdate({ descriptionBlocks: blocks })}
            />
            <WorkComments
              comments={item.comments}
              draft={comment}
              onDraft={setComment}
              onPost={() => void postComment()}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WorkDrawerField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="work-drawer-field">
      <span className="work-drawer-field-label">{label}</span>
      <div className="work-drawer-field-control">{children}</div>
    </div>
  );
}
