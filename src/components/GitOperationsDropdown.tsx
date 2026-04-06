import { useState, useRef, useEffect } from 'react';
import type { TerminalInfo } from '../types';

interface GitOperationsDropdownProps {
  terminal: TerminalInfo;
  branch: string;
  isMainRepo: boolean;
  onOperation?: (operation: string, terminal: TerminalInfo) => void;
}

export default function GitOperationsDropdown({
  terminal,
  branch,
  isMainRepo,
  onOperation,
}: GitOperationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleOperation = (operation: string) => {
    if (onOperation) {
      onOperation(operation, terminal);
    }
    setIsOpen(false);
  };

  const menuItems = isMainRepo
    ? [
        { label: 'Pull latest', icon: '⬇', operation: 'pull' },
        { label: 'Push to remote', icon: '⬆', operation: 'push' },
        { label: 'Create PR', icon: '🔀', operation: 'create-pr' },
        { label: 'View commits', icon: '📝', operation: 'view-commits' },
        { label: 'Create worktree', icon: '🌳', operation: 'create-worktree' },
      ]
    : [
        { label: 'Merge into main', icon: '🔀', operation: 'merge-to-main' },
        { label: 'Pull latest', icon: '⬇', operation: 'pull' },
        { label: 'Push to remote', icon: '⬆', operation: 'push' },
        { label: 'Create PR', icon: '📤', operation: 'create-pr' },
        { label: 'View diff', icon: '📊', operation: 'view-diff' },
        { label: 'Delete worktree', icon: '🗑', operation: 'delete-worktree' },
      ];

  return (
    <div
      className="git-operations-dropdown"
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="branch-badge-with-menu"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          padding: '3px 8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          borderRadius: '4px',
          background: terminal.useWorktree
            ? 'rgba(156, 39, 176, 0.15)'
            : 'rgba(78, 205, 196, 0.15)',
          border: `1px solid ${
            terminal.useWorktree
              ? 'rgba(156, 39, 176, 0.3)'
              : 'rgba(78, 205, 196, 0.3)'
          }`,
          color: terminal.useWorktree ? '#9c27b0' : '#4ecdc4',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget;
          target.style.transform = 'translateY(-1px)';
          target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget;
          target.style.transform = 'translateY(0)';
          target.style.boxShadow = 'none';
        }}
      >
        {terminal.useWorktree && <span title="Git Worktree">🌳</span>}
        <span>{branch}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '4px',
            background: 'rgba(20, 22, 28, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            minWidth: '180px',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'slideDown 0.2s ease',
          }}
        >
          {menuItems.map((item, index) => (
            <button
              key={item.operation}
              className="dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                handleOperation(item.operation);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#e7ebf3',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
                borderBottom:
                  index < menuItems.length - 1
                    ? '1px solid rgba(255, 255, 255, 0.05)'
                    : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.15)';
                e.currentTarget.style.color = 'var(--accent-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#e7ebf3';
              }}
            >
              <span style={{ fontSize: '14px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}