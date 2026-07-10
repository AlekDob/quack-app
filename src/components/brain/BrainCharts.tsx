// Animated SVG charts for the Brain dashboard — zero extra deps, CSS tokens only.

import { useId, type CSSProperties } from "react";
import { useCountUp } from "../../hooks/useCountUp";
import { formatDurationMs } from "../../brainSavings";

const DONUT_R = 52;
const DONUT_C = 2 * Math.PI * DONUT_R;
const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

type DonutProps = {
  active: number;
  dormant: number;
  label: string;
  sublabel: string;
};

export function BrainCoverageDonut({
  active,
  dormant,
  label,
  sublabel,
}: DonutProps) {
  const total = Math.max(active + dormant, 1);
  const activeLen = (active / total) * DONUT_C;
  const dormantLen = (dormant / total) * DONUT_C;
  const gradId = useId().replace(/:/g, "");
  const count = useCountUp(total, 1000);

  return (
    <div className="brain-chart-card brain-donut-card">
      <h3 className="brain-dash-heading">Knowledge coverage</h3>
      <div className="brain-donut-wrap">
        <svg
          className="brain-donut-svg"
          viewBox="0 0 128 128"
          style={{ "--circ": DONUT_C } as CSSProperties}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--ok)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--ok) 55%, var(--fg-dim))" />
            </linearGradient>
          </defs>
          <circle
            className="brain-donut-track"
            cx="64"
            cy="64"
            r={DONUT_R}
          />
          <circle
            className="brain-donut-seg dormant"
            cx="64"
            cy="64"
            r={DONUT_R}
            style={
              {
                "--seg-len": dormantLen,
                "--seg-end": -activeLen,
              } as CSSProperties
            }
          />
          <circle
            className="brain-donut-seg active"
            cx="64"
            cy="64"
            r={DONUT_R}
            style={
              { "--seg-len": activeLen, "--seg-end": 0 } as CSSProperties
            }
            stroke={`url(#${gradId})`}
          />
        </svg>
        <div className="brain-donut-center">
          <span className="brain-donut-value">{count}</span>
          <span className="brain-donut-unit">entries</span>
        </div>
      </div>
      <p className="brain-donut-caption">{label}</p>
      <div className="brain-donut-legend">
        <span className="brain-legend-item">
          <i className="brain-legend-dot active" />
          Active {active}
        </span>
        <span className="brain-legend-item">
          <i className="brain-legend-dot dormant" />
          Dormant {dormant}
        </span>
      </div>
      <p className="brain-muted brain-donut-sub">{sublabel}</p>
    </div>
  );
}

type BarRow = { key: string; label: string; value: number; meta?: string };

type HBarProps = {
  title: string;
  rows: BarRow[];
  onRowClick?: (key: string) => void;
};

export function BrainAnimatedBars({ title, rows, onRowClick }: HBarProps) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="brain-chart-card">
      <h3 className="brain-dash-heading">{title}</h3>
      <ul className="brain-bar-chart">
        {rows.map((row, i) => (
          <BarRowItem
            key={row.key}
            row={row}
            i={i}
            max={max}
            onRowClick={onRowClick}
          />
        ))}
      </ul>
    </div>
  );
}

type SparkProps = {
  hits: number;
  served: number;
  sessions: number;
  usefulHits: number;
};

