import { memo } from 'react';
import type { AutomationJob, TerminalInfo } from '../../types';
import { cronToHumanReadable } from '../../services/cronUtils';
import { AgentAvatar } from '../AgentAvatar';

interface AutomationJobCardProps {
  job: AutomationJob;
  terminals: TerminalInfo[];
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFireNow: () => void;
}

function AutomationJobCard({ job, terminals, onToggle, onEdit, onDelete, onFireNow }: AutomationJobCardProps) {
  const cronLabel = cronToHumanReadable(job.cronExpression);
  const isRunning = job.lastRunStatus === 'running';
  const agent = terminals.find(t => t.id === job.agentId);

  const formatRelativeTime = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatNextRun = (timestamp?: number): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ` at ${time}`;
  };

  return (
    <div className={`automation-job-card ${!job.enabled ? 'disabled' : ''} ${isRunning ? 'running' : ''}`}>
      <div className="automation-job-card-main">
        {/* Toggle */}
        <button
          className={`automation-toggle ${job.enabled ? 'on' : 'off'}`}
          onClick={onToggle}
          aria-label={job.enabled ? 'Disable' : 'Enable'}
        >
          <div className="automation-toggle-thumb" />
        </button>

        {/* Agent Avatar */}
        <AgentAvatar
          agentName={agent?.label || job.agentName}
          avatarFilename={agent?.avatar}
          style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }}
        />

        {/* Info */}
        <div className="automation-job-info">
          <div className="automation-job-name">{job.name}</div>
          <div className="automation-job-meta">
            <span className="automation-job-cron">{cronLabel}</span>
            <span className="automation-job-dot" />
            <span className="automation-job-agent">{job.agentName}</span>
            <span className="automation-job-dot" />
            <span className="automation-job-project">{job.projectName}</span>
          </div>
        </div>

        {/* Status */}
        <div className="automation-job-status">
          {isRunning && <span className="automation-status-badge running">Running</span>}
          {!isRunning && job.lastRunStatus === 'success' && (
            <span className="automation-status-badge success">OK</span>
          )}
          {!isRunning && job.lastRunStatus === 'failed' && (
            <span className="automation-status-badge failed">Failed</span>
          )}
        </div>
      </div>

      <div className="automation-job-card-footer">
        <div className="automation-job-times">
          <span>Last: {formatRelativeTime(job.lastRunAt)}</span>
          <span>Next: {formatNextRun(job.nextRunAt)}</span>
        </div>
        <div className="automation-job-actions">
          <button className="automation-job-action" onClick={onFireNow} title="Run now">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          </button>
          <button className="automation-job-action" onClick={onEdit} title="Edit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="automation-job-action delete" onClick={onDelete} title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AutomationJobCard);
