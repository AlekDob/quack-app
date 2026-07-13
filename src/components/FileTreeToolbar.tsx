import { Icon } from "./Icon";

interface Props {
  query: string;
  busy: boolean;
  onQueryChange: (q: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function FileTreeToolbar({
  query,
  busy,
  onQueryChange,
  onExpandAll,
  onCollapseAll,
}: Props) {
  return (
    <div className="tree-toolbar">
      <div className="tree-filter-wrap">
        <Icon name="search" size={12} className="tree-filter-icon" />
        <input
          type="text"
          className="tree-filter-input"
          placeholder="Filter files…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Filter files"
        />
        {busy && <span className="tree-filter-busy" aria-hidden="true" />}
      </div>
      <button
        type="button"
        className="tree-toolbar-btn"
        title="Expand all"
        aria-label="Expand all folders"
        onClick={onExpandAll}
      >
        <Icon name="chevron-down" size={12} />
      </button>
      <button
        type="button"
        className="tree-toolbar-btn"
        title="Collapse all"
        aria-label="Collapse all folders"
        onClick={onCollapseAll}
      >
        <Icon name="chevron-right" size={12} />
      </button>
    </div>
  );
}
