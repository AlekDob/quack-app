import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errMsg, error as toastError, success as toastSuccess } from "../../notify";
import { useModalFocus } from "../../useModalFocus";
import { pushWorkToPlane } from "../../planeSync";
import {
  closeWorkDrawer,
  getWorkDrawer,
  isWorkDrawerCreate,
  openWorkDrawer,
  subscribeWorkDrawer,
  type WorkDrawerRequest,
} from "../../workDrawer";
import {
  addWorkComment,
  createWorkItem,
  hydrateWorks,
  subscribeWorks,
  updateWorkItem,
} from "../../worksCache";
import {
  findWork,
  statusLabel,
  type WorkBlock,
  type WorkItem,
  type WorkOrigin,
  type WorkPriority,
  type WorksSnapshot,
} from "../../works";
import { blocksToMarkdown, markdownToBlocks } from "../../worksBlocks";
import { formatModuleLabel, sortWorkModules } from "../../worksUi";
import {
  drawerPortalTarget,
  isNestedDrawerPortal,
  subscribeDrawerPortal,
} from "../../editorDrawerStack";
import { openFeatureDocDrawer } from "../../featureDocDrawer";
import { joinPath } from "../../pathUtils";
import { useStore } from "../../store";
import { Icon } from "../Icon";
import { WorkComments } from "./WorkComments";
import { WorkItemEditor } from "./WorkItemEditor";
import { useResizableWorkDrawerWidth } from "../../useResizableWorkDrawerWidth";

