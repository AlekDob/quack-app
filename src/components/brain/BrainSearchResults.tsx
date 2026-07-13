// Cursor-style brain search results + shimmer skeleton while searching.

import type { CSSProperties } from "react";
import { Icon } from "../Icon";
import type { PinkySearchHit } from "../../pinky";
import { highlightBrainText } from "../../brainHighlight";

type HitProps = {
  hit: PinkySearchHit;
  index: number;
  query: string;
  onOpen: (hit: PinkySearchHit) => void;
};

export function BrainSearchSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="brain-search-loading" aria-busy="true">
      <p className="brain-search-shimmer brain-search-loading-label">
        Searching knowledge…
      </p>
      <ul className="brain-results brain-results-loading">
        {Array.from({ length: rows }, (_, i) => (
          <li
            key={i}
            className="brain-result-skeleton"
            style={{ "--i": i } as CSSProperties}
          >
            <div className="brain-sk-icon" />
            <div className="brain-sk-body">
              <div className="brain-sk-line title" />
              <div className="brain-sk-line meta" />
              <div className="brain-sk-line snippet" />
              <div className="brain-sk-line snippet short" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrainSearchHitRow({ hit, index, query, onOpen }: HitProps) {
  const kind = hit.entry_type ?? "note";
  const title = hit.title || hit.path;

  return (
    <li>
      <button
        type="button"
        className="brain-hit-row"
        style={{ "--i": index } as CSSProperties}
        onClick={() => onOpen(hit)}
        title={`Open ${hit.path}`}
      >
        <span className="brain-hit-icon" aria-hidden>
          <Icon name="brain" size={15} />
        </span>
        <span className="brain-hit-body">
          <span className="brain-hit-top">
            <span className="brain-hit-title">
              {highlightBrainText(title, query)}
            </span>
            <span className="brain-hit-type">{kind}</span>
          </span>
          <span className="brain-hit-path">{hit.path}</span>
          {hit.snippet && (
            <span className="brain-hit-snippet">
              {highlightBrainText(hit.snippet, query)}
            </span>
          )}
        </span>
        <Icon name="chevron-right" size={14} className="brain-hit-chevron" />
      </button>
    </li>
  );
}

export function BrainSearchEmpty({ query }: { query: string }) {
  return (
    <div className="brain-search-empty">
      <Icon name="search" size={20} />
      <p>No matches for &ldquo;{query}&rdquo;</p>
      <span className="brain-muted">
        Try different keywords or reindex documentation/
      </span>
    </div>
  );
}
