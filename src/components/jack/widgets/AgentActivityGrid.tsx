import type { AgentGridData } from './types';
import './JackWidgets.css';

interface Props {
  data: AgentGridData;
}

export default function AgentActivityGrid({ data }: Props) {
  const busyCount = data.agents.filter((a) => a.status === 'busy').length;
  const total = data.agents.length;

  return (
    <div className="jack-widget">
      <div className="jack-widget-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="jack-widget-title">Agenti</span>
        <span className="jack-widget-badge" style={{
          background: busyCount > 0
            ? 'rgba(34, 197, 94, 0.15)'
            : 'rgba(107, 114, 128, 0.15)',
          color: busyCount > 0 ? '#22c55e' : '#6b7280',
        }}>
          {busyCount}/{total} attivi
        </span>
      </div>
      <div className="agent-grid">
        {data.agents.map((agent) => (
          <div key={agent.name} className="agent-grid-card">
            <div
              className={`agent-grid-dot ${agent.status}`}
              style={{ background: agent.status === 'busy' ? '#22c55e' : '#6b7280' }}
            />
            <div className="agent-grid-info">
              <div className="agent-grid-name">{agent.name}</div>
              <div className="agent-grid-project">{agent.project}</div>
            </div>
            {agent.activeSessions > 0 && (
              <span className="agent-grid-sessions">
                {agent.activeSessions} sess
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
