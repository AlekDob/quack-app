import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { errMsg, error as toastError, info as toastInfo } from "../../notify";
import {
  createFeatureDoc,
  listFeatures,
  type FeatureEntry,
} from "../../featureCatalog";
import {
  openFeatureDocDrawer,
  subscribeFeatureDocDrawer,
} from "../../featureDocDrawer";
import { useStore } from "../../store";
import { Icon } from "../Icon";
import { WorksFeaturesCatalog } from "./WorksFeaturesCatalog";
import { FeaturesTimelineView } from "./FeaturesTimelineView";

type Props = {
  wsId: string;
  root: string;
  container: HTMLElement | null;
  visible: boolean;
};

type FeaturesLayout = "list" | "timeline";

/** Features pane — catalog + timeline of documentation/features/*.md. */
export function WorksPane({ wsId, root, container, visible }: Props) {
  const wsName = useStore((s) => s.loaded[wsId]?.meta.name ?? "Workspace");
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [layout, setLayout] = useState<FeaturesLayout>("list");
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setFeatures(await listFeatures(root));
    } catch (e) {
      toastError(`Couldn't load features: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    void reload();
  }, [visible, reload]);

  useEffect(() => {
    return subscribeFeatureDocDrawer((req) => {
      if (req?.root === root) setActivePath(req.featurePath);
      else setActivePath(null);
    });
  }, [root]);

  const openFeature = (f: FeatureEntry) => {
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: f.path,
      title: f.title,
      featureNum: f.featureNum,
    });
    setActivePath(f.path);
  };

  const onCreate = async () => {
    const title = window.prompt("Feature title", "New feature");
    if (!title?.trim()) return;
    try {
      const created = await createFeatureDoc(root, title.trim());
      await reload();
      openFeature(created);
      toastInfo(`Created ${created.slug}`);
    } catch (e) {
      toastError(`Couldn't create feature: ${errMsg(e)}`);
    }
  };

  if (!container || !visible) return null;

  const filtered =
    !query.trim()
      ? features
      : features.filter((f) => {
          const q = query.trim().toLowerCase();
          return (
            f.title.toLowerCase().includes(q) ||
            f.slug.toLowerCase().includes(q) ||
            f.path.toLowerCase().includes(q) ||
            f.status.includes(q)
          );
        });

  return createPortal(
    <div className="works-root works-root--features">
      <header className="works-toolbar">
        <div className="works-crumb">
          <span className="works-crumb-seg">{wsName}</span>
          <Icon name="chevron-right" size={12} />
          <span className="works-crumb-seg works-crumb-active">Features</span>
          <span className="works-count">{features.length}</span>
        </div>
        <div className="works-toolbar-actions">
          <label className="works-features-toolbar-search">
            <Icon name="search" size={13} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search features"
            />
          </label>
          <div className="works-view-icons" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              className={`works-view-icon${layout === "list" ? " active" : ""}`}
              title="List"
              aria-label="List"
              aria-selected={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <Icon name="file-text" size={14} />
            </button>
            <button
              type="button"
              role="tab"
              className={`works-view-icon${
                layout === "timeline" ? " active" : ""
              }`}
              title="Timeline"
              aria-label="Timeline"
              aria-selected={layout === "timeline"}
              onClick={() => setLayout("timeline")}
            >
              <Icon name="chart-bar" size={14} />
            </button>
          </div>
          <button
            type="button"
            className="works-new-btn"
            onClick={() => void onCreate()}
          >
            <Icon name="plus" size={12} /> Add feature
          </button>
        </div>
      </header>
      <div className="works-stage">
        <main
          className={`works-main${
            layout === "timeline"
              ? " works-main--timeline"
              : " works-main--catalog"
          }`}
        >
          {layout === "list" && (
            <WorksFeaturesCatalog
              features={filtered}
              loading={loading}
              activePath={activePath}
              onOpen={openFeature}
              query={query}
            />
          )}
          {layout === "timeline" && !loading && (
            <FeaturesTimelineView
              root={root}
              features={filtered}
              selectedPath={activePath}
              onOpen={openFeature}
              onDatesSaved={() => void reload()}
            />
          )}
          {layout === "timeline" && loading && (
            <div className="works-status">Loading…</div>
          )}
        </main>
      </div>
    </div>,
    container,
  );
}

export function openWorksTab(wsId: string): void {
  useStore.getState().worksOpen(wsId);
}
