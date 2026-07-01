// Per-chat session usage indicator — 16px SVG progress circle showing
// Claude Code's 5-hour session utilization. Colour shifts as the
// session progresses: green → yellow → red.
//
// Brain: session-usage-panel

interface SessionUsageCircleProps {
  /** 0–100 utilization from the five_hour window. */
  pct: number;
  /** Human-friendly "resets in" string (e.g. "2h 14m", "35m"). */
  resetsIn: string;
  onClick: () => void;
}

const SIZE = 16;
const STROKE = 2;
const R = (SIZE - STROKE) / 2; // 7
const C = 2 * Math.PI * R; // ~43.98

function color(pct: number): string {
  if (pct >= 80) return "#ef4444"; // red
  if (pct >= 60) return "#f59e0b"; // yellow/amber
  return "#22c55e"; // green
}

export function SessionUsageCircle({
  pct,
  resetsIn,
  onClick,
}: SessionUsageCircleProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  // Don't render until we have real data (pct > 0).
  if (clamped === 0) return null;

  const offset = C - (clamped / 100) * C;
  const hue = color(clamped);

  const tooltip = `Session 5hr: ${Math.round(clamped)}% · resets in ${resetsIn}`;

  return (
    <button
      type="button"
      className="session-circle-btn"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="session-circle-svg"
      >
        {/* Background track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--border-strong, rgba(255,255,255,0.12))"
          strokeWidth={STROKE}
        />
        {/* Foreground arc */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={hue}
          strokeWidth={STROKE}
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="session-circle-arc"
        />
      </svg>
    </button>
  );
}
