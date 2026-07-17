import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { errMsg, error as toastError } from "../../notify";
import {
  refreshWorksModules,
  saveWorks,
  subscribeWorks,
  updateWorkItem,
} from "../../worksCache";
import { startWorksWatchOnce } from "../../worksWatch";
import { useWorkItemContextMenu } from "./useWorkItemContextMenu";
import { useStoryContextMenu } from "./useStoryContextMenu";
import {
  type WorkItem,
  type WorksLayout,
  type WorksSnapshot,
} from "../../works";
import {
  filterItemsByView,
  isCatalogView,
  worksViewLabel,
  type WorksSidebarView,
} from "../../worksViews";
import { useStore } from "../../store";
import { Icon } from "../Icon";
import {
  openWorkCreateDrawer,
  openWorkDrawer,
  subscribeWorkDrawer,
} from "../../workDrawer";
import {
  openStoryCreateDrawer,
  openStoryDrawer,
  subscribeStoryDrawer,
} from "../../storyDrawer";
import {
  openFeatureDocDrawer,
  subscribeFeatureDocDrawer,
} from "../../featureDocDrawer";
import { WorksKanbanView } from "./WorksKanbanView";
import { WorksPlanePanel } from "./WorksPlanePanel";
import { WorksTimelineView } from "./WorksTimelineView";
import { WorksViewsRail } from "./WorksViewsRail";
import { WorksItemsList } from "./WorksItemsList";
import { WorksFeaturesCatalog } from "./WorksFeaturesCatalog";
import { WorksCyclesPanel } from "./WorksCyclesPanel";
import { WorksStoriesList } from "./WorksStoriesList";
import { WorksMergeDupesButton } from "./WorksMergeDupesButton";
import { getWorkspaceColor } from "../../workspaceColors";

type Props = {
  wsId: string;
  root: string;
  container: HTMLElement | null;
  visible: boolean;
};

const LAYOUTS: {
  id: WorksLayout;
  label: string;
  icon: "file-text" | "columns-2" | "chart-bar";
}[] = [
  { id: "list", label: "List", icon: "file-text" },
  { id: "kanban", label: "Board", icon: "columns-2" },
  { id: "timeline", label: "Timeline", icon: "chart-bar" },
];

