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
import { startWorksWatchOnce } from "../../worksWatch";
import {
  findWork,
  type WorkBlock,
  type WorkItem,
  type WorkOrigin,
  type WorkPriority,
  type WorksSnapshot,
} from "../../works";
import { blocksToMarkdown, markdownToBlocks } from "../../worksBlocks";
import {
  drawerPortalTarget,
  isNestedDrawerPortal,
  subscribeDrawerPortal,
} from "../../editorDrawerStack";
import { openFeatureDocDrawer } from "../../featureDocDrawer";
import { joinPath } from "../../pathUtils";
import { useStore } from "../../store";
import { Icon, type IconName } from "../Icon";
import { WorkComments } from "./WorkComments";
import {
  WorkPriorityPicker,
  WorkStatusPicker,
} from "./WorkDrawerChipPickers";
import { WorkItemEditor } from "./WorkItemEditor";
import { WorkModulePicker } from "./WorkModulePicker";
import { WorksDocRefsSection } from "./WorksDocRefsSection";
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
  const [parentId, setParentId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [brainRefs, setBrainRefs] = useState<string[]>([]);
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
    setParentId("");
    setCycleId("");
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
    startWorksWatchOnce();
    void hydrateWorks(req.root).then((next) => {
      if (!alive) return;
      setSnap(next);
      if (isWorkDrawerCreate(req)) {
        seedCreateDraft(req);
        const draft = req.draft;
        setModuleId(draft?.moduleId ?? "");
      } else {
        const w = findWork(next, req.workId);
        if (w) {
          setTitle(w.title);
          setBlocks(markdownToBlocks(w.bodyMd ?? ""));
          setParentId(w.parentId ?? "");
          setCycleId(w.cycleId ?? "");
          setBrainRefs(w.brainRefs ?? []);
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
    setPriority(item.priority);
    setLabelIds(item.labelIds);
    setModuleId(item.moduleId);
    setParentId(item.parentId ?? "");
    setCycleId(item.cycleId ?? "");
    setBrainRefs(item.brainRefs ?? []);
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
        parentId: parentId || undefined,
        cycleId: cycleId || undefined,
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
  const stories = snap?.stories ?? [];
  const cycles = snap?.cycles ?? [];
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
            <div className="work-drawer-field work-drawer-field--wide work-drawer-field--module">
              <span className="work-drawer-field-label work-drawer-field-label--module">
                <Icon name="columns-2" size={12} />
                Module
              </span>
              <WorkModulePicker
                modules={modules}
                value={moduleId}
                allowClear
                onChange={(next) => {
                  setModuleId(next);
                  if (!isCreate && item) void onUpdate({ moduleId: next });
                }}
              />
            </div>
          )}
          {stories.length > 0 && (
            <div className="work-drawer-field work-drawer-field--wide">
              <span className="work-drawer-field-label">Story</span>
              <div className="work-drawer-field-control">
              <select
                className="work-drawer-field-select"
                value={parentId}
                onChange={(e) => {
                  const next = e.target.value;
                  setParentId(next);
                  if (!isCreate && item) void onUpdate({ parentId: next || undefined });
                }}
                aria-label="Parent story"
              >
                <option value="">None</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shortId} — {s.title}
                  </option>
                ))}
              </select>
              </div>
            </div>
          )}
          {cycles.length > 0 && (
            <div className="work-drawer-field work-drawer-field--wide">
              <span className="work-drawer-field-label">Cycle</span>
              <div className="work-drawer-field-control">
              <select
                className="work-drawer-field-select"
                value={cycleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setCycleId(next);
                  if (!isCreate && item) void onUpdate({ cycleId: next || undefined });
                }}
                aria-label="Cycle"
              >
                <option value="">None</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              </div>
            </div>
          )}
          <WorkDrawerField label="Status" icon="play">
            <WorkStatusPicker
              value={status}
              onChange={(next) => {
                setStatus(next);
                if (!isCreate && item) void onUpdate({ status: next });
              }}
            />
          </WorkDrawerField>
          <WorkDrawerField label="Priority" icon="zap">
            <WorkPriorityPicker
              value={priority}
              onChange={(next) => {
                setPriority(next);
                if (!isCreate && item) void onUpdate({ priority: next });
              }}
            />
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
              <span className="work-drawer-field-label work-drawer-field-label--meta">
                <Icon name="hash" size={12} />
                Labels
              </span>
              <div className="work-drawer-labels">
                {labels.map((l) => {
                  const active = labelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={`work-drawer-meta-chip work-drawer-meta-chip--label${
                        active ? " active" : ""
                      }`}
                      style={labelChipStyle(l, active)}
                      onClick={() => toggleLabel(l.id)}
                    >
                      <Icon name="hash" size={11} />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!isCreate && item && snap && (
            <WorksDocRefsSection
              wsId={req.wsId}
              root={req.root}
              snap={snap}
              work={item}
              extraRefs={brainRefs}
              onExtraRefsChange={(refs) => {
                setBrainRefs(refs);
                void onUpdate({ brainRefs: refs });
              }}
            />
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

function labelChipStyle(
  label: { color: string },
  active: boolean,
): React.CSSProperties | undefined {
  if (!label.color) return undefined;
  const mix = active ? 22 : 12;
  return {
    borderColor: `color-mix(in srgb, ${label.color} 40%, var(--border))`,
    background: `color-mix(in srgb, ${label.color} ${mix}%, var(--bg-alt))`,
    color: label.color,
  };
}

function WorkDrawerField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <div className="work-drawer-field">
      <span className="work-drawer-field-label work-drawer-field-label--meta">
        {icon ? <Icon name={icon} size={12} /> : null}
        {label}
      </span>
      <div className="work-drawer-field-control">{children}</div>
    </div>
  );
}
