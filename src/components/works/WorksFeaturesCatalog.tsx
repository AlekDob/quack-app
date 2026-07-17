import type { CSSProperties } from "react";
import { Icon } from "../Icon";
import { highlightBrainText } from "../../brainHighlight";
import type { FeatureEntry } from "../../featureCatalog";
import { BrainSearchSkeleton } from "../brain/BrainSearchResults";
import { durationLabel, featureRange } from "../../worksTimelineDates";

type Props = {
  features: FeatureEntry[];
  loading?: boolean;
  activePath: string | null;
  onOpen: (f: FeatureEntry) => void;
  /** Highlight query from toolbar search. */
  query?: string;
};

function FeatureRow({
  feat,
  index,
  query,
  active,
  onOpen,
}: {
  feat: FeatureEntry;
  index: number;
  query: string;
  active: boolean;
  onOpen: () => void;
}) {
  const range = featureRange(feat);
  const dates =
    feat.startDate || feat.endDate || feat.created
      ? `${feat.startDate ?? feat.created ?? "—"}${
          feat.endDate ? ` → ${feat.endDate}` : ""
        }`
      : null;
  return (
    <li>
      <button
        type="button"
        className={`brain-hit-row works-feature-row${active ? " active" : ""}`}
        style={{ "--i": index } as CSSProperties}
        onClick={onOpen}
        title={feat.path}
      >
        <span className="brain-hit-icon" aria-hidden>
          <Icon name="file-text" size={15} />
        </span>
        <span className="brain-hit-body">
          <span className="brain-hit-top">
            <span className="brain-hit-title">
              {highlightBrainText(feat.title, query)}
            </span>
            <span
              className={`works-feature-status-pill works-feature-status-pill--${feat.status}`}
            >
              {feat.status}
            </span>
          </span>
          <span className="works-feature-meta">
            {dates && <span>{dates}</span>}
            <span>{durationLabel(range.start, range.end)}</span>
          </span>
        </span>
        <Icon name="chevron-right" size={14} className="brain-hit-chevron" />
      </button>
    </li>
  );
}

export function WorksFeaturesCatalog({
  features,
  loading,
  activePath,
  onOpen,
  query = "",
}: Props) {
  if (loading) {
    return (
      <div className="works-features-catalog">
        <BrainSearchSkeleton />
      </div>
    );
  }

  return (
    <div className="works-features-catalog">
      {features.length === 0 ? (
        <div className="works-empty works-empty--center">
          <div className="works-empty-title">
            {query.trim() ? "No matches" : "No features yet"}
          </div>
          <div className="works-empty-hint">
            {query.trim()
              ? "Try a different search."
              : "Add markdown files under documentation/features/."}
          </div>
        </div>
      ) : (
        <ul className="brain-hit-list works-features-list">
          {features.map((f, i) => (
            <FeatureRow
              key={f.slug}
              feat={f}
              index={i}
              query={query}
              active={activePath === f.path}
              onOpen={() => onOpen(f)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
