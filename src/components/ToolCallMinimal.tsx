import { useState, useCallback, memo } from 'react';
import type { ChatToolCall, TodoItem } from '../types';
import DiffViewer from './DiffViewer';
import TodoWidget from './TodoWidget';
import './ToolCallMinimal.css';
import { isBrainRead, BRAIN_COLOR } from '../utils/brainPathDetection';

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
    if (toolName === 'edit' || toolName === 'multiedit') return 'var(--accent-color)'; // orange
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

  // Full path/command for tooltip and copy (not truncated)
  const getFullTarget = (): string => {
    const toolName = tool.name.toLowerCase();
    const input = tool.input as Record<string, unknown>;
    if (!input) return '';

    if (input.file_path) return input.file_path as string;
    if (toolName === 'bash' && input.command) return input.command as string;
    if (input.pattern) return input.pattern as string;
    if (input.description) return input.description as string;
    if (input.path) return input.path as string;
    return '';
  };

  const toolColor = getToolColor(tool.name);
  const isBrain = isBrainRead(tool.name, tool.input as Record<string, unknown>);
  const finalToolColor = isBrain ? BRAIN_COLOR : toolColor;
  const toolTarget = getToolTarget();
  const fullTarget = getFullTarget();
  const [copied, setCopied] = useState(false);

  const handleCopyTarget = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fullTarget) return;
    navigator.clipboard.writeText(fullTarget);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [fullTarget]);

  const hasResult = tool.result && tool.result.trim().length > 0;
  const hasDiff = tool.diff && tool.diff.lines.length > 0;
  const hasContent = hasResult || hasDiff;

  // Extract file path from any tool that references a file
  const filePath = (() => {
    if (!tool.input) return null;
    const inp = tool.input as Record<string, unknown>;
    if (typeof inp.file_path === 'string') return inp.file_path;
    const toolName = tool.name.toLowerCase();
    if ((toolName === 'read' || toolName === 'glob') && typeof inp.path === 'string') return inp.path;
    return null;
  })();

  const isRunning = tool.status === 'running';
  const isSkill = tool.name.toLowerCase() === 'skill';

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
        className={`tool-minimal-line ${hasContent ? 'expandable' : ''} ${isExpanded ? 'expanded' : ''} ${isRunning ? 'running' : ''} ${isSkill ? 'skill' : ''} ${isBrain ? 'brain-read' : ''}`}
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
      >
        <span className="tool-minimal-text">
          <span className="tool-minimal-prefix">using</span>
          <span className="tool-minimal-name" style={{ color: finalToolColor }}>
            {tool.name}
          </span>
          {isBrain && <span className="tool-brain-badge">Brain</span>}
          {toolTarget && (
            <>
              <span className="tool-minimal-on">on</span>
              <span
                className={`tool-minimal-target ${fullTarget ? 'copyable' : ''} ${copied ? 'copied' : ''}`}
                title={fullTarget || toolTarget}
                onClick={fullTarget ? handleCopyTarget : undefined}
              >
                {copied ? 'Copied!' : toolTarget}
              </span>
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
          {/* File path bar with Open button + drag-to-split */}
          {filePath && (
            <div
              className="tool-minimal-file-path"
              draggable
              onDragStart={(e) => {
                const fileName = filePath.split('/').pop() || filePath;
                const fileData = JSON.stringify({ type: 'file', name: fileName, path: filePath });
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/quack-file', fileData);
                e.dataTransfer.setData('text/plain', filePath);
              }}
            >
              <svg className="tool-minimal-file-path-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span
                className="tool-minimal-file-path-text"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenFile) onOpenFile(filePath);
                }}
                style={{ cursor: onOpenFile ? 'pointer' : 'default' }}
                title={onOpenFile ? 'Apri in Quack' : undefined}
              >
                {filePath}
              </span>
              {onOpenFile && (
                <button
                  className="tool-minimal-open-ide-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFile(filePath);
                  }}
                  title="Apri file"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open
                </button>
              )}
            </div>
          )}
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
        </div>
      )}
    </div>
  );
}

export default memo(ToolCallMinimal);
