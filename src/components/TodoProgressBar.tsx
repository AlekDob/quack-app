import { useState } from 'react';
import './TodoProgressBar.css';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface TodoProgressBarProps {
  todos: TodoItem[];
}

export default function TodoProgressBar({ todos }: TodoProgressBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (todos.length === 0) {
    return null;
  }

  const completed = todos.filter(t => t.status === 'completed').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const pending = todos.filter(t => t.status === 'pending').length;
  const total = todos.length;
  const percentage = Math.round((completed / total) * 100);

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="todo-progress-status-icon completed" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#10b981"/>
            <path d="M7 12l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'in_progress':
        return (
          <svg className="todo-progress-status-icon in-progress" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#14b8a6" strokeWidth="2" fill="none" strokeDasharray="63" strokeDashoffset="16" className="rotating-circle"/>
            <circle cx="12" cy="12" r="3" fill="#14b8a6"/>
          </svg>
        );
      case 'pending':
        return (
          <svg className="todo-progress-status-icon pending" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2" fill="none" strokeDasharray="4 4"/>
          </svg>
        );
    }
  };

  return (
    <div className="todo-fixed-progress-bar">
      <div className="todo-fixed-progress-bar-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="todo-fixed-progress-bar-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="todo-fixed-progress-bar-label">Tasks</span>
          {inProgress > 0 && <span className="todo-fixed-progress-bar-badge active">{inProgress} active</span>}
          {pending > 0 && <span className="todo-fixed-progress-bar-badge pending">{pending} pending</span>}
        </div>
        <div className="todo-fixed-progress-bar-right">
          <div className="todo-fixed-progress-bar-track">
            <div
              className="todo-fixed-progress-bar-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="todo-fixed-progress-bar-percentage">
            {percentage}% ({completed}/{total})
          </span>
          <svg
            className={`todo-fixed-progress-bar-chevron ${isExpanded ? 'expanded' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </div>
      </div>

      <div className={`todo-fixed-progress-bar-content-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <div className="todo-fixed-progress-bar-content">
          <div className="todo-fixed-progress-bar-content-inner">
            {/* In Progress Section */}
            {inProgress > 0 && (
              <div className="todo-fixed-progress-bar-section">
                <div className="todo-fixed-progress-bar-section-title in-progress">In Progress</div>
                <div className="todo-fixed-progress-bar-items">
                  {todos.filter(t => t.status === 'in_progress').map((todo, index) => (
                    <div key={`ip-${index}`} className="todo-fixed-progress-bar-item in-progress">
                      <div className="todo-fixed-progress-bar-item-icon">
                        {getStatusIcon(todo.status)}
                      </div>
                      <span className="todo-fixed-progress-bar-item-text">{todo.activeForm}</span>
                      <div className="todo-fixed-progress-bar-item-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Section */}
            {pending > 0 && (
              <div className="todo-fixed-progress-bar-section">
                <div className="todo-fixed-progress-bar-section-title pending">Pending</div>
                <div className="todo-fixed-progress-bar-items">
                  {todos.filter(t => t.status === 'pending').map((todo, index) => (
                    <div key={`p-${index}`} className="todo-fixed-progress-bar-item pending">
                      <div className="todo-fixed-progress-bar-item-icon">
                        {getStatusIcon(todo.status)}
                      </div>
                      <span className="todo-fixed-progress-bar-item-text">{todo.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Section */}
            {completed > 0 && (
              <div className="todo-fixed-progress-bar-section">
                <div className="todo-fixed-progress-bar-section-title completed">Completed</div>
                <div className="todo-fixed-progress-bar-items">
                  {todos.filter(t => t.status === 'completed').map((todo, index) => (
                    <div key={`c-${index}`} className="todo-fixed-progress-bar-item completed">
                      <div className="todo-fixed-progress-bar-item-icon">
                        {getStatusIcon(todo.status)}
                      </div>
                      <span className="todo-fixed-progress-bar-item-text">{todo.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
