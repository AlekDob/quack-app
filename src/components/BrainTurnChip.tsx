// Inline chat indicator when pre-turn Pinky Brain context was injected.

import { Icon } from "./Icon";
import type { BrainUsageMeta } from "../ai";
import { openBrainDoc } from "../brainInject";
import {
  formatDurationMs,
  formatTokenCount,
} from "../brainSavings";

type Props = {
  wsId: string;
  root: string;
  usage: BrainUsageMeta;
};

export function BrainTurnChip({ wsId, root, usage }: Props) {
  const openPath = (rel: string) => {
    void openBrainDoc(wsId, root, rel);
  };

  return (
    <div className="brain-turn-chip">
      <div className="brain-turn-chip-head">
        <Icon name="brain" size={14} />
        <span className="brain-turn-chip-title">Pinky Brain</span>
        <span className="brain-turn-chip-savings">
          ~{formatTokenCount(usage.savedTokens)} tokens ·{" "}
          {formatDurationMs(usage.savedMs)} saved
        </span>
        <span className="brain-turn-chip-meta">
          {usage.searchMs}ms search · {usage.hits.length} hit
          {usage.hits.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="brain-turn-chip-hits">
        {usage.hits.map((hit) => (
          <li key={hit.path}>
            <button
              type="button"
              className="brain-turn-hit"
              onClick={() => openPath(hit.path)}
              title={`Open ${hit.path}`}
            >
              <span className="brain-turn-hit-kind">
                {hit.entry_type ?? "note"}
              </span>
              <span className="brain-turn-hit-title">{hit.title}</span>
              <span className="brain-turn-hit-path">{hit.path}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
