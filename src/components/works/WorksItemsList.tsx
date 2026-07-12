import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { highlightBrainText } from "../../brainHighlight";
import {
  buildWorksListGroups,
  countVisibleWorks,
  type WorksListGroup,
} from "../../worksListGroups";
import {
  formatModuleLabel,
  formatWorkHitTitle,
  modulePathLine,
} from "../../worksUi";
import {
  priorityDotClass,
  statusLabel,
  storyLabel,
  type WorkItem,
  type WorkModule,
  type WorkStory,
} from "../../works";
import { BrainSearchSkeleton } from "../brain/BrainSearchResults";
import { Icon } from "../Icon";

type Props = {
  items: WorkItem[];
  stories: WorkStory[];
  modules: WorkModule[];
  selectedId: string | null;
  selectedStoryId: string | null;
  onOpen: (id: string) => void;
  onOpenStory: (id: string) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
};

function StoryHitRow({
  story,
  module,
  childCount,
  index,
  query,
  active,
  onOpen,
}: {
  story: WorkStory;
  module?: WorkModule;
  childCount: number;
  index: number;
  query: string;
  active: boolean;
  onOpen: () => void;
}) {
  const title = `${story.shortId} · ${story.title}`;
  const path = modulePathLine(module);
  return (
    <li className="works-list-story-wrap">
      <button
        type="button"
        className={`brain-hit-row works-story-hit-row${active ? " active" : ""}`}
        style={{ "--i": index } as CSSProperties}
        onClick={onOpen}
        title={path}
      >
        <span className="brain-hit-icon works-story-hit-icon" aria-hidden>
          <Icon name="users" size={15} />
        </span>
        <span className="brain-hit-body">
          <span className="brain-hit-top">
            <span className="brain-hit-title">
              {highlightBrainText(title, query)}
            </span>
            <span className={`works-story-pill works-story-pill--${story.status}`}>
              {storyLabel(story.status)}
            </span>
          </span>
          <span className="brain-hit-path">
            {module ? formatModuleLabel(module) : "No module"}
            {childCount > 0
              ? ` · ${childCount} work item${childCount === 1 ? "" : "s"}`
              : " · No linked work items"}
          </span>
        </span>
        <Icon name="chevron-right" size={14} className="brain-hit-chevron" />
      </button>
    </li>
  );
}