export function BrainUsageSparkline({
  hits,
  served,
  sessions,
  usefulHits,
}: SparkProps) {
  const hitN = useCountUp(hits, 800);
  const servedN = useCountUp(served, 900);
  const sessionN = useCountUp(sessions, 700);
  const usefulN = useCountUp(usefulHits, 1000);
  const hitW = Math.min(100, hits > 0 ? (usefulHits / hits) * 100 : 0);

  return (
    <div className="brain-chart-card brain-spark-card">
      <h3 className="brain-dash-heading">Retrieval pulse</h3>
      <div className="brain-spark-grid">
        <MiniStat label="Hits" value={hitN} />
        <MiniStat label="Served" value={servedN} />
        <MiniStat label="Sessions" value={sessionN} />
        <MiniStat label="Useful" value={usefulN} accent />
      </div>
      <div className="brain-spark-meter">
        <span className="brain-spark-meter-label">Signal quality</span>
        <span className="brain-spark-track">
          <span
            className="brain-spark-fill"
            style={{ "--pct": `${hitW}%` } as CSSProperties}
          />
        </span>
        <span className="brain-spark-pct">
          {hits > 0 ? `${Math.round(hitW)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

type SavingsProps = {
  turns: number;
  savedTokens: number;
  savedMs: number;
};

export function BrainSavingsGauge({
  turns,
  savedTokens,
  savedMs,
}: SavingsProps) {
  const turnsN = useCountUp(turns, 700);
  const tokN = useCountUp(savedTokens, 1100);
  const msN = useCountUp(savedMs, 1100);
  const tokCap = Math.min(100, (savedTokens / 12000) * 100);
  const timeCap = Math.min(100, (savedMs / 60000) * 100);

  if (turns === 0) return null;

  return (
    <div className="brain-chart-card brain-savings-card">
      <h3 className="brain-dash-heading">Quack inject savings</h3>
      <p className="brain-savings-lead">
        <span className="brain-savings-big">{turnsN}</span> turns pre-loaded
      </p>
      <div className="brain-savings-rings">
        <RingGauge
          label="Tokens saved"
          display={savedTokens >= 1000 ? `${(savedTokens / 1000).toFixed(1)}k` : String(tokN)}
          pct={tokCap}
          delay={0}
        />
        <RingGauge
          label="Time saved"
          display={formatDurationMs(msN)}
          pct={timeCap}
          delay={120}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`brain-mini-stat${accent ? " accent" : ""}`}>
      <span className="brain-mini-val">{value}</span>
      <span className="brain-mini-label">{label}</span>
    </div>
  );
}

function BarRowItem({
  row,
  i,
  max,
  onRowClick,
}: {
  row: BarRow;
  i: number;
  max: number;
  onRowClick?: (key: string) => void;
}) {
  const pct = (row.value / max) * 100;
  const inner = (
    <>
      <span className="brain-bar-label" title={row.label}>
        {row.label}
      </span>
      <span className="brain-bar-track">
        <span
          className="brain-bar-fill"
          style={{ "--pct": `${pct}%`, "--i": i } as CSSProperties}
        />
      </span>
      <span className="brain-bar-val">{row.value}</span>
      {row.meta && <span className="brain-bar-meta">{row.meta}</span>}
    </>
  );

  return (
    <li
      className={`brain-bar-row${onRowClick ? " clickable" : ""}`}
      style={{ "--i": i } as CSSProperties}
    >
      {onRowClick ? (
        <button
          type="button"
          className="brain-bar-btn"
          onClick={() => onRowClick(row.key)}
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </li>
  );
}

function RingGauge({
  label,
  display,
  pct,
  delay,
}: {
  label: string;
  display: string;
  pct: number;
  delay: number;
}) {
  const stroke = (pct / 100) * RING_C * 0.78;

  return (
    <div
      className="brain-ring-gauge"
      style={{ "--delay": `${delay}ms`, "--ring-c": RING_C } as CSSProperties}
    >
      <svg viewBox="0 0 88 88" className="brain-ring-svg" aria-hidden>
        <circle className="brain-ring-track" cx="44" cy="44" r={RING_R} />
        <circle
          className="brain-ring-fill"
          cx="44"
          cy="44"
          r={RING_R}
          style={{ "--ring-len": stroke } as CSSProperties}
        />
      </svg>
      <span className="brain-ring-val">{display}</span>
      <span className="brain-ring-label">{label}</span>
    </div>
  );
}
