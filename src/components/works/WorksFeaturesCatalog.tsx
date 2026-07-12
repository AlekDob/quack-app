import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "../Icon";
import { highlightBrainText } from "../../brainHighlight";
import type { WorkModule } from "../../works";
import { BrainSearchSkeleton } from "../brain/BrainSearchResults";

type Props = {
  modules: WorkModule[];
  workCounts: Map<string, number>;
  activePath: string | null;
  onOpen: (m: WorkModule) => void;
};

function moduleLabel(m: WorkModule): string {
  if (m.featureNum != null) {
    return `${String(m.featureNum).padStart(3, "0")} · ${m.name}`;
  }
  return m.name;
}

function filterModules(modules: WorkModule[], query: string): WorkModule[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return modules;
  return modules.filter((m) => {
    const hay = [
      m.name,
      m.featureSlug,
      m.featurePath,
      m.featureNum != null ? String(m.featureNum) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function FeatureRow({
  mod,
  index,
  query,
  workCount,
  active,
  onOpen,
}: {
  mod: WorkModule;
  index: number;
  query: string;
  workCount: number;
  active: boolean;
  onOpen: () => void;
}) {
  const title = moduleLabel(mod);
  return (
    <li>
      <button
        type="button"
        className={`brain-hit-row${active ? " active" : ""}`}
        style={{ "--i": index } as CSSProperties}
        onClick={onOpen}
        title={mod.featurePath ?? mod.name}
      >
        <span className="brain-hit-icon" aria-hidden>
          <Icon name="file-text" size={15} />
        </span>
        <span className="brain-hit-body">
          <span className="brain-hit-top">
            <span className="brain-hit-title">
              {highlightBrainText(title, query)}
            </span>
            <span className="brain-hit-type">feature</span>
          </span>
          {mod.featurePath && (
            <span className="brain-hit-path">{mod.featurePath}</span>
          )}
        </span>
        {workCount > 0 && (
          <span className="works-feature-work-count">{workCount}</span>
        )}
        <Icon name="chevron-right" size={14} className="brain-hit-chevron" />
      </button>
    </li>
  );
}

export function WorksFeaturesCatalog({
  modules,
  workCounts,
  activePath,
  onOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [mounting, setMounting] = useState(true);

  useEffect(() => {
    setMounting(true);
    const t = window.setTimeout(() => setMounting(false), 360);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(
    () => filterModules(modules, query),
    [modules, query],
  );

  const showEmpty = !mounting && query.trim() && filtered.length === 0;

  return (
    <div className="works-features-catalog">
      <div className="brain-search-zone works-features-search">
        <div className={`brain-search-bar${query.trim() ? " is-searching" : ""}`}>
          <Icon name="search" size={14} className="brain-search-icon" />
          <input
            className="brain-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search features…"
            aria-label="Search features"
          />
        </div>
      </div>

      {mounting && <BrainSearchSkeleton rows={6} />}

      {!mounting && filtered.length > 0 && (
        <section className="brain-results-section">
          <p className="brain-results-head">
            {filtered.length} feature{filtered.length === 1 ? "" : "s"}
          </p>
          <ul className="brain-results">
            {filtered.map((m, i) => (
              <FeatureRow
                key={m.id}
                mod={m}
                index={i}
                query={query}
                workCount={workCounts.get(m.id) ?? 0}
                active={activePath === m.featurePath}
                onOpen={() => onOpen(m)}
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

      {!mounting && !query.trim() && modules.length === 0 && (
        <div className="works-empty works-empty--center">
          <div className="works-empty-title">No feature modules</div>
          <div className="works-empty-hint">
            Add markdown files under documentation/features/.
          </div>
        </div>
      )}
    </div>
  );
}