export function WorkItemDrawer() {
  const [req, setReq] = useState<WorkDrawerRequest | null>(getWorkDrawer());
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [status, setStatus] = useState<WorkItem["status"]>("todo");
  const [priority, setPriority] = useState<WorkPriority>("medium");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [origin, setOrigin] = useState<WorkOrigin>("manual");
  const [moduleId, setModuleId] = useState("");
  const [comment, setComment] = useState("");
  const [planeBusy, setPlaneBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [, bumpPortal] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const blocksDirty = useRef(false);
  const { width, onResizeDown } = useResizableWorkDrawerWidth();
  useModalFocus(panelRef, shown && !!req);

  const isCreate = req ? isWorkDrawerCreate(req) : false;
  const item =
    req && snap && !isCreate && "workId" in req
      ? findWork(snap, req.workId)
      : undefined;
  const module = snap?.modules.find((m) =>
    m.id === (isCreate ? moduleId : item?.moduleId),
  );
  const modules = snap?.modules ?? [];

  useEffect(() => subscribeWorkDrawer(setReq), []);
  useEffect(() => subscribeDrawerPortal(() => bumpPortal((n) => n + 1)), []);

  const seedCreateDraft = useCallback((next: WorkDrawerRequest) => {
    const d = isWorkDrawerCreate(next) ? next.draft : undefined;
    setTitle(d?.title ?? "");
    setBlocks(markdownToBlocks(d?.bodyMd ?? ""));
    setStatus(d?.status ?? "todo");
    setPriority(d?.priority ?? "medium");
    setLabelIds(d?.labelIds ?? []);
    setStartDate(d?.startDate ?? "");
    setTargetDate(d?.targetDate ?? "");
    setOrigin(d?.origin ?? "manual");
    setModuleId(d?.moduleId ?? "");
    setComment("");
  }, []);

  useEffect(() => {
    if (!req) {
      setShown(false);
      setSnap(null);
      return;
    }
    let alive = true;
    blocksDirty.current = false;
    void hydrateWorks(req.root).then((next) => {
      if (!alive) return;
      setSnap(next);
      if (isWorkDrawerCreate(req)) {
        seedCreateDraft(req);
        const draft = req.draft;
        const fallback =
          draft?.moduleId ??
          next.modules.find((m) => m.featurePath)?.id ??
          next.modules[0]?.id ??
          "";
        setModuleId(fallback);
      } else {
        const w = findWork(next, req.workId);
        if (w) {
          setTitle(w.title);
          setBlocks(markdownToBlocks(w.bodyMd ?? ""));
        }
      }
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
  }, [req, seedCreateDraft]);

  useEffect(() => {
    if (!item || isCreate || blocksDirty.current) return;
    setTitle(item.title);
    setStatus(item.status);
    setLabelIds(item.labelIds);
    setModuleId(item.moduleId);
    setBlocks(markdownToBlocks(item.bodyMd ?? ""));
  }, [item, isCreate]);

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

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return;
    if (isCreate) {
      setTitle(t);
      return;
    }
    if (item && t !== item.title) void onUpdate({ title: t });
  };

  const onBlocksChange = (next: WorkBlock[]) => {
    blocksDirty.current = true;
    setBlocks(next);
    if (isCreate || !item) return;
    void onUpdate({ bodyMd: blocksToMarkdown(next) });
  };

  const toggleLabel = (labelId: string) => {
    const next = labelIds.includes(labelId)
      ? labelIds.filter((id) => id !== labelId)
      : [...labelIds, labelId];
    setLabelIds(next);
    if (!isCreate && item) void onUpdate({ labelIds: next });
  };

  const onCreate = async () => {
    if (!req || !isCreate) return;
    setCreateBusy(true);
    try {
      const item = await createWorkItem(req.root, {
        title: title.trim() || "Untitled work",
        origin,
        status,
        priority,
        bodyMd: blocksToMarkdown(blocks),
        moduleId: moduleId || undefined,
      });
      const patch: Partial<WorkItem> = {};
      if (labelIds.length) patch.labelIds = labelIds;
      if (startDate) patch.startDate = startDate;
      if (targetDate) patch.targetDate = targetDate;
      if (Object.keys(patch).length) await updateWorkItem(req.root, item.id, patch);
      openWorkDrawer({ wsId: req.wsId, root: req.root, workId: item.id });
      toastSuccess(`Created ${item.shortId}`);
    } catch (e) {
      toastError(`Couldn't create work: ${errMsg(e)}`);
    } finally {
      setCreateBusy(false);
    }
  };

  const postComment = async () => {
    const text = comment.trim();
    if (!text || !req || !item) return;
    try {
      await addWorkComment(req.root, item.id, "You", text);
      setComment("");
    } catch (e) {
      toastError(`Couldn't add comment: ${errMsg(e)}`);
    }
  };

  const syncPlane = async () => {
    if (!req || !item) return;
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

  if (!req || (!isCreate && !item)) return null;

  const portal = drawerPortalTarget(req.wsId);
  const nested = isNestedDrawerPortal(portal);
  const labels = snap?.labels ?? [];
  const heroId = isCreate ? "Draft" : item!.shortId;
  const heroTitle = isCreate ? "New work" : item!.title;

  const openWorkFile = () => {
    if (!req || !item) return;
    void useStore.getState().openFile(req.wsId, joinPath(req.root, item.filePath));
    close();
  };

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
      className={`tool-drawer-scrim work-drawer-scrim${
        nested ? " tool-drawer-scrim--nested" : ""
      }${shown ? " shown" : ""}`}
      onMouseDown={close}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`tool-drawer tool-drawer--work${shown ? " shown" : ""}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={heroTitle}
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
              <span className="work-drawer-id">{heroId}</span>
              {!isCreate && module && (
                <span className="work-drawer-module">
                  {module.featureNum != null
                    ? `${String(module.featureNum).padStart(3, "0")} · `
                    : ""}
                  {module.name}
                </span>
              )}
              {isCreate && module && (
                <span className="work-drawer-module">{formatModuleLabel(module)}</span>
              )}
            </div>
            <div className="work-drawer-hero-actions">
              {!isCreate && (
                <>
                  <button
                    type="button"
                    className="work-drawer-icon-btn"
                    onClick={openWorkFile}
                    title="Open work file"
                    aria-label="Open work file"
                  >
                    <Icon name="file-text" size={14} />
                  </button>
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
                </>
              )}
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
          {modules.length > 0 && (
            <div className="work-drawer-field work-drawer-field--wide">
              <span className="work-drawer-field-label">Module</span>
              <select
                className="work-drawer-field-select"
                value={moduleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setModuleId(next);
                  if (!isCreate && item) void onUpdate({ moduleId: next });
                }}
                aria-label="Module"
              >
                {sortWorkModules(modules).map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatModuleLabel(m)}
                    {m.featurePath ? ` — ${m.featurePath}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <WorkDrawerField label="Status">
            <select
              className="work-drawer-field-select"
              value={status}
              onChange={(e) => {
                const next = e.target.value as WorkItem["status"];
                setStatus(next);
                if (!isCreate && item) void onUpdate({ status: next });
              }}
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
            {isCreate ? (
              <select
                className="work-drawer-field-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as WorkPriority)}
                aria-label="Priority"
              >
                {(["urgent", "high", "medium", "low"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <span className="work-drawer-field-text">{item!.priority}</span>
            )}
          </WorkDrawerField>
          <WorkDrawerField label="Start">
            <input
              type="date"
              className="work-drawer-field-input"
              value={isCreate ? startDate : (item!.startDate ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                if (isCreate) setStartDate(v);
                else void onUpdate({ startDate: v || undefined });
              }}
              aria-label="Start date"
            />
          </WorkDrawerField>
          <WorkDrawerField label="Target">
            <input
              type="date"
              className="work-drawer-field-input"
              value={isCreate ? targetDate : (item!.targetDate ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                if (isCreate) setTargetDate(v);
                else void onUpdate({ targetDate: v || undefined });
              }}
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
                      labelIds.includes(l.id) ? " active" : ""
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
            <WorkItemEditor blocks={blocks} onChange={onBlocksChange} />
            {!isCreate && item && (
              <WorkComments
                comments={item.comments}
                draft={comment}
                onDraft={setComment}
                onPost={() => void postComment()}
              />
            )}
          </div>
        </div>

        {isCreate && (
          <footer className="work-drawer-footer">
            <button
              type="button"
              className="work-drawer-btn work-drawer-btn--ghost"
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              className="work-drawer-btn work-drawer-btn--primary"
              disabled={createBusy}
              onClick={() => void onCreate()}
            >
              Create
            </button>
          </footer>
        )}
      </div>
    </div>,
    portal,
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
