import { useState, memo } from 'react';
import type { ChatToolCall } from '../types';
import DiffViewer from './DiffViewer';
import './ToolCallCard.css';

interface ToolCallCardProps {
  tool: ChatToolCall;
  onOpenFile?: (path: string) => void;
}

function ToolCallCard({ tool, onOpenFile }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolIcon = (name: string) => {
    const toolName = name.toLowerCase();

    // SVG icons instead of emoji
    if (toolName === 'read') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z"/>
        </svg>
      );
    }
    if (toolName === 'edit' || toolName === 'write') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
        </svg>
      );
    }
    if (toolName === 'bash' || toolName === 'shell') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm1.75-.25a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25H1.75zM7.25 8a.75.75 0 01-.22.53l-2.25 2.25a.75.75 0 01-1.06-1.06L5.44 8 3.72 6.28a.75.75 0 111.06-1.06l2.25 2.25c.141.14.22.331.22.53zm1.5 1.5a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"/>
        </svg>
      );
    }
    if (toolName === 'grep' || toolName === 'search') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.75.75 0 11-1.06 1.06l-3.04-3.04zM11.5 7a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/>
        </svg>
      );
    }
    if (toolName === 'glob') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/>
        </svg>
      );
    }
    if (toolName === 'webfetch' || toolName === 'websearch') {
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zm6.5-3.5a.75.75 0 01.75.75v3.69l1.97 1.97a.75.75 0 11-1.06 1.06l-2.25-2.25a.75.75 0 01-.22-.53v-4a.75.75 0 01.75-.75z"/>
        </svg>
      );
    }
    // Default tool icon
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 01-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 00-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.75.75 0 01-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM5.75 12a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/>
      </svg>
    );
  };

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#fbbf24" strokeWidth="2" fill="none" opacity="0.3"/>
            <circle cx="8" cy="8" r="7" stroke="#fbbf24" strokeWidth="2" fill="none" strokeDasharray="44" strokeDashoffset="11" className="rotating-circle"/>
          </svg>
        );
      case 'completed':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#22c55e' }}>
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
          </svg>
        );
      case 'error':
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#ef4444' }}>
            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM3.72 3.72a.75.75 0 10-1.06 1.06L6.94 8l-4.28 4.28a.75.75 0 101.06 1.06L8 9.06l4.28 4.28a.75.75 0 101.06-1.06L9.06 8l4.28-4.28a.75.75 0 00-1.06-1.06L8 6.94 3.72 3.72z"/>
          </svg>
        );
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#6b7280' }}>
            <circle cx="8" cy="8" r="7" />
          </svg>
        );
    }
  };

  // Extract file path from tool input (for Edit/Write operations)
  const extractFilePath = (): string | null => {
    const toolName = tool.name.toLowerCase();
    if ((toolName === 'edit' || toolName === 'write') && tool.input) {
      return (tool.input as { file_path?: string }).file_path || null;
    }
    return null;
  };

  const filePath = extractFilePath();

  const formatResult = (result: string) => {
    // Truncate long results for preview
    const maxPreviewLength = 120;
    if (!isExpanded && result.length > maxPreviewLength) {
      return result.substring(0, maxPreviewLength) + '...';
    }
    return result;
  };

  const hasResult = tool.result && tool.result.trim().length > 0;
  const hasDiff = tool.diff && tool.diff.lines.length > 0;
  const hasContent = hasResult || hasDiff;

  // Show diff title for Edit/Write operations
  const getToolTitle = () => {
    if (tool.name.toLowerCase() === 'edit' || tool.name.toLowerCase() === 'write') {
      return hasDiff ? 'Changes' : 'Tool Result';
    }
    return 'Tool Result';
  };

  return (
    <div className={`tool-call-card ${tool.status || 'pending'}`}>
      <div
        className="tool-call-header"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        role={hasContent ? "button" : undefined}
        tabIndex={hasContent ? 0 : undefined}
        aria-expanded={hasContent ? isExpanded : undefined}
      >
        <div className="tool-call-icon">
          {getStatusIcon()}
        </div>
        <div className="tool-call-info">
          <span className="tool-call-name">
            {getToolIcon(tool.name)} {getToolTitle()}
          </span>
          {filePath && onOpenFile && (
            <button
              className="tool-call-file-link"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFile(filePath);
              }}
              title={filePath}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/>
              </svg>
              {filePath.split('/').pop() || filePath}
            </button>
          )}
          {tool.result && !hasDiff && !filePath && (
            <span className="tool-call-preview">
              {formatResult(tool.result)}
            </span>
          )}
          {hasDiff && tool.diff && !filePath && (
            <span className="tool-call-preview">
              {tool.diff.fileName || 'File changes'}
            </span>
          )}
        </div>
        {hasContent && (
          <div className="tool-call-expand">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="tool-call-body">
          {hasDiff && tool.diff ? (
            <DiffViewer diff={tool.diff} />
          ) : hasResult ? (
            <pre className="tool-call-result">
              <code>{tool.result}</code>
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default memo(ToolCallCard);
