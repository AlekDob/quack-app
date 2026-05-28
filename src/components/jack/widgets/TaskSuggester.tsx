import type { TaskSuggestData } from './types';
import { PRIORITY_COLORS } from './types';
import './JackWidgets.css';

interface Props {
  data: TaskSuggestData;
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa',
};

export default function TaskSuggester({ data }: Props) {
  const highCount = data.tasks.filter((t) => t.priority === 'high').length;

  return (
    <div className="jack-widget">
      <div className="jack-widget-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span className="jack-widget-title">Task suggeriti</span>
        {highCount > 0 && (
          <span className="jack-widget-badge" style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
          }}>{highCount} alta priorita'</span>
        )}
      </div>
      <div className="task-suggest-list">
        {data.tasks.map((task, i) => {
          const color = PRIORITY_COLORS[task.priority] || '#6b7280';
          return (
            <div key={i} className="task-suggest-item">
              <div
                className="task-suggest-priority"
                style={{ background: color }}
                title={PRIORITY_LABELS[task.priority] || task.priority}
              />
              <div className="task-suggest-content">
                <div className="task-suggest-title">{task.title}</div>
                <div className="task-suggest-reason">{task.reason}</div>
                <div className="task-suggest-meta">
                  {task.agent && (
                    <span className="task-suggest-pill" style={{
                      borderColor: `${color}33`,
                      color,
                    }}>
                      {task.agent}
                    </span>
                  )}
                  {task.workstream != null && (
                    <span className="task-suggest-pill">WS{task.workstream}</span>
                  )}
                  <span className="task-suggest-pill">{PRIORITY_LABELS[task.priority]}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
