interface UsageRingProps {
  pct: number;
  size?: number;
  stroke?: number;
  className?: string;
}

function ringTone(pct: number): string {
  if (pct >= 90) return "hot";
  if (pct >= 70) return "warn";
  return "ok";
}

export function UsageRing({
  pct,
  size = 16,
  stroke = 2,
  className = "",
}: UsageRingProps) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const tone = ringTone(clamped);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`usage-ring ${className}`.trim()}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={stroke}
      />
      {clamped > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`usage-ring-arc ${tone}`}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}
