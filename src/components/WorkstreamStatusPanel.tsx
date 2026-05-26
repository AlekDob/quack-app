import { useWorkstreams } from "../hooks/useWorkstreams";
import "./WorkstreamsPanel.css";

interface WorkstreamStatusPanelProps {
  rootPath: string | null;
  onOpenFile?: (filePath: string, fileName: string) => void;
}

export default function WorkstreamStatusPanel({ rootPath, onOpenFile }: WorkstreamStatusPanelProps) {
  const { workstreams, loading, error, refresh } = useWorkstreams(rootPath);
  const current = workstreams.filter((ws) => ws.focus === "current");

  if (!rootPath) {
    return <div className="workstreams-panel__empty">No project open.</div>;
  }
  if (loading && workstreams.length === 0) {
    return <div className="workstreams-panel__empty">Loading status…</div>;
  }
  if (error) {
    return (
      <div className="workstreams-panel__empty">
        <div>Status unavailable.</div>
        <div className="workstreams-panel__hint">
          Run <code>bash ~/.claude/skills/project-ops/scripts/setup-pm-docs.sh</code>
        </div>
      </div>
    );
  }
  if (current.length === 0) {
    return (
      <div className="workstreams-panel__empty">
        <div>No current focus.</div>
        <div className="workstreams-panel__hint">
          Set <code>focus: current</code> on a workstream to see it here.
        </div>
      </div>
    );
  }

  return (
    <div className="workstreams-panel">
      <div className="workstreams-panel__header">
        <span className="workstreams-panel__count">{current.length} active</span>
        <button
          type="button"
          className="workstreams-panel__refresh"
          onClick={() => void refresh()}
          aria-label="Refresh status"
        >
          Refresh
        </button>
      </div>
      <div className="workstreams-panel__group">
        {current.map((ws) => (
          <button
            key={ws.filePath}
            type="button"
            className="workstreams-panel__item"
            style={{ "--focus-color": "#84cc16" } as React.CSSProperties}
            onClick={() => onOpenFile?.(ws.filePath, ws.fileName)}
            title={ws.fileName}
          >
            <div className="workstreams-panel__item-title">
              <span className="workstreams-panel__item-num">#{String(ws.ws).padStart(2, "0")}</span>
              {ws.title}
            </div>
            {ws.status ? (
              <div className="workstreams-panel__item-status">{ws.status}</div>
            ) : (
              <div className="workstreams-panel__item-meta">no status set</div>
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
    </div>
  );
}
