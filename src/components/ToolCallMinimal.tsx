import { useState, memo } from 'react';
import type { ChatToolCall, TodoItem } from '../types';
import DiffViewer from './DiffViewer';
import TodoWidget from './TodoWidget';
import './ToolCallMinimal.css';

interface ToolCallMinimalProps {
  tool: ChatToolCall;
  onOpenFile?: (path: string) => void;
  onUndoEdit?: (filePath: string) => void;
}

function ToolCallMinimal({ tool, onOpenFile, onUndoEdit }: ToolCallMinimalProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this is a TodoWrite tool
  const isTodoWrite = tool.name.toLowerCase() === 'todowrite';

  // Parse todos from TodoWrite input
  const parseTodos = (): TodoItem[] | null => {
    if (!isTodoWrite || !tool.input) return null;
    try {
      const todos = (tool.input as { todos?: TodoItem[] }).todos;
      return todos || null;
    } catch {
      return null;
    }
  };

  const todos = parseTodos();

  // If this is a TodoWrite tool with valid todos, render TodoWidget instead
  if (isTodoWrite && todos && todos.length > 0) {
    return <TodoWidget todos={todos} defaultExpanded={true} />;
  }

  // Tool colors based on type
  const getToolColor = (name: string): string => {
    const toolName = name.toLowerCase();
    if (toolName === 'edit' || toolName === 'multiedit') return '#F7931E'; // orange
    if (toolName === 'read') return '#00D9FF'; // cyan
    if (toolName === 'write') return '#22c55e'; // green
    if (toolName === 'bash') return '#9B59B6'; // purple
    if (toolName === 'glob' || toolName === 'grep') return '#6b7280'; // gray
    if (toolName === 'task') return '#fbbf24'; // yellow
    if (toolName === 'skill') return '#fbbf24'; // yellow
    if (toolName === 'webfetch' || toolName === 'websearch') return '#10b981'; // emerald
    if (toolName.startsWith('mcp__') || toolName.startsWith('mcp_')) return '#f97316'; // orange
    return '#6b7280'; // default gray
  };

  // Extract target from tool input
  const getToolTarget = (): string => {
    const toolName = tool.name.toLowerCase();
    const input = tool.input as Record<string, unknown>;

    if (!input) return '';

    // File operations
    if (input.file_path) {
      const fullPath = input.file_path as string;
      return fullPath.split('/').pop() || fullPath;
    }

    // Bash command
    if (toolName === 'bash' && input.command) {
      const cmd = input.command as string;
      // Truncate long commands
      return cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd;
    }

    // Grep/Glob pattern
    if (input.pattern) {
      return input.pattern as string;
    }

    // Task description
    if (input.description) {
      return input.description as string;
    }

    // Read path
    if (input.path) {
      const p = input.path as string;
      return p.split('/').pop() || p;
    }

    return '';
  };

  const toolColor = getToolColor(tool.name);
  const toolTarget = getToolTarget();
  const hasResult = tool.result && tool.result.trim().length > 0;
  const hasDiff = tool.diff && tool.diff.lines.length > 0;
  const hasContent = hasResult || hasDiff;

  const filePath = (() => {
    const toolName = tool.name.toLowerCase();
    if ((toolName === 'edit' || toolName === 'write') && tool.input) {
      return (tool.input as { file_path?: string }).file_path || null;
    }
    return null;
  })();

  const isRunning = tool.status === 'running';

  // Status indicator with typing animation for running state
  const StatusIndicator = () => {
    switch (tool.status) {
      case 'running':
        return (
          <span className="tool-status-typing">
            <span />
            <span />
            <span />
          </span>
        );
      case 'completed':
        return <span className="tool-status-check">✓</span>;
      case 'error':
        return <span className="tool-status-error">✗</span>;
      default:
        return <span className="tool-status-dot" />;
    }
  };

  return (
    <div className="tool-minimal">
      <div
        className={`tool-minimal-line ${hasContent ? 'expandable' : ''} ${isExpanded ? 'expanded' : ''} ${isRunning ? 'running' : ''}`}
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
      >
        <span className="tool-minimal-text">
          <span className="tool-minimal-prefix">using</span>
          <span className="tool-minimal-name" style={{ color: toolColor }}>
            {tool.name}
          </span>
          {toolTarget && (
            <>
              <span className="tool-minimal-on">on</span>
              <span className="tool-minimal-target">{toolTarget}</span>
            </>
          )}
        </span>
        <StatusIndicator />
        {hasContent && (
          <span className={`tool-minimal-chevron ${isExpanded ? 'rotated' : ''}`}>
            ›
          </span>
        )}
      </div>

      {isExpanded && hasContent && (
        <div className="tool-minimal-content">
          {hasDiff && tool.diff ? (
            <>
              <DiffViewer diff={tool.diff} />
              {onUndoEdit && filePath && (
                <button
                  className="tool-minimal-undo"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUndoEdit(filePath);
                  }}
                >
                  Undo Changes
                </button>
              )}
            </>
          ) : hasResult ? (
            <pre className="tool-minimal-result">
              <code>{tool.result}</code>
            </pre>
          ) : null}
          {filePath && onOpenFile && (
            <button
              className="tool-minimal-open-file"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFile(filePath);
              }}
            >
              Open {filePath.split('/').pop()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ToolCallMinimal);
