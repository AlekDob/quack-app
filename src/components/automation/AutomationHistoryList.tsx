import { memo } from 'react';
import type { AutomationRunHistory } from '../../types';

interface AutomationHistoryListProps {
  history: AutomationRunHistory[];
  onSessionClick?: (sessionId: string) => void;
}

function AutomationHistoryList({ history, onSessionClick }: AutomationHistoryListProps) {
  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms?: number): string => {
    if (!ms) return '-';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}min`;
  };

  if (sorted.length === 0) {
    return (
      <div className="automation-history-empty">
        No runs recorded yet
      </div>
    );
  }

  return (
    <div className="automation-history-list">
      {sorted.map(run => (
        <div key={run.id} className="automation-history-item">
          <div className={`automation-history-status ${run.status}`} />
          <span className="automation-history-name">{run.jobName}</span>
          <span className="automation-history-time">{formatTime(run.startedAt)}</span>
          <span className="automation-history-duration">{formatDuration(run.durationMs)}</span>
          {run.sessionId && onSessionClick && (
            <button
              className="automation-history-session-link"
              onClick={() => onSessionClick(run.sessionId!)}
            >
              Open session
            </button>
          )}
          {run.error && (
            <span style={{ color: '#F44336', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(AutomationHistoryList);