function WorkHitRow({
  item,
  module,
  index,
  query,
  active,
  nested,
  onOpen,
  onContextMenu,
}: {
  item: WorkItem;
  module?: WorkModule;
  index: number;
  query: string;
  active: boolean;
  nested?: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const title = formatWorkHitTitle(item);
  const path = modulePathLine(module);
  return (
    <li className={nested ? "works-list-child-wrap" : undefined}>
      <button
        type="button"
        className={`brain-hit-row works-work-hit-row${active ? " active" : ""}${
          nested ? " works-work-hit-row--nested" : ""
        }`}
        style={{ "--i": index } as CSSProperties}
        onClick={onOpen}
        onContextMenu={onContextMenu}
        title={path}
      >
        <span className="brain-hit-icon works-work-hit-icon" aria-hidden>
          <Icon name="check-square" size={15} />
        </span>
        <span className="brain-hit-body">
          <span className="brain-hit-top">
            <span
              className={`works-priority-dot ${priorityDotClass(item.priority)}`}
              aria-hidden
            />
            <span className="brain-hit-title">
              {highlightBrainText(title, query)}
            </span>
            <span className={`works-state-pill works-state-${item.status}`}>
              {statusLabel(item.status)}
            </span>
          </span>
          <span className="brain-hit-path">
            {module ? formatModuleLabel(module) : "No module"}
            {module?.featurePath ? ` — ${module.featurePath}` : ""}
          </span>
        </span>
        <Icon name="chevron-right" size={14} className="brain-hit-chevron" />
      </button>
    </li>
  );
}

function renderGroup(
  group: WorksListGroup,
  startIndex: number,
  ctx: {
    modById: Map<string, WorkModule>;
    query: string;
    selectedId: string | null;
    selectedStoryId: string | null;
    onOpen: (id: string) => void;
    onOpenStory: (id: string) => void;
    onContextMenu: (id: string, e: React.MouseEvent) => void;
  },
): { nodes: React.ReactNode[]; nextIndex: number } {
  const nodes: React.ReactNode[] = [];
  let i = startIndex;

  if (group.kind === "story") {
    nodes.push(
      <StoryHitRow
        key={`story-${group.story.id}`}
        story={group.story}
        module={ctx.modById.get(group.story.moduleId)}
        childCount={group.children.length}
        index={i++}
        query={ctx.query}
        active={ctx.selectedStoryId === group.story.id}
        onOpen={() => ctx.onOpenStory(group.story.id)}
      />,
    );
    for (const child of group.children) {
      nodes.push(
        <WorkHitRow
          key={child.id}
          item={child}
          module={ctx.modById.get(child.moduleId)}
          index={i++}
          query={ctx.query}
          active={ctx.selectedId === child.id}
          nested
          onOpen={() => ctx.onOpen(child.id)}
          onContextMenu={(e) => ctx.onContextMenu(child.id, e)}
        />,
      );
    }
    return { nodes, nextIndex: i };
  }

  nodes.push(
    <WorkHitRow
      key={group.item.id}
      item={group.item}
      module={ctx.modById.get(group.item.moduleId)}
      index={i++}
      query={ctx.query}
      active={ctx.selectedId === group.item.id}
      onOpen={() => ctx.onOpen(group.item.id)}
      onContextMenu={(e) => ctx.onContextMenu(group.item.id, e)}
    />,
  );
  return { nodes, nextIndex: i };
}

export function WorksItemsList({
  items,
  stories,
  modules,
  selectedId,
  selectedStoryId,
  onOpen,
  onOpenStory,
  onContextMenu,
}: Props) {
  const [query, setQuery] = useState("");
  const [mounting, setMounting] = useState(true);
  const modById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  useEffect(() => {
    setMounting(true);
    const t = window.setTimeout(() => setMounting(false), 360);
    return () => window.clearTimeout(t);
  }, []);

  const groups = useMemo(
    () => buildWorksListGroups(stories, items, modules, query),
    [stories, items, modules, query],
  );

  const workCount = useMemo(() => countVisibleWorks(groups), [groups]);
  const showEmpty = !mounting && query.trim() && groups.length === 0;

  const rows = useMemo(() => {
    const ctx = {
      modById,
      query,
      selectedId,
      selectedStoryId,
      onOpen,
      onOpenStory,
      onContextMenu,
    };
    const out: React.ReactNode[] = [];
    let idx = 0;
    for (const g of groups) {
      const { nodes, nextIndex } = renderGroup(g, idx, ctx);
      out.push(...nodes);
      idx = nextIndex;
    }
    return out;
  }, [
    groups,
    modById,
    query,
    selectedId,
    selectedStoryId,
    onOpen,
    onOpenStory,
    onContextMenu,
  ]);

  return (
    <div className="works-items-catalog">
      <div className="brain-search-zone works-features-search">
        <div className={`brain-search-bar${query.trim() ? " is-searching" : ""}`}>
          <Icon name="search" size={14} className="brain-search-icon" />
          <input
            className="brain-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work items and stories…"
            aria-label="Search work items and stories"
          />
        </div>
      </div>

      {mounting && <BrainSearchSkeleton rows={6} />}

      {!mounting && groups.length > 0 && (
        <section className="brain-results-section">
          <p className="brain-results-head">
            {workCount} work item{workCount === 1 ? "" : "s"}
            {stories.length > 0
              ? ` · ${groups.filter((g) => g.kind === "story").length} stor${
                  groups.filter((g) => g.kind === "story").length === 1 ? "y" : "ies"
                }`
              : ""}
          </p>
          <ul className="brain-results works-grouped-results">{rows}</ul>
        </section>
      )}

      {showEmpty && (
        <div className="brain-search-empty">
          <Icon name="search" size={20} />
          <p>No matches for &ldquo;{query.trim()}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
