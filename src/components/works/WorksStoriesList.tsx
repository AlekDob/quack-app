import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { highlightBrainText } from "../../brainHighlight";
import { formatModuleLabel, modulePathLine } from "../../worksUi";
import { storyLabel, type WorkModule, type WorkStory } from "../../works";
import { BrainSearchSkeleton } from "../brain/BrainSearchResults";
import { Icon } from "../Icon";

type Props = {
  stories: WorkStory[];
  modules: WorkModule[];
  childCounts: Map<string, number>;
  selectedId: string | null;
  onOpen: (id: string) => void;
};

function filterStories(
  stories: WorkStory[],
  modules: WorkModule[],
  query: string,
): WorkStory[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return stories;
  const modById = new Map(modules.map((m) => [m.id, m]));
  return stories.filter((s) => {
    const mod = modById.get(s.moduleId);
    const hay = [s.shortId, s.title, s.status, mod?.name, mod?.featurePath]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function WorksStoriesList({
  stories,
  modules,
  childCounts,
  selectedId,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const modById = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 120);
    return () => window.clearTimeout(t);
  }, [query]);

  const filtered = useMemo(
    () => filterStories(stories, modules, debounced),
    [stories, modules, debounced],
  );

  return (
    <div className="works-stories-catalog">
      <div className="works-catalog-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          placeholder="Search stories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search stories"
        />
      </div>
      {debounced !== query && <BrainSearchSkeleton rows={4} />}
      {debounced === query && filtered.length === 0 && (
        <div className="works-empty works-empty--center">
          <div className="works-empty-title">No stories</div>
          <div className="works-empty-hint">
            {stories.length === 0
              ? "Create a user story to group backlog work items."
              : "No matches for your search."}
          </div>
        </div>
      )}
      {debounced === query && filtered.length > 0 && (
        <ul className="brain-hit-list">
          {filtered.map((s, i) => {
            const mod = modById.get(s.moduleId);
            const kids = childCounts.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`brain-hit-row${selectedId === s.id ? " active" : ""}`}
                  style={{ "--i": i } as CSSProperties}
                  onClick={() => onOpen(s.id)}
                  title={modulePathLine(mod)}
                >
                  <span className="brain-hit-icon works-story-hit-icon" aria-hidden>
                    <Icon name="users" size={15} />
                  </span>
                  <span className="brain-hit-body">
                    <span className="brain-hit-top">
                      <span className="brain-hit-id">{s.shortId}</span>
                      <span className="brain-hit-title">
                        {highlightBrainText(s.title, debounced)}
                      </span>
                    </span>
                    <span className="brain-hit-meta">
                      {storyLabel(s.status)}
                      {mod ? ` · ${formatModuleLabel(mod)}` : ""}
                      {kids > 0 ? ` · ${kids} work item${kids === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
