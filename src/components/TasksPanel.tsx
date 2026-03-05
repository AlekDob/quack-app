import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';

// Native Claude Code task format (from ~/.claude/tasks/{uuid}/{id}.json)
interface NativeTask {
  id: string;
  subject: string;
  description: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks: string[];     // IDs of tasks this blocks
  blockedBy: string[];  // IDs of tasks blocking this
}

interface TaskFolder {
  uuid: string;
  tasks: NativeTask[];
}

export default function TasksPanel() {
  const [taskFolders, setTaskFolders] = useState<TaskFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flatten all tasks from all folders
  const allTasks = taskFolders.flatMap(f => f.tasks);
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const total = allTasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const loadTasks = useCallback(async () => {
    try {
      const home = await homeDir();
      const tasksDir = await join(home, '.claude', 'tasks');

      // Check if tasks directory exists
      const exists = await invoke<boolean>('path_exists', { path: tasksDir });
      if (!exists) {
        setTaskFolders([]);
        setLoading(false);
        return;
      }

      // List all UUID folders
      const listing = await invoke<{ path: string; entries: Array<{ name: string; path: string; is_dir: boolean }> }>('list_directory', { path: tasksDir });
      const uuidFolders = listing.entries.filter(e => e.is_dir && e.name !== '.' && e.name !== '..');

      const folders: TaskFolder[] = [];

      for (const folder of uuidFolders) {
        const folderPath = await join(tasksDir, folder.name);
        const taskListing = await invoke<{ path: string; entries: Array<{ name: string; path: string; is_dir: boolean }> }>('list_directory', { path: folderPath });
        const jsonFiles = taskListing.entries.filter(f => f.name.endsWith('.json'));

        const tasks: NativeTask[] = [];
        for (const file of jsonFiles) {
          try {
            const filePath = await join(folderPath, file.name);
            const content = await invoke<string>('read_file_content', { path: filePath });
            const task = JSON.parse(content) as NativeTask;
            tasks.push(task);
          } catch {
            // Skip invalid files
          }
        }

        if (tasks.length > 0) {
          // Sort tasks by ID (numeric)
          tasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
          folders.push({ uuid: folder.name, tasks });
        }
      }

      setTaskFolders(folders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling every 3 seconds
  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const getStatusIcon = (status: string, blockedBy: string[]) => {
    // If blocked by other tasks, show lock icon
    if (blockedBy.length > 0 && status === 'pending') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke="#f59e0b" strokeWidth="2" fill="none"/>
          <path d="M8 11V7a4 4 0 1 1 8 0v4" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      );
    }

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

  const handleDragStart = (e: React.DragEvent, task: NativeTask, folderUuid: string) => {
    const taskData = JSON.stringify({
      type: 'task',
      id: task.id,
      content: task.subject,
      status: task.status,
      blockedBy: task.blockedBy,
      uuid: folderUuid
    });
    e.dataTransfer.setData('application/quack-task', taskData);
    // Format: #ID Subject (concise, no path to avoid confusion)
    e.dataTransfer.setData('text/plain', `#${task.id} ${task.subject}`);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (loading) {
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
        <div className="flex-1 flex items-center justify-center">
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <p style={{ fontSize: '12px', color: '#f87171', textAlign: 'center' }}>{error}</p>
        </div>
      </div>
    );
  }

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
            No tasks found in ~/.claude/tasks/<br/>
            Tasks are created by Claude Code CLI.
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

      {/* Task list by folder */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px' }}>
        {taskFolders.map((folder, folderIdx) => (
          <div key={folder.uuid} style={{ marginBottom: folderIdx < taskFolders.length - 1 ? '12px' : 0 }}>
            {/* Folder header (collapsed UUID) */}
            {taskFolders.length > 1 && (
              <div style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.3)',
                marginBottom: '4px',
                paddingLeft: '4px',
                fontFamily: 'monospace',
              }}>
                {folder.uuid.slice(0, 8)}...
              </div>
            )}

            {/* Tasks sorted: in_progress > pending (blocked last) > completed */}
            {[...folder.tasks]
              .sort((a, b) => {
                const statusOrder = { in_progress: 0, pending: 1, completed: 2 };
                const aOrder = statusOrder[a.status] ?? 1;
                const bOrder = statusOrder[b.status] ?? 1;
                if (aOrder !== bOrder) return aOrder - bOrder;
                // Within pending, blocked tasks go last
                if (a.status === 'pending' && b.status === 'pending') {
                  if (a.blockedBy.length > 0 && b.blockedBy.length === 0) return 1;
                  if (a.blockedBy.length === 0 && b.blockedBy.length > 0) return -1;
                }
                return parseInt(a.id) - parseInt(b.id);
              })
              .map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task, folder.uuid)}
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
                      : task.blockedBy.length > 0 && task.status === 'pending'
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'transparent',
                    border: task.status === 'in_progress'
                      ? '1px solid rgba(20, 184, 166, 0.15)'
                      : task.blockedBy.length > 0 && task.status === 'pending'
                        ? '1px solid rgba(245, 158, 11, 0.1)'
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
                      : task.blockedBy.length > 0 && task.status === 'pending'
                        ? 'rgba(245, 158, 11, 0.04)'
                        : 'transparent';
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: '1px' }}>
                    {getStatusIcon(task.status, task.blockedBy)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.4)',
                        fontFamily: 'monospace',
                      }}>
                        #{task.id}
                      </span>
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
                        {task.status === 'in_progress' ? task.activeForm : task.subject}
                      </p>
                    </div>
                    {/* Show blockedBy info */}
                    {task.blockedBy.length > 0 && task.status === 'pending' && (
                      <div style={{
                        fontSize: '10px',
                        color: '#f59e0b',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        <span>blocked by</span>
                        {task.blockedBy.map((id, i) => (
                          <span key={id} style={{ fontFamily: 'monospace' }}>
                            #{id}{i < task.blockedBy.length - 1 ? ',' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
