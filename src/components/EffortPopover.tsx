import { useState } from "react";
import { Icon } from "./Icon";

// Single composer control for BOTH reasoning effort and extended thinking.
// The pill shows the current effort; clicking opens an astronave-style
// popover with a Claude-desktop-style effort slider (Faster → Smarter) plus
// a thinking segmented toggle — so both live in one place, no clutter.

const EFFORTS = ["default", "low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
const EFFORT_LABELS: Record<Effort, string> = {
  default: "Default",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "xHigh",
  max: "Max",
};

interface EffortPopoverProps {
  /** null = CLI default. */
  effort: string | null;
  onEffort: (v: string | null) => void;
  /** null = auto (CLI decides), true = on, false = off. */
  thinking: boolean | null;
  onThinking: (v: boolean | null) => void;
}

export function EffortPopover({
  effort,
  onEffort,
  thinking,
  onThinking,
}: EffortPopoverProps) {
  const [open, setOpen] = useState(false);
  const key = (effort ?? "default") as Effort;
  const idx = Math.max(0, EFFORTS.indexOf(key));
  const label = EFFORT_LABELS[key] ?? "Default";

  const thinkOptions: Array<{ label: string; value: boolean | null }> = [
    { label: "auto", value: null },
    { label: "on", value: true },
    { label: "off", value: false },
  ];

  return (
    <div className="ai-meta-flag-wrap">
      <button
        type="button"
        className={`ai-meta-flag ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Effort & extended thinking — applies from your next message"
      >
        {/* Fixed-width value so the pill never resizes as effort changes —
            otherwise the whole toolbar (and this popover) would shift. */}
        effort: <span className="ai-effort-cur">{label.toLowerCase()}</span>
        <Icon name="chevron-down" size={10} />
      </button>
      {open && (
        <>
          <div
            className="ai-flag-menu-overlay"
            onClick={() => setOpen(false)}
          />
          <div className="ai-effort-pop" role="menu">
            <div className="ai-effort-head">
              <span className="ai-effort-title">Effort</span>
              <span className="ai-effort-value">{label}</span>
            </div>
            <input
              className="ai-effort-slider"
              type="range"
              min={0}
              max={EFFORTS.length - 1}
              step={1}
              value={idx}
              onChange={(e) => {
                const i = Number(e.target.value);
                onEffort(i === 0 ? null : EFFORTS[i]);
              }}
              aria-label="Reasoning effort"
            />
            <div className="ai-effort-ends">
              <span>Faster</span>
              <span>Smarter</span>
            </div>
            <div className="ai-effort-divider" />
            <div className="ai-effort-title">Extended thinking</div>
            <div className="ai-effort-seg">
              {thinkOptions.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  className={`ai-effort-seg-btn ${thinking === o.value ? "active" : ""}`}
                  onClick={() => onThinking(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