export function WorksPane({ wsId, root, container, visible }: Props) {
  const wsName = useStore((s) => s.loaded[wsId]?.meta.name ?? "Workspace");
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeFeaturePath, setActiveFeaturePath] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      await refreshWorksModules(root);
    } catch (e) {
      toastError(`Couldn't load works: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    startWorksWatchOnce();
    void reload();
    return subscribeWorks(root, setSnap);
  }, [root, visible, reload]);

  useEffect(() => {
    return subscribeWorkDrawer((req) => {
      if (req?.root === root) {
        setSelectedId("workId" in req ? req.workId : null);
      } else setSelectedId(null);
    });
  }, [root]);

  useEffect(() => {
    return subscribeStoryDrawer((req) => {
      if (req?.root === root) {
        setSelectedStoryId("storyId" in req ? req.storyId : null);
      } else setSelectedStoryId(null);
    });
  }, [root]);

  useEffect(() => {
    return subscribeFeatureDocDrawer((req) => {
      if (req?.root === root) setActiveFeaturePath(req.featurePath);
      else setActiveFeaturePath(null);
    });
  }, [root]);

  const openStory = (id: string) => {
    openStoryDrawer({ wsId, root, storyId: id });
    setSelectedStoryId(id);
  };

  const openWork = (id: string) => {
    openWorkDrawer({ wsId, root, workId: id });
    setSelectedId(id);
  };

  const openFeature = (m: {
    id: string;
    name: string;
    featurePath?: string;
    featureNum?: number;
  }) => {
    if (!m.featurePath) return;
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: m.featurePath,
      title: m.name,
      featureNum: m.featureNum,
    });
    setActiveFeaturePath(m.featurePath);
  };

  const featureModules = useMemo(
    () => (snap?.modules ?? []).filter((m) => m.featurePath),
    [snap?.modules],
  );

  const sidebarView: WorksSidebarView =
    snap?.viewPrefs.sidebarView ?? "all";
  const isModulesView = sidebarView === "modules";
  const isCyclesView = sidebarView === "cycles";
  const isStoriesView = sidebarView === "stories";
  const isCatalog = isCatalogView(sidebarView);
  const activeCycleId =
    snap?.viewPrefs.activeCycleId ??
    snap?.cycles.find((c) => c.status === "active")?.id ??
    null;

  const allItems = useMemo(() => {
    if (!snap) return [];
    return [...snap.items].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [snap]);

  const items = useMemo(
    () => filterItemsByView(allItems, sidebarView),
    [allItems, sidebarView],
  );

  const storyChildCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of snap?.items ?? []) {
      if (!w.parentId) continue;
      counts.set(w.parentId, (counts.get(w.parentId) ?? 0) + 1);
    }
    return counts;
  }, [snap?.items]);

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of snap?.items ?? []) {
      counts.set(w.moduleId, (counts.get(w.moduleId) ?? 0) + 1);
    }
    return counts;
  }, [snap?.items]);

  const layout = snap?.viewPrefs.layout ?? "list";

  const { onItemContextMenu, menuNode } = useWorkItemContextMenu(
    root,
    snap,
    openWork,
  );
  const { onStoryContextMenu, menuNode: storyMenuNode } = useStoryContextMenu(
    root,
    snap,
    openStory,
  );
  const storyAccent = getWorkspaceColor(wsId)?.hex ?? null;

  const setLayout = async (nextLayout: WorksLayout) => {
    if (!snap) return;
    await saveWorks(root, {
      ...snap,
      viewPrefs: { ...snap.viewPrefs, layout: nextLayout },
    });
  };

  const setSidebarView = async (view: WorksSidebarView) => {
    if (!snap) return;
    await saveWorks(root, {
      ...snap,
      viewPrefs: { ...snap.viewPrefs, sidebarView: view },
    });
  };

  const setActiveCycle = async (cycleId: string) => {
    if (!snap) return;
    await saveWorks(root, {
      ...snap,
      viewPrefs: { ...snap.viewPrefs, activeCycleId: cycleId },
    });
  };

  const onNewStory = () => {
    openStoryCreateDrawer({ wsId, root, draft: { title: "As a user I want…" } });
  };

  const onNewWork = () => {
    openWorkCreateDrawer({ wsId, root, draft: { title: "New work", origin: "manual" } });
  };

  const onDropStatus = async (id: string, status: WorkItem["status"]) => {
    try {
      await updateWorkItem(root, id, { status });
    } catch (e) {
      toastError(`Couldn't move card: ${errMsg(e)}`);
    }
  };

  if (!container || !visible) return null;

  const layoutLabel = LAYOUTS.find((v) => v.id === layout)?.label ?? "List";
  const crumbActive = worksViewLabel(sidebarView);

  return createPortal(
    <>
      <div className="works-root">
        <header className="works-toolbar">
          <div className="works-crumb">
            <span className="works-crumb-seg">{wsName}</span>
            <Icon name="chevron-right" size={12} />
            <span className="works-crumb-seg">Works</span>
            <Icon name="chevron-right" size={12} />
            <span className="works-crumb-seg works-crumb-active">
              {crumbActive}
            </span>
            {!isCatalog && (
              <span className="works-count">{items.length}</span>
            )}
            {isStoriesView && snap && (
              <span className="works-count">{snap.stories.length}</span>
            )}
          </div>
          <div className="works-toolbar-actions">
            {!isCatalog && (
              <>
                <div
                  className="works-view-icons"
                  role="tablist"
                  aria-label="View"
                >
                  {LAYOUTS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      className={`works-view-icon${
                        layout === v.id ? " active" : ""
                      }`}
                      title={v.label}
                      aria-label={v.label}
                      aria-selected={layout === v.id}
                      onClick={() => void setLayout(v.id)}
                    >
                      <Icon name={v.icon} size={14} />
                    </button>
                  ))}
                </div>
                <span className="works-toolbar-view-label">{layoutLabel}</span>
              </>
            )}
            <WorksPlanePanel wsId={wsId} root={root} snap={snap} />
            <WorksMergeDupesButton root={root} snap={snap} />
            {isStoriesView && (
              <button type="button" className="works-new-btn" onClick={onNewStory}>
                <Icon name="plus" size={12} /> Add story
              </button>
            )}
            {!isCatalog && (
              <button
                type="button"
                className="works-new-btn"
                onClick={onNewWork}
              >
                <Icon name="plus" size={12} /> Add work item
              </button>
            )}
          </div>
        </header>

        <div className="works-stage">
          <WorksViewsRail
            active={sidebarView}
            snap={snap}
            onSelect={(v) => void setSidebarView(v)}
          />

          <main
            className={`works-main${
              layout === "timeline" && !isCatalog
                ? " works-main--timeline"
                : ""
            }${
              isCatalog || layout === "list"
                ? " works-main--catalog"
                : ""
            }${isCyclesView ? " works-main--cycles" : ""}`}
          >
            {isModulesView && (
              <WorksFeaturesCatalog
                modules={featureModules}
                workCounts={moduleCounts}
                activePath={activeFeaturePath}
                onOpen={openFeature}
              />
            )}

            {isCyclesView && snap && (
              <WorksCyclesPanel
                snap={snap}
                selectedId={activeCycleId}
                onSelect={(id) => void setActiveCycle(id)}
                onOpenWork={openWork}
              />
            )}

            {isStoriesView && snap && (
              <WorksStoriesList
                stories={snap.stories}
                modules={snap.modules}
                childCounts={storyChildCounts}
                selectedId={selectedStoryId}
                onOpen={openStory}
                onContextMenu={onStoryContextMenu}
                storyAccent={storyAccent}
              />
            )}

            {!isCatalog && loading && (
              <div className="works-status">Loading…</div>
            )}
            {!isCatalog && !loading && items.length === 0 && (
              <div className="works-empty works-empty--center">
                <div className="works-empty-title">No work items</div>
                <div className="works-empty-hint">
                  Nothing matches this view yet.
                </div>
                <button
                  type="button"
                  className="works-new-btn"
                  onClick={onNewWork}
                >
                  <Icon name="plus" size={12} /> Add work item
                </button>
              </div>
            )}
            {!isCatalog && !loading && items.length > 0 && layout === "list" && (
              <WorksItemsList
                items={items}
                stories={snap?.stories ?? []}
                modules={snap?.modules ?? []}
                selectedId={selectedId}
                selectedStoryId={selectedStoryId}
                onOpen={openWork}
                onOpenStory={openStory}
                onContextMenu={onItemContextMenu}
                onStoryContextMenu={onStoryContextMenu}
                storyAccent={storyAccent}
              />
            )}
            {!isCatalog && !loading && items.length > 0 && layout === "kanban" && (
              <WorksKanbanView
                items={items}
                stories={snap?.stories ?? []}
                modules={snap?.modules ?? []}
                selectedStoryId={selectedStoryId}
                storyAccent={storyAccent}
                onOpen={openWork}
                onOpenStory={openStory}
                onDropStatus={(id, s) => void onDropStatus(id, s)}
                onItemContextMenu={onItemContextMenu}
                onStoryContextMenu={onStoryContextMenu}
              />
            )}
            {!isCatalog && !loading && items.length > 0 && layout === "timeline" && (
              <WorksTimelineView
                items={items}
                stories={snap?.stories ?? []}
                modules={snap?.modules ?? []}
                selectedId={selectedId}
                selectedStoryId={selectedStoryId}
                storyAccent={storyAccent}
                onOpen={openWork}
                onOpenStory={openStory}
                onItemContextMenu={onItemContextMenu}
                onStoryContextMenu={onStoryContextMenu}
                onDatesChange={(id, startDate, targetDate) =>
                  void updateWorkItem(root, id, { startDate, targetDate })
                }
              />
            )}
          </main>
        </div>
      </div>
      {menuNode}
      {storyMenuNode}
    </>,
    container,
  );
}

export function openWorksTab(wsId: string): void {
  useStore.getState().worksOpen(wsId);
}
