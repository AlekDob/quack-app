// Cursor-style compact reasoning recap — mirrors BrainTurnChip (quiet
// header, expandable body). Collapsed by default; no emoji in chrome.

import { useState } from "react";
import { Icon } from "./Icon";

type Props = {
  text: string;
};

function previewLine(text: string): string {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? "";
  if (line.length <= 72) return line;
  return line.slice(0, 69) + "…";
}

export function ReasoningTurnChip({ text }: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/).filter(Boolean).length;

  return (
    <div className="reasoning-turn-chip">
      <button
        type="button"
        className="reasoning-turn-chip-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name="cloud" size={11} className="reasoning-turn-chip-icon" />
        <span className="reasoning-turn-chip-label">Reasoning</span>
        <span className="reasoning-turn-chip-meta">
          {words} word{words === 1 ? "" : "s"}
        </span>
        {!open && (
          <span className="reasoning-turn-chip-preview">{previewLine(trimmed)}</span>
        )}
        <Icon
          name="chevron-down"
          size={10}
          className={`reasoning-turn-chip-caret${open ? " is-open" : ""}`}
        />
      </button>
      {open && <div className="reasoning-turn-chip-body">{trimmed}</div>}
    </div>
  );
}
