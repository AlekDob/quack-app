import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errMsg, error as toastError, success as toastSuccess } from "../../notify";
import { useModalFocus } from "../../useModalFocus";
import {
  closeStoryDrawer,
  getStoryDrawer,
  isStoryDrawerCreate,
  openStoryDrawer,
  subscribeStoryDrawer,
  type StoryDrawerRequest,
} from "../../storyDrawer";
import { openWorkDrawer } from "../../workDrawer";
import {
  childrenOfStory,
  createStory,
  createWorkFromStory,
  hydrateWorks,
  subscribeWorks,
  updateStory,
} from "../../worksCache";
import {
  findStory,
  storyLabel,
  type WorkBlock,
  type WorkStory,
  type WorksSnapshot,
} from "../../works";
import { blocksToMarkdown, markdownToBlocks } from "../../worksBlocks";
import { formatModuleLabel, sortWorkModules } from "../../worksUi";
import {
  drawerPortalTarget,
  isNestedDrawerPortal,
  subscribeDrawerPortal,
} from "../../editorDrawerStack";
import { joinPath } from "../../pathUtils";
import { useStore } from "../../store";
import { Icon } from "../Icon";
import { WorkItemEditor } from "./WorkItemEditor";
import { WorksDocRefsSection } from "./WorksDocRefsSection";
import { useResizableWorkDrawerWidth } from "../../useResizableWorkDrawerWidth";

