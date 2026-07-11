import type { CSSProperties } from "react";

/** Cursor-style shimmer rows while model catalogs load. */
export function ModelPickerSkeleton({
  rows = 4,
  label = "Loading models…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="model-picker-loading" aria-busy="true" aria-live="polite">
      <p className="model-picker-loading-label brain-search-shimmer">{label}</p>
      <div className="model-picker-sk-list">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="model-picker-sk-row"
            style={{ "--i": i } as CSSProperties}
          >
            <div className="model-picker-sk-line name" />
            <div className="model-picker-sk-tag" />
            <div className="model-picker-sk-star" />
          </div>
        ))}
      </div>
    </div>
  );
}
