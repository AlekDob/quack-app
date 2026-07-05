import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

// Single composer control for BOTH reasoning effort and extended thinking.
// The pill shows the current effort; clicking opens an astronave-style
// popover with a Claude-desktop-style effort slider (Faster → Smarter) plus
// a thinking segmented toggle — so both live in one place, no clutter.

export const CC_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type CcEffort = (typeof CC_EFFORTS)[number];
export const CC_EFFORT_DEFAULT: CcEffort = "medium";

const EFFORT_LABELS: Record<CcEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "xHigh",
  max: "Max",
};

export function normalizeCcEffort(v: string | null | undefined): CcEffort {
  if (v && (CC_EFFORTS as readonly string[]).includes(v)) return v as CcEffort;
  return CC_EFFORT_DEFAULT;
}

function effortTooltip(
  label: string,
  thinking: boolean | null,
): string {
  const think =
    thinking === null ? "auto" : thinking ? "on" : "off";
  return `Effort: ${label} · Thinking: ${think} — Ctrl+1–5 to switch`;
}

const POP_GAP = 6;
const POP_MARGIN = 8;

function clampPopPos(
  btn: DOMRect,
  popW: number,
  popH: number,
): { left: number; top: number } {
  let left = btn.left;
  if (left + popW + POP_MARGIN > window.innerWidth) {
    left = Math.max(POP_MARGIN, btn.right - popW);
  }
  left = Math.max(POP_MARGIN, left);
  let top = btn.top - popH - POP_GAP;
  if (top < POP_MARGIN) top = btn.bottom + POP_GAP;
  return { left, top };
}

interface EffortPopoverProps {
  effort: string;
  onEffort: (v: CcEffort) => void;
  /** null = auto (CLI decides), true = on, false = off. */
  thinking: boolean | null;
  onThinking: (v: boolean | null) => void;
  /** Bump to replay the compose reminder pulse on the meter button. */
  pulseToken?: number;
}

export function EffortPopover({
  effort,
  onEffort,
  thinking,
  onThinking,
  pulseToken = 0,
}: EffortPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [flashLabel, setFlashLabel] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });
  const key = normalizeCcEffort(effort);
  const idx = CC_EFFORTS.indexOf(key);
  const label = EFFORT_LABELS[key];
  const tip = effortTooltip(label, thinking);

  useEffect(() => {
    if (pulseToken > 0) {
      setPulsing(true);
      setFlashLabel(true);
    }
  }, [pulseToken]);

  const thinkOptions: Array<{ label: string; value: boolean | null }> = [
    { label: "auto", value: null },
    { label: "on", value: true },
    { label: "off", value: false },
  ];

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(clampPopPos(btn, pop?.width ?? 260, pop?.height ?? 200));
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const btn = btnRef.current.getBoundingClientRect();
      setPopPos(clampPopPos(btn, 260, 200));
    }
    setOpen((v) => !v);
  };

  const popover = open ? (
    <>
      <div
        className="ai-flag-menu-overlay"
        onClick={() => setOpen(false)}
      />
      <div
        ref={popRef}
        className="ai-effort-pop"
        role="menu"
        style={{ left: popPos.left, top: popPos.top }}
      >
        <div className="ai-effort-head">
          <span className="ai-effort-title">Effort</span>
          <span className="ai-effort-value">{label}</span>
        </div>
        <input
          className="ai-effort-slider"
          type="range"
          min={0}
          max={CC_EFFORTS.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onEffort(CC_EFFORTS[Number(e.target.value)])}
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
  ) : null;

  return (
    <div className="ai-effort-wrap">
      {flashLabel && (
        <span
          key={pulseToken}
          className="ai-effort-flash-label"
          aria-live="polite"
          onAnimationEnd={() => setFlashLabel(false)}
        >
          {label}
        </span>
      )}
      <button
        ref={btnRef}
        type="button"
        className={`ai-effort-btn ${open ? "open" : ""} ${pulsing ? "pulse" : ""}`}
        onClick={toggleOpen}
        onAnimationEnd={() => setPulsing(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tip}
        title={tip}
      >
        <span className="ai-effort-meter" aria-hidden="true">
          {CC_EFFORTS.map((_, i) => (
            <span
              key={i}
              className={`ai-effort-bar ai-effort-bar-${i + 1} ${i <= idx ? "on" : ""}`}
            />
          ))}
        </span>
        <Icon name="chevron-down" size={8} />
      </button>
      {popover && createPortal(popover, document.body)}
    </div>
  );
}
