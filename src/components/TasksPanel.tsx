import { useTasksStore } from '../stores/tasksStore';

export default function TasksPanel() {
  const { tasks } = useTasksStore();

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#10b981"/>
            <path d="M7 12l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'in_progress':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#14b8a6" strokeWidth="2" fill="none" strokeDasharray="63" strokeDashoffset="16"/>
            <circle cx="12" cy="12" r="3" fill="#14b8a6"/>
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2" fill="none" strokeDasharray="4 4"/>
          </svg>
        );
    }
  };

  const handleDragStart = (e: React.DragEvent, task: { content: string; status: string }) => {
    const taskData = JSON.stringify({ type: 'task', content: task.content, status: task.status });
    e.dataTransfer.setData('application/quack-task', taskData);
    e.dataTransfer.setData('text/plain', `@task:${task.content}`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (total === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Tasks</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.5 }}>
            No active tasks. Tasks will appear here when the AI uses TodoWrite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Tasks</span>
            <span style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'rgba(20, 184, 166, 0.15)',
              color: '#14b8a6',
              fontWeight: 500,
            }}>
              {completed}/{total}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {percentage}%
          </span>
        </div>
        {/* Progress bar */}
        <div style={{
          marginTop: '8px',
          height: '3px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percentage}%`,
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #14b8a6, #10b981)',
            transition: 'width 0.3s ease',
          }}/>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px' }}>
        {/* In Progress first, then Pending, then Completed */}
        {[...tasks]
          .sort((a, b) => {
            const order = { in_progress: 0, pending: 1, completed: 2 };
            return (order[a.status] ?? 1) - (order[b.status] ?? 1);
          })
          .map((task, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, task)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px 10px',
                marginBottom: '2px',
                borderRadius: '6px',
                cursor: 'grab',
                background: task.status === 'in_progress'
                  ? 'rgba(20, 184, 166, 0.06)'
                  : 'transparent',
                border: task.status === 'in_progress'
                  ? '1px solid rgba(20, 184, 166, 0.15)'
                  : '1px solid transparent',
                transition: 'background 0.15s ease',
                opacity: task.status === 'completed' ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = task.status === 'in_progress'
                  ? 'rgba(20, 184, 166, 0.06)'
                  : 'transparent';
              }}
            >
              <div style={{ flexShrink: 0, marginTop: '1px' }}>
                {getStatusIcon(task.status)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '12px',
                  color: task.status === 'completed'
                    ? 'rgba(255,255,255,0.5)'
                    : 'rgba(255,255,255,0.85)',
                  lineHeight: 1.4,
                  margin: 0,
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  wordBreak: 'break-word',
                }}>
                  {task.status === 'in_progress' ? task.activeForm : task.content}
                </p>
              </div>
            </div>
          ))}
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-white/5">
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Drag a task to chat input to cite it
        </p>
      </div>
    </div>
  );
}
