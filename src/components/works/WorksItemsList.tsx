import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { highlightBrainText } from "../../brainHighlight";
import {
  formatModuleLabel,
  formatWorkHitTitle,
  modulePathLine,
} from "../../worksUi";
import { priorityDotClass, statusLabel, type WorkItem, type WorkModule } from "../../works";
import { BrainSearchSkeleton } from "../brain/BrainSearchResults";
import { Icon } from "../Icon";

type Props = {
  items: WorkItem[];
  modules: WorkModule[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
};

function filterItems(items: WorkItem[], modules: WorkModule[], query: string): WorkItem[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return items;
  const modById = new Map(modules.map((m) => [m.id, m]));
  return items.filter((w) => {
    const mod = modById.get(w.moduleId);
    const hay = [
      w.shortId,
      w.title,
      w.status,
      w.priority,
      mod?.name,
      mod?.featurePath,
      mod?.featureSlug,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function WorkHitRow({
  item,
  module,
  index,
  query,
  active,
  onOpen,
  onContextMenu,
}: {
  item: WorkItem;
  module?: WorkModule;
  index: number;
  query: string;
  active: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const title = formatWorkHitTitle(item);
  const path = modulePathLine(module);
  return (
    <li>
      <button
        type="button"
        className={`brain-hit-row${active ? " active" : ""}`}
        style={{ "--i": index } as CSSProperties}
        onClick={onOpen}
        onContextMenu={onContextMenu}
        title={path}
      >
        <span className="brain-hit-icon" aria-hidden>
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

export function WorksItemsList({
  items,
  modules,
  selectedId,
  onOpen,
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

  const filtered = useMemo(
    () => filterItems(items, modules, query),
    [items, modules, query],
  );

  const showEmpty = !mounting && query.trim() && filtered.length === 0;

  return (
    <div className="works-items-catalog">
      <div className="brain-search-zone works-features-search">
        <div className={`brain-search-bar${query.trim() ? " is-searching" : ""}`}>
          <Icon name="search" size={14} className="brain-search-icon" />
          <input
            className="brain-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work items…"
            aria-label="Search work items"
          />
        </div>
      </div>

      {mounting && <BrainSearchSkeleton rows={6} />}

      {!mounting && filtered.length > 0 && (
        <section className="brain-results-section">
          <p className="brain-results-head">
            {filtered.length} work item{filtered.length === 1 ? "" : "s"}
          </p>
          <ul className="brain-results">
            {filtered.map((w, i) => (
              <WorkHitRow
                key={w.id}
                item={w}
                module={modById.get(w.moduleId)}
                index={i}
                query={query}
                active={selectedId === w.id}
                onOpen={() => onOpen(w.id)}
                onContextMenu={(e) => onContextMenu(w.id, e)}
              />
            ))}
          </ul>
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
