import { useMemo } from "react";
import { useWorkstreams, type Workstream, type WorkstreamFocus } from "../hooks/useWorkstreams";
import "./WorkstreamsPanel.css";

interface WorkstreamsPanelProps {
  rootPath: string | null;
  onOpenFile?: (filePath: string, fileName: string) => void;
}

const FOCUS_ORDER: WorkstreamFocus[] = [
  "current",
  "active",
  "background",
  "candidate",
  "superseded",
  "completed",
];

const FOCUS_LABEL: Record<WorkstreamFocus, string> = {
  current: "Current focus",
  active: "Active",
  background: "Background",
  candidate: "Candidate",
  superseded: "Superseded",
  completed: "Completed",
};

const FOCUS_COLOR: Record<WorkstreamFocus, string> = {
  current: "#fbbf24",
  active: "#60a5fa",
  background: "#94a3b8",
  candidate: "#a78bfa",
  superseded: "#64748b",
  completed: "#34d399",
};

export default function WorkstreamsPanel({ rootPath, onOpenFile }: WorkstreamsPanelProps) {
  const { workstreams, loading, error, refresh } = useWorkstreams(rootPath);

  const grouped = useMemo(() => {
    const map = new Map<WorkstreamFocus, Workstream[]>();
    for (const f of FOCUS_ORDER) map.set(f, []);
    for (const ws of workstreams) map.get(ws.focus)?.push(ws);
    return map;
  }, [workstreams]);

  if (!rootPath) {
    return <div className="workstreams-panel__empty">No project open.</div>;
  }
  if (loading && workstreams.length === 0) {
    return <div className="workstreams-panel__empty">Loading workstreams…</div>;
  }
  if (error) {
    return (
      <div className="workstreams-panel__empty">
        <div>No workstreams found.</div>
        <div className="workstreams-panel__hint">
          Bootstrap with <code>bash ~/.claude/skills/project-ops/scripts/setup-pm-docs.sh</code>
        </div>
      </div>
    );
  }
  if (workstreams.length === 0) {
    return (
      <div className="workstreams-panel__empty">
        <div>No workstreams yet.</div>
        <div className="workstreams-panel__hint">
          Create one in <code>documentation/workstreams/NN-slug.md</code>
        </div>
      </div>
    );
  }

  return (
    <div className="workstreams-panel">
      <div className="workstreams-panel__header">
        <span className="workstreams-panel__count">{workstreams.length} total</span>
        <button
          type="button"
          className="workstreams-panel__refresh"
          onClick={() => void refresh()}
          aria-label="Refresh workstreams"
        >
          Refresh
        </button>
      </div>
      {FOCUS_ORDER.map((focus) => {
        const items = grouped.get(focus) || [];
        if (items.length === 0) return null;
        return (
          <div key={focus} className="workstreams-panel__group">
            <div
              className="workstreams-panel__group-label"
              style={{ "--focus-color": FOCUS_COLOR[focus] } as React.CSSProperties}
            >
              <span className="workstreams-panel__group-dot" />
              {FOCUS_LABEL[focus]} <span className="workstreams-panel__group-count">{items.length}</span>
            </div>
            {items.map((ws) => (
              <button
                key={ws.filePath}
                type="button"
                className="workstreams-panel__item"
                onClick={() => onOpenFile?.(ws.filePath, ws.fileName)}
                title={ws.fileName}
              >
                <div className="workstreams-panel__item-title">
                  <span className="workstreams-panel__item-num">#{String(ws.ws).padStart(2, "0")}</span>
                  {ws.title}
                </div>
                {ws.status && (
                  <div className="workstreams-panel__item-status">{ws.status}</div>
                )}
                {ws.warning && (
                  <div className="workstreams-panel__item-warning">{ws.warning}</div>
                )}
                {ws.updated && (
                  <div className="workstreams-panel__item-meta">upd {ws.updated}</div>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
