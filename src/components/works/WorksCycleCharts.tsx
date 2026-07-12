// Cycle dashboard charts — SVG + CSS tokens (BrainCharts pattern).

import { useId, type CSSProperties } from "react";
import type { BurndownPoint, CycleProgress } from "../../worksCycles";

type ProgressProps = {
  progress: CycleProgress;
  closedLabel: string;
};

export function WorksCycleProgress({ progress, closedLabel }: ProgressProps) {
  const total = Math.max(
    progress.completed + progress.started + progress.unstarted,
    1,
  );
  const donePct = (progress.completed / total) * 100;
  const startedPct = (progress.started / total) * 100;
  const backlogPct = (progress.unstarted / total) * 100;

  return (
    <div className="works-cycle-card">
      <h3 className="works-cycle-card-title">Progress</h3>
      <p className="works-cycle-progress-summary">{closedLabel}</p>
      <div className="works-cycle-progress-bar" role="img" aria-label={closedLabel}>
        <span
          className="works-cycle-progress-seg done"
          style={{ width: `${donePct}%` }}
        />
        <span
          className="works-cycle-progress-seg started"
          style={{ width: `${startedPct}%` }}
        />
        <span
          className="works-cycle-progress-seg backlog"
          style={{ width: `${backlogPct}%` }}
        />
      </div>
      <div className="works-cycle-progress-legend">
        <span><i className="dot done" /> Completed · {progress.completed}</span>
        <span><i className="dot started" /> Started · {progress.started}</span>
        <span><i className="dot backlog" /> Unstarted · {progress.unstarted}</span>
      </div>
      {progress.cancelled > 0 && (
        <p className="works-cycle-progress-note">
          {progress.cancelled} cancelled work item
          {progress.cancelled === 1 ? "" : "s"} excluded from this report.
        </p>
      )}
    </div>
  );
}

type BurndownProps = {
  points: BurndownPoint[];
  pending: number;
};

export function WorksCycleBurndown({ points, pending }: BurndownProps) {
  const gradId = useId().replace(/:/g, "");
  const w = 280;
  const h = 120;
  const pad = { t: 8, r: 8, b: 24, l: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(...points.map((p) => Math.max(p.remaining, p.ideal)), 1);

  const toX = (i: number) =>
    pad.l + (i / Math.max(points.length - 1, 1)) * innerW;
  const toY = (v: number) => pad.t + innerH - (v / maxY) * innerH;

  const actualPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.remaining)}`)
    .join(" ");
  const idealPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.ideal)}`)
    .join(" ");

  return (
    <div className="works-cycle-card">
      <div className="works-cycle-card-head">
        <h3 className="works-cycle-card-title">Work item burndown</h3>
        <span className="works-cycle-pending">Pending — {pending}</span>
      </div>
      <svg
        className="works-cycle-burndown-svg"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--fg)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--fg)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + innerH * (1 - f)}
            y2={pad.t + innerH * (1 - f)}
            className="works-cycle-grid-line"
          />
        ))}
        <path d={`${actualPath} L ${toX(points.length - 1)} ${pad.t + innerH} L ${pad.l} ${pad.t + innerH} Z`} fill={`url(#${gradId})`} />
        <path d={idealPath} className="works-cycle-line ideal" fill="none" />
        <path d={actualPath} className="works-cycle-line actual" fill="none" />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={toX(i)}
            cy={toY(p.remaining)}
            r={3}
            className="works-cycle-dot"
          />
        ))}
      </svg>
      <div className="works-cycle-burndown-legend">
        <span><i className="line actual" /> Current work items</span>
        <span><i className="line ideal" /> Ideal work items</span>
      </div>
    </div>
  );
}

type PriorityListProps = {
  items: { id: string; shortId: string; title: string; status: string; priority: string }[];
  onOpen: (id: string) => void;
};

export function WorksCyclePriorityList({ items, onOpen }: PriorityListProps) {
  return (
    <div className="works-cycle-card works-cycle-card--list">
      <h3 className="works-cycle-card-title">Priority work items</h3>
      <ul className="works-cycle-priority-list">
        {items.length === 0 && (
          <li className="works-cycle-priority-empty">No work items in this cycle.</li>
        )}
        {items.map((w, i) => (
          <li key={w.id}>
            <button
              type="button"
              className="brain-hit-row"
              style={{ "--i": i } as CSSProperties}
              onClick={() => onOpen(w.id)}
            >
              <span className="brain-hit-body">
                <span className="brain-hit-top">
                  <span className="brain-hit-id">{w.shortId}</span>
                  <span className="brain-hit-title">{w.title}</span>
                </span>
                <span className="brain-hit-meta">
                  {w.status} · {w.priority}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
