// Cursor-style compact reasoning recap — mirrors BrainTurnChip (quiet
// header, expandable body). Collapsed by default; no emoji in chrome.
// Live: “Thinking”; done: “Thought for 4s” when duration known.

import { useState } from "react";
import { formatWorkedDuration } from "../formatWorkedDuration";
import { Icon } from "./Icon";

type Props = {
  text: string;
  /** Client-measured thinking span. */
  durationMs?: number;
  /** True while this thinking block is still streaming. */
  streaming?: boolean;
};

function previewLine(text: string): string {
  const line = text.trim().split("\n").find((l) => l.trim()) ?? "";
  if (line.length <= 72) return line;
  return line.slice(0, 69) + "…";
}

export function ReasoningTurnChip({ text, durationMs, streaming }: Props) {
  const [open, setOpen] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const label = streaming
    ? "Thinking"
    : typeof durationMs === "number" && durationMs > 0
      ? `Thought for ${formatWorkedDuration(durationMs)}`
      : "Reasoning";
  const meta =
    !streaming && !(typeof durationMs === "number" && durationMs > 0)
      ? `${words} word${words === 1 ? "" : "s"}`
      : null;

  return (
    <div className={`reasoning-turn-chip${streaming ? " is-live" : ""}`}>
      <button
        type="button"
        className="reasoning-turn-chip-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name="cloud" size={11} className="reasoning-turn-chip-icon" />
        <span
          className={`reasoning-turn-chip-label${streaming ? " ai-live-shimmer" : ""}`}
        >
          {label}
        </span>
        {meta && (
          <span className="reasoning-turn-chip-meta">{meta}</span>
        )}
        {!open && !streaming && (
          <span className="reasoning-turn-chip-preview">
            {previewLine(trimmed)}
          </span>
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
