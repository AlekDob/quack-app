import { useState, memo } from 'react';
import type { ChatToolCall } from '../types';
import DiffViewer from './DiffViewer';
import './ToolCallCard.css';

interface ToolCallCardProps {
  tool: ChatToolCall;
}

function ToolCallCard({ tool }: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getToolIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'read':
        return '📖';
      case 'edit':
      case 'write':
        return '✏️';
      case 'bash':
      case 'shell':
        return '💻';
      case 'grep':
      case 'search':
        return '🔍';
      case 'glob':
        return '📁';
      case 'webfetch':
      case 'websearch':
        return '🌐';
      default:
        return '🔧';
    }
  };

  const getStatusIcon = () => {
    switch (tool.status) {
      case 'running':
        return '🟡';
      case 'completed':
        return '✅';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

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
          {tool.result && !hasDiff && (
            <span className="tool-call-preview">
              {formatResult(tool.result)}
            </span>
          )}
          {hasDiff && tool.diff && (
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