export function StoryDrawer() {
  const [req, setReq] = useState<StoryDrawerRequest | null>(getStoryDrawer());
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [shown, setShown] = useState(false);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [status, setStatus] = useState<WorkStory["status"]>("draft");
  const [moduleId, setModuleId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [brainRefs, setBrainRefs] = useState<string[]>([]);
  const [createBusy, setCreateBusy] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [, bumpPortal] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const blocksDirty = useRef(false);
  const { width, onResizeDown } = useResizableWorkDrawerWidth();
  useModalFocus(panelRef, shown && !!req);

  const isCreate = req ? isStoryDrawerCreate(req) : false;
  const story =
    req && snap && !isCreate && "storyId" in req
      ? findStory(snap, req.storyId)
      : undefined;
  const modules = snap?.modules ?? [];
  const cycles = snap?.cycles ?? [];
  const children = story && snap ? childrenOfStory(snap, story.id) : [];

  useEffect(() => subscribeStoryDrawer(setReq), []);
  useEffect(() => subscribeDrawerPortal(() => bumpPortal((n) => n + 1)), []);

  const seedCreate = useCallback((next: StoryDrawerRequest) => {
    const d = isStoryDrawerCreate(next) ? next.draft : undefined;
    setTitle(d?.title ?? "");
    setBlocks(markdownToBlocks(d?.bodyMd ?? ""));
    setStatus(d?.status ?? "draft");
    setModuleId(d?.moduleId ?? "");
    setCycleId(d?.cycleId ?? "");
    setWorkTitle("");
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
      if (isStoryDrawerCreate(req)) {
        seedCreate(req);
        const fallback =
          req.draft?.moduleId ??
          next.modules.find((m) => m.featurePath)?.id ??
          next.modules[0]?.id ??
          "";
        setModuleId(fallback);
        setCycleId(req.draft?.cycleId ?? next.cycles.find((c) => c.status === "active")?.id ?? "");
      } else {
        const s = findStory(next, req.storyId);
        if (s) {
          setTitle(s.title);
          setStatus(s.status);
          setModuleId(s.moduleId);
          setCycleId(s.cycleId ?? "");
          setBrainRefs(s.brainRefs ?? []);
          setBlocks(markdownToBlocks(s.bodyMd ?? ""));
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
  }, [req, seedCreate]);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(() => closeStoryDrawer(), 220);
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, close]);

  useEffect(() => {
    if (!story || isCreate) return;
    setBrainRefs(story.brainRefs ?? []);
  }, [story, isCreate]);

  const onUpdate = async (patch: Partial<WorkStory>) => {
    if (!req || !story) return;
    try {
      await updateStory(req.root, story.id, patch);
    } catch (e) {
      toastError(`Couldn't update story: ${errMsg(e)}`);
    }
  };

  const onBlocksChange = (next: WorkBlock[]) => {
    blocksDirty.current = true;
    setBlocks(next);
    if (isCreate || !story) return;
    void onUpdate({ bodyMd: blocksToMarkdown(next) });
  };

  const onCreate = async () => {
    if (!req || !isCreate) return;
    setCreateBusy(true);
    try {
      const s = await createStory(req.root, {
        title: title.trim() || "Untitled story",
        moduleId: moduleId || undefined,
        cycleId: cycleId || undefined,
        status,
        bodyMd: blocksToMarkdown(blocks),
      });
      openStoryDrawer({ wsId: req.wsId, root: req.root, storyId: s.id });
      toastSuccess(`Created ${s.shortId}`);
    } catch (e) {
      toastError(`Couldn't create story: ${errMsg(e)}`);
    } finally {
      setCreateBusy(false);
    }
  };

  const addWorkItem = async () => {
    if (!req || !story) return;
    const t = workTitle.trim() || `Task for ${story.shortId}`;
    try {
      const w = await createWorkFromStory(req.root, story.id, { title: t });
      if (w) {
        openWorkDrawer({ wsId: req.wsId, root: req.root, workId: w.id });
        setWorkTitle("");
        toastSuccess(`Created ${w.shortId}`);
      }
    } catch (e) {
      toastError(`Couldn't create work item: ${errMsg(e)}`);
    }
  };

  if (!req || (!isCreate && !story)) return null;

  const portal = drawerPortalTarget(req.wsId);
  const nested = isNestedDrawerPortal(portal);
  const heroId = isCreate ? "Draft" : story!.shortId;

  const openStoryFile = () => {
    if (!req || !story) return;
    void useStore.getState().openFile(req.wsId, joinPath(req.root, story.filePath));
    close();
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
        aria-label={isCreate ? "New story" : story!.title}
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
              <span className="work-drawer-module">User story</span>
            </div>
            <div className="work-drawer-hero-actions">
              {!isCreate && (
                <button
                  type="button"
                  className="work-drawer-icon-btn"
                  onClick={openStoryFile}
                  title="Open story file"
                  aria-label="Open story file"
                >
                  <Icon name="file-text" size={14} />
                </button>
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
            onBlur={() => {
              const t = title.trim();
              if (!t) return;
              if (isCreate) setTitle(t);
              else if (story && t !== story.title) void onUpdate({ title: t });
            }}
            placeholder="As a user I want…"
            aria-label="Title"
          />
        </header>

        <section className="work-drawer-fields" aria-label="Properties">
          {modules.length > 0 && (
            <StoryField label="Module" wide>
              <select
                className="work-drawer-field-select"
                value={moduleId}
                onChange={(e) => {
                  const next = e.target.value;
                  setModuleId(next);
                  if (!isCreate && story) void onUpdate({ moduleId: next });
                }}
              >
                {sortWorkModules(modules).map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatModuleLabel(m)}
                  </option>
                ))}
              </select>
            </StoryField>
          )}
          <StoryField label="Cycle">
            <select
              className="work-drawer-field-select"
              value={cycleId}
              onChange={(e) => {
                const next = e.target.value;
                setCycleId(next);
                if (!isCreate && story) {
                  void onUpdate({ cycleId: next || undefined });
                }
              }}
            >
              <option value="">None</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </StoryField>
          <StoryField label="Status">
            <select
              className="work-drawer-field-select"
              value={status}
              onChange={(e) => {
                const next = e.target.value as WorkStory["status"];
                setStatus(next);
                if (!isCreate && story) void onUpdate({ status: next });
              }}
            >
              {(["draft", "active", "done"] as const).map((s) => (
                <option key={s} value={s}>
                  {storyLabel(s)}
                </option>
              ))}
            </select>
          </StoryField>
          {!isCreate && story && snap && (
            <WorksDocRefsSection
              wsId={req.wsId}
              root={req.root}
              snap={snap}
              story={story}
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
            {!isCreate && story && (
              <section className="works-story-children">
                <h3 className="works-story-children-title">Backlog work items</h3>
                <ul className="works-story-children-list">
                  {children.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        className="works-story-child-btn"
                        onClick={() =>
                          openWorkDrawer({
                            wsId: req.wsId,
                            root: req.root,
                            workId: w.id,
                          })
                        }
                      >
                        <span className="works-story-child-id">{w.shortId}</span>
                        <span className="works-story-child-title">{w.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="works-story-add-work">
                  <input
                    type="text"
                    className="work-drawer-field-input"
                    placeholder="New work item title…"
                    value={workTitle}
                    onChange={(e) => setWorkTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addWorkItem();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="works-new-btn"
                    onClick={() => void addWorkItem()}
                  >
                    <Icon name="plus" size={12} /> Add work item
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        {isCreate && (
          <footer className="work-drawer-footer">
            <button type="button" className="work-drawer-btn work-drawer-btn--ghost" onClick={close}>
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

function StoryField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`work-drawer-field${wide ? " work-drawer-field--wide" : ""}`}>
      <span className="work-drawer-field-label">{label}</span>
      <div className="work-drawer-field-control">{children}</div>
    </div>
  );
}
