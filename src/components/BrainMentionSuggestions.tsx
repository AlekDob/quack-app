// `#` brain mention popover — Cursor-style rows above the composer.

import { BrainSearchHitRow, BrainSearchSkeleton } from "./brain/BrainSearchResults";
import type { PinkySearchHit } from "../pinky";

type Props = {
  query: string;
  matches: PinkySearchHit[];
  searching: boolean;
  activeIndex: number;
  onPick: (hit: PinkySearchHit) => void;
  onHover: (index: number) => void;
};

export function BrainMentionSuggestions({
  query,
  matches,
  searching,
  activeIndex,
  onPick,
  onHover,
}: Props) {
  const trimmed = query.trim();

  return (
    <div className="ai-mention-popover ai-brain-mention-popover">
      <div className="ai-mention-list ai-slash-suggestions">
        {searching ? (
          <BrainSearchSkeleton rows={4} />
        ) : matches.length === 0 ? (
          <p className="brain-mention-empty">
            {trimmed ? "No matches" : "Type to search knowledge…"}
          </p>
        ) : (
          <ul className="brain-results brain-results-mention">
            {matches.map((hit, i) => (
              <li
                key={hit.id}
                className={i === activeIndex ? "brain-mention-row-active" : ""}
                onMouseEnter={() => onHover(i)}
              >
                <BrainSearchHitRow
                  hit={hit}
                  index={i}
                  query={trimmed}
                  onOpen={onPick}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
