import React, { useState } from 'react';
import './TodoWidget.css';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface TodoWidgetProps {
  todos: TodoItem[];
  defaultExpanded?: boolean;
}

const TodoWidget: React.FC<TodoWidgetProps> = ({ todos, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Count stats
  const completed = todos.filter(t => t.status === 'completed').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const total = todos.length;

  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="todo-status-icon-wrapper completed">
            <svg className="todo-status-icon completed" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#10b981" opacity="0.15"/>
              <circle cx="12" cy="12" r="10" fill="#10b981" stroke="#10b981" strokeWidth="2"/>
              <path d="M7 12l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'in_progress':
        return (
          <div className="todo-status-icon-wrapper in-progress">
            <svg className="todo-status-icon in-progress" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#3b82f6" opacity="0.1"/>
              <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2.5" fill="none" strokeDasharray="63" strokeDashoffset="16" className="rotating-circle"/>
              <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2.5" fill="none" opacity="0.15"/>
              <circle cx="12" cy="12" r="3" fill="#3b82f6" className="pulsing-dot"/>
            </svg>
          </div>
        );
      case 'pending':
        return (
          <div className="todo-status-icon-wrapper pending">
            <svg className="todo-status-icon pending" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="#6b7280" opacity="0.08"/>
              <circle cx="12" cy="12" r="10" stroke="#6b7280" strokeWidth="2" fill="none" strokeDasharray="4 4"/>
              <circle cx="12" cy="12" r="2" fill="#6b7280" opacity="0.5"/>
            </svg>
          </div>
        );
    }
  };

  const getToolIcon = () => {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="todo-tool-icon">
        <path d="M1.5 2.75a.25.25 0 01.25-.25h8.5a.25.25 0 01.25.25v5.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-5.5zM1.75 1A1.75 1.75 0 000 2.75v5.5C0 9.216.784 10 1.75 10h8.5A1.75 1.75 0 0012 8.25v-5.5A1.75 1.75 0 0010.25 1h-8.5zM2.75 3.5a.75.75 0 000 1.5h5.5a.75.75 0 000-1.5h-5.5zM3 7.25a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4A.75.75 0 013 7.25z"/>
      </svg>
    );
  };

  return (
    <div className="todo-widget">
      <div className="todo-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="todo-widget-title">
          {getToolIcon()}
          <span>TodoWrite</span>
          <span className="todo-widget-stats">
            {completed}/{total} completed
            {inProgress > 0 && <span className="todo-in-progress-badge">{inProgress} active</span>}
          </span>
        </div>
        <svg
          className={`todo-widget-chevron ${isExpanded ? 'expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </div>

      {isExpanded && (
        <div className="todo-widget-content">
          <div className="todo-progress-bar">
            <div className="todo-progress-fill" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
          <div className="todo-list">
            {todos.map((todo, index) => (
              <div key={index} className={`todo-item ${todo.status}`}>
                <div className="todo-item-checkbox">
                  {getStatusIcon(todo.status)}
                </div>
                <div className="todo-item-content">
                  <div className="todo-item-text">
                    {todo.status === 'in_progress' ? todo.activeForm : todo.content}
                  </div>
                  {todo.status === 'in_progress' && (
                    <div className="todo-item-loading">
                      <div className="todo-pulse"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoWidget;
