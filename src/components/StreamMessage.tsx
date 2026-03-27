import React, { useMemo, useState, useEffect, memo, useCallback } from 'react';
import './ToolWidgets.css';
import './ToolCallMinimal.css';
import {
  SystemInitializedWidget,
  TodoWriteWidget,
  ExitPlanModeWidget,
  EnterPlanModeWidget,
  ImagePreviewWidget,
} from './ToolWidgets';
import MarkdownText from './MarkdownText';
import ThinkingBlock from './ThinkingBlock';
import { TaskWidget } from './TaskWidget';
import { TaskOutputWidget } from './TaskOutputWidget';
import { AgentResultCard } from './AgentResultCard';
import AskUserQuestionWidget from './AskUserQuestionWidget';
import DiffViewer from './DiffViewer';
import CompactingIndicator from './CompactingIndicator';
import { getAvatarUrl } from '../utils/agentAvatars';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import { useAgentInfo } from '../hooks/useAgentInfo';
import type { ClaudeEvent, AskUserQuestionAnswers, DiffLine, ToolDiff } from '../types';
import { BugReportWidget, WebAnalysisCard, structuredOutputRegistry } from './structured-outputs';
import { isBugReportOutput, isWebAnalysisOutput } from '../types/structuredOutputs';
import { TeammateWidget } from './TeammateWidget';
import { useTeamStore } from '../stores/teamStore';
import { useAgentAvatar } from '../hooks/useAgentAvatar';
import type { TeamConfig } from '../types';
import { isBrainRead, BRAIN_COLOR } from '../utils/brainPathDetection';
import HtmlVisualizer from './chat/HtmlVisualizer';

// Import duck avatar
import duckAvatar from '../../images/duck.png';

// Mini avatar for team badge - uses useAgentAvatar with avatar filename from TeamMember
function TeamMemberMiniAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const avatarUrl = useAgentAvatar(name, avatar);
  return (
    <img
      src={avatarUrl}
      alt={name}
      title={name}
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(0, 217, 255, 0.3)',
      }}
    />
  );
}

// Team mode badge with mini avatars
function TeamModeBadge({ team }: { team: TeamConfig }) {
  return (
    <span className="team-mode-badge">
      <span className="team-mode-badge-avatars">
        {team.members.map(m => (
          <TeamMemberMiniAvatar key={m.agentId} name={m.name} avatar={m.avatar} />
        ))}
      </span>
      {team.name}
    </span>
  );
}

// Helper function to convert old/new strings to ToolDiff
function createDiffFromStrings(oldString: string, newString: string, fileName?: string): ToolDiff {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const lines: DiffLine[] = [];

  oldLines.forEach((line) => {
    lines.push({ type: 'removed', content: line });
  });
  newLines.forEach((line) => {
    lines.push({ type: 'added', content: line });
  });

  return { fileName, lines };
}

// Get tool color based on type - minimal style
const getToolColorMinimal = (name: string): string => {
  const toolName = name.toLowerCase();
  if (toolName === 'edit' || toolName === 'multiedit') return '#F7931E'; // orange
  if (toolName === 'read') return '#00D9FF'; // cyan
  if (toolName === 'write') return '#22c55e'; // green
  if (toolName === 'bash') return '#9B59B6'; // purple
  if (toolName === 'glob' || toolName === 'grep') return '#6b7280'; // gray
  if (toolName === 'task') return '#fbbf24'; // yellow
  if (toolName === 'webfetch' || toolName === 'websearch') return '#10b981'; // emerald
  // Agent Teams native primitives
  if (toolName === 'teamcreate' || toolName === 'teamdelete') return '#C084FC'; // bright lilac
  if (toolName === 'sendmessage') return '#06B6D4'; // cyan (communication)
  if (toolName === 'taskcreate' || toolName === 'taskupdate' || toolName === 'tasklist') return '#F59E0B'; // amber
  if (toolName.startsWith('mcp__') || toolName.startsWith('mcp_')) return '#f97316'; // orange
  return '#6b7280'; // default gray
};

// Tools rendered as special widgets (never grouped into rows)
export const SPECIAL_WIDGET_TOOLS = new Set([
  'todowrite', 'exitplanmode', 'enterplanmode',
  'askuserquestion', 'task', 'taskoutput', 'agent',
  'mcp__visualizer__visualize_html',
]);

// Tools that always get their own row (expandable diffs/undo)
export const SOLO_ROW_TOOLS = new Set(['edit', 'multiedit', 'write']);

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico'];

export function isImageRead(toolName: string, input: Record<string, unknown> | undefined): boolean {
  if (toolName !== 'read' || !input?.file_path) return false;
  return IMAGE_EXTENSIONS.some(ext => (input.file_path as string).toLowerCase().endsWith(ext));
}

// Grouping types for consecutive tool rendering
type ToolGroup =
  | { kind: 'standalone'; contentItem: any; index: number }
  | { kind: 'group'; items: { contentItem: any; index: number }[] };

// Extract target from tool input for minimal display
const getToolTarget = (toolName: string, input: Record<string, unknown> | undefined): string => {
  if (!input) return '';
  const name = toolName.toLowerCase();

  // File operations
  if (input.file_path) {
    const fullPath = input.file_path as string;
    return fullPath.split('/').pop() || fullPath;
  }

  // Bash command
  if (name === 'bash' && input.command) {
    const cmd = input.command as string;
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

// Minimal tool display component for streaming
interface ToolMinimalStreamProps {
  toolName: string;
  input: Record<string, unknown> | undefined;
  isLoading: boolean;
  hasError?: boolean;
  result?: any;
  onFilePathClick?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onUndoEdit?: (filePath: string) => void;
}

const ToolMinimalStream: React.FC<ToolMinimalStreamProps> = ({
  toolName,
  input,
  isLoading,
  hasError,
  result,
  onFilePathClick,
  onOpenInIDE,
  onUndoEdit,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isBrain = isBrainRead(toolName, input);
  const toolColor = isBrain ? BRAIN_COLOR : getToolColorMinimal(toolName);
  const toolTarget = getToolTarget(toolName, input);
  const name = toolName.toLowerCase();

  // Determine if we have expandable content
  const hasExpandableContent = result?.content ||
    (name === 'edit' && input?.old_string && input?.new_string);

  const StatusIndicator = () => {
    if (isLoading) {
      return (
        <span className="tool-status-typing">
          <span /><span /><span />
        </span>
      );
    }
    if (hasError) {
      return <span className="tool-status-error">&#10005;</span>;
    }
    return <span className="tool-status-check">&#10003;</span>;
  };

  return (
    <div className={`tool-minimal${isExpanded ? ' tool-minimal--expanded' : ''}`}>
      <div
        className={`tool-minimal-line ${hasExpandableContent ? 'expandable' : ''} ${isExpanded ? 'expanded' : ''} ${isLoading ? 'running' : ''} ${isBrain ? 'brain-read' : ''}`}
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        <span className="tool-minimal-text">
          <span className="tool-minimal-prefix">using</span>
          <span className="tool-minimal-name" style={{ color: toolColor }}>
            {toolName}
          </span>
          {isBrain && <span className="tool-brain-badge">Brain</span>}
          {toolTarget && (
            <>
              <span className="tool-minimal-on">on</span>
              <span className="tool-minimal-target">{toolTarget}</span>
            </>
          )}
        </span>
        <StatusIndicator />
        {hasExpandableContent && (
          <span className={`tool-minimal-chevron ${isExpanded ? 'rotated' : ''}`}>
            &#8250;
          </span>
        )}
      </div>

      {isExpanded && hasExpandableContent && (
        <div className="tool-minimal-content">
          {/* File path with Open in IDE button */}
          {typeof input?.file_path === 'string' && (
            <div className="tool-minimal-file-path">
              <svg className="tool-minimal-file-path-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span
                className="tool-minimal-file-path-text"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onFilePathClick) onFilePathClick(input.file_path as string);
                }}
                style={{ cursor: onFilePathClick ? 'pointer' : 'default' }}
                title={onFilePathClick ? "Open in Quack" : undefined}
              >
                {input.file_path}
              </span>
              {onOpenInIDE && (
                <button
                  className="tool-minimal-open-ide-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInIDE(input.file_path as string);
                  }}
                  title="Open in IDE"
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

          {name === 'edit' && input?.old_string && input?.new_string ? (
            <>
              <DiffViewer diff={createDiffFromStrings(
                input.old_string as string,
                input.new_string as string,
                input.file_path as string | undefined
              )} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {typeof input.file_path === 'string' && onUndoEdit && (
                  <button
                    className="tool-minimal-undo"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndoEdit(input.file_path as string);
                    }}
                  >
                    Undo Changes
                  </button>
                )}
              </div>
            </>
          ) : result?.content ? (
            <pre className="tool-minimal-result">
              <code>{typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}</code>
            </pre>
          ) : null}
        </div>
      )}
    </div>
  );
};

// Memoized components for performance
const MemoizedTaskWidget = memo(TaskWidget);
const MemoizedTaskOutputWidget = memo(TaskOutputWidget);
const MemoizedTodoWriteWidget = memo(TodoWriteWidget);
const MemoizedExitPlanModeWidget = memo(ExitPlanModeWidget);
const MemoizedEnterPlanModeWidget = memo(EnterPlanModeWidget);
const MemoizedAskUserQuestionWidget = memo(AskUserQuestionWidget);
const MemoizedAgentResultCard = memo(AgentResultCard);
const MemoizedImagePreviewWidget = memo(ImagePreviewWidget);
const MemoizedToolMinimalStream = memo(ToolMinimalStream);


interface StreamMessageProps {
  message: ClaudeEvent;
  streamMessages: ClaudeEvent[];
  onFilePathClick?: (path: string) => void;
  onOpenInIDE?: (path: string) => void; // Callback to open file in preferred IDE
  onUndoEdit?: (filePath: string) => void; // Callback to undo file edit
  agentName?: string;
  agentAvatar?: string;
  workingDirectory?: string; // Current working directory for file operations
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>; // Tool IDs with pending questions
  answeredQuestions?: Map<string, AskUserQuestionAnswers>; // Already answered questions
  showThinkingBlocks?: boolean; // Show/hide ThinkingBlocks (controlled by footer icon)
  // File Checkpointing (SDK 0.2.7+)
  sessionId?: string; // Session ID for rewind operations
  onRewindFiles?: (userMessageId: string) => void; // Callback to rewind files to a specific message
  // Image preview
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  // Plan approval
  pendingPlanApprovalIds?: Set<string>; // Request IDs with pending plan approvals
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  // Teammate stream drill-down
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
  // Whether to show the agent header (avatar, name) — used for grouping consecutive messages
  showHeader?: boolean;
  // Whether this message's tools are running while a subagent is active
  isNestedUnderAgent?: boolean;
  // The subagent_type of the droid this message is nested under (e.g. "git-commit-manager")
  nestedDroidType?: string;
}

const StreamMessage: React.FC<StreamMessageProps> = ({
  message,
  streamMessages,
  onFilePathClick,
  onOpenInIDE,
  onUndoEdit,
  agentName = 'Jack',
  agentAvatar,
  workingDirectory,
  onUserQuestionAnswer,
  pendingQuestionIds,
  answeredQuestions,
  showThinkingBlocks = true,
  sessionId,
  onRewindFiles,
  onOpenImageTab,
  pendingPlanApprovalIds,
  onPlanApprovalResponse,
  onTeammateDrillDown,
  showHeader = true,
  isNestedUnderAgent = false,
  nestedDroidType,
}) => {
  // State for avatar URL (handles both default and custom avatars)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // When nested under a droid, use the droid's avatar and name instead of parent agent's
  const droidInfo = useAgentInfo(nestedDroidType || '', workingDirectory);

  // Load avatar URL (custom or default)
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      if (!agentAvatar) {
        setAvatarUrl(null);
        return;
      }

      // Check if it's a custom avatar (UUID format)
      if (isCustomAvatar(agentAvatar)) {
        try {
          const url = await getCustomAvatarUrl(agentAvatar);
          if (isMounted) {
            setAvatarUrl(url);
          }
        } catch (error) {
          console.error('Failed to load custom avatar in stream:', error);
          if (isMounted) {
            setAvatarUrl(null);
          }
        }
      } else {
        // Default avatar - need to get full path with prefix
        if (isMounted) {
          setAvatarUrl(getAvatarUrl(agentAvatar));
        }
      }
    }

    loadAvatarUrl();

    return () => {
      isMounted = false;
    };
  }, [agentAvatar]);

  // Reactive subscriptions to team state (avoids getState() in render)
  const activeTeam = useTeamStore((s) => s.activeTeam);
  const teammateStatus = useTeamStore((s) => s.teammateStatus);

  // Build a map of tool results for quick lookup
  const toolResults = useMemo(() => {
    const results = new Map<string, any>();

    streamMessages.forEach((msg) => {
      if (msg.type === 'user' && msg.message?.content && Array.isArray(msg.message.content)) {
        msg.message.content.forEach((content: any) => {
          if (content.type === 'tool_result' && content.tool_use_id) {
            results.set(content.tool_use_id, content);
          }
        });
      }
    });

    return results;
  }, [streamMessages]);

  // Helper function to extract image data from tool results
  const extractImageData = useCallback((toolResult: any): { data: string; mediaType: string } | null => {
    if (!toolResult) return null;

    // tool_result.content can be an array of content blocks
    const content = toolResult.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'image' && block.source?.type === 'base64') {
          return { data: block.source.data, mediaType: block.source.media_type || 'image/png' };
        }
      }
    }

    // Or it could be a single image object
    if (content?.type === 'image' && content?.source?.type === 'base64') {
      return { data: content.source.data, mediaType: content.source.media_type || 'image/png' };
    }

    return null;
  }, []);


  // System initialization message (skip on resumed sessions)
  if (message.type === 'system' && message.subtype === 'init') {
    if (message.isResumed) return null;
    return (
      <SystemInitializedWidget
        sessionId={message.session_id}
        model={message.model}
        cwd={message.cwd}
        tools={message.tools}
        defaultExpanded={false}
      />
    );
  }

  // Context compaction status indicator
  if (message.type === 'system' && message.subtype === 'status' && message.status === 'compacting') {
    return <CompactingIndicator isCompacting={true} />;
  }

  // Context compaction boundary (compaction completed)
  if (message.type === 'system' && message.subtype === 'compact_boundary') {
    return <CompactingIndicator isCompacting={false} />;
  }

  // Assistant message - contains text and tool uses
  if (message.type === 'assistant' && message.message) {
    const msg = message.message;

    if (!msg.content || !Array.isArray(msg.content)) {
      return null;
    }

    // Find the last TodoWrite tool_use ID across all stream events
    // so earlier TodoWrite sections are marked stale (animations stopped)
    const lastTodoWriteId = useMemo(() => {
      let lastId: string | null = null;
      streamMessages.forEach((evt: any) => {
        if (evt.type === 'assistant' && evt.message?.content && Array.isArray(evt.message.content)) {
          evt.message.content.forEach((c: any) => {
            if (c.type === 'tool_use' && c.name?.toLowerCase() === 'todowrite' && c.id) {
              lastId = c.id;
            }
          });
        }
      });
      return lastId;
    }, [streamMessages]);

    // Render tools separately (after the main avatar+text block)
    const renderToolContent = (content: any, idx: number) => {
      const toolName = content.name?.toLowerCase();
      const input = content.input;
      const toolId = content.id;
      const toolResult = toolResults.get(toolId);

      // TodoWrite tool - special widget
      if (toolName === 'todowrite' && input?.todos && Array.isArray(input.todos)) {
        return (
          <MemoizedTodoWriteWidget
            key={idx}
            todos={input.todos}
            defaultExpanded={true}
            isStale={toolId !== lastTodoWriteId}
          />
        );
      }

      // ExitPlanMode tool - special widget
      if (toolName === 'exitplanmode' && input?.plan) {
        // Find matching pending plan approval requestId for this agent
        const pendingRequestId = pendingPlanApprovalIds
          ? Array.from(pendingPlanApprovalIds)[0]
          : undefined;

        return (
          <MemoizedExitPlanModeWidget
            key={idx}
            plan={input.plan}
            workingDirectory={workingDirectory}
            defaultExpanded={true}
            pendingApprovalRequestId={pendingRequestId}
            onApprovalResponse={onPlanApprovalResponse}
          />
        );
      }

      // EnterPlanMode tool - special widget
      if (toolName === 'enterplanmode') {
        const isFirstEnterPlanMode = msg.content.findIndex(
          (c: any) => c.type === 'tool_use' && c.name?.toLowerCase() === 'enterplanmode'
        ) === idx;

        if (!isFirstEnterPlanMode) {
          return null;
        }

        return (
          <MemoizedEnterPlanModeWidget
            key={idx}
            objective={input?.objective}
            defaultExpanded={false}
          />
        );
      }

      // AskUserQuestion tool - special widget
      if (toolName === 'askuserquestion' && input?.questions) {
        let questions = input.questions;

        if (typeof questions === 'string') {
          try {
            questions = JSON.parse(questions);
          } catch (e) {
            console.error('Failed to parse questions string:', e);
          }
        }

        if (Array.isArray(questions)) {
          const existingAnswer = answeredQuestions?.get(toolId);
          const isAnswered = !!existingAnswer || !!toolResult;

          return (
            <MemoizedAskUserQuestionWidget
              key={idx}
              questions={questions}
              toolUseId={toolId}
              onSubmit={(id, answers) => onUserQuestionAnswer?.(id, answers, sessionId)}
              disabled={isAnswered}
              existingAnswers={existingAnswer}
            />
          );
        }
      }

      // Brain: quack-visualizer-inline-html
      // Visualize HTML tool — renders interactive iframe inline in chat
      if (toolName === 'mcp__visualizer__visualize_html' && input?.html) {
        return (
          <HtmlVisualizer key={idx} html={input.html as string} title={input.title as string | undefined} />
        );
      }

      // Task tool (subagent) - special widget
      // Check if task description mentions a team member → show TeammateWidget
      if (toolName === 'task' && input?.subagent_type) {
        if (activeTeam) {
          const taskText = `${input.description || ''} ${input.prompt || ''}`.toLowerCase();
          const matchedMember = activeTeam.members.find(m =>
            taskText.includes(m.name.toLowerCase())
          );
          if (matchedMember) {
            const teammateState = teammateStatus.get(matchedMember.name);
            return (
              <TeammateWidget
                key={idx}
                name={matchedMember.name}
                role={input.description || matchedMember.role}
                agentId={matchedMember.agentId}
                action={toolResult ? 'stop' : 'start'}
                avatar={matchedMember.avatar}
                color={matchedMember.color}
                sessionId={teammateState?.sessionId}
                onDrillDown={onTeammateDrillDown}
              />
            );
          }
        }

        // Risultato completato → mostra report card
        if (toolResult) {
          return (
            <MemoizedAgentResultCard
              key={idx}
              subagentType={input.subagent_type}
              description={input.description || 'Task completato'}
              rawResult={toolResult}
              workingDirectory={workingDirectory}
            />
          );
        }

        return (
          <MemoizedTaskWidget
            key={idx}
            subagentType={input.subagent_type}
            description={input.description || 'Running task'}
            isLoading={true}
            workingDirectory={workingDirectory}
          />
        );
      }

      // Agent tool - report card when completed
      if (toolName === 'agent') {
        if (toolResult) {
          return (
            <MemoizedAgentResultCard
              key={idx}
              subagentType={input?.subagent_type}
              description={input?.description || 'Agent task'}
              rawResult={toolResult}
              workingDirectory={workingDirectory}
            />
          );
        }
        return (
          <MemoizedTaskWidget
            key={idx}
            subagentType={input?.subagent_type || 'agent'}
            description={input?.description || 'Running agent'}
            isLoading={true}
            workingDirectory={workingDirectory}
          />
        );
      }

      // TaskOutput tool - special widget
      if (toolName === 'taskoutput' && input?.task_id) {
        let status: 'pending' | 'running' | 'completed' | 'error' | 'unknown' = 'unknown';
        let output: string | undefined;
        let error: string | undefined;

        if (toolResult) {
          try {
            const result = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
            status = result.status || 'completed';
            output = result.output || result.result || (typeof toolResult === 'string' ? toolResult : JSON.stringify(result, null, 2));
            error = result.error;
          } catch {
            output = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
            status = 'completed';
          }
        }

        return (
          <MemoizedTaskOutputWidget
            key={idx}
            taskId={input.task_id}
            status={status}
            output={output}
            error={error}
            block={input.block}
            timeout={input.timeout}
            isLoading={!toolResult}
            defaultExpanded={true}
          />
        );
      }

      // Read tool - check for image files (special handling)
      if (isImageRead(toolName, input)) {
        if (toolResult) {
          const imageContent = extractImageData(toolResult);
          if (imageContent) {
            return (
              <MemoizedImagePreviewWidget
                key={idx}
                filePath={input.file_path}
                imageData={imageContent.data}
                mediaType={imageContent.mediaType}
                onOpenInTab={onOpenImageTab}
              />
            );
          }
        }
      }

      // All other tools - use minimal display
      return (
        <MemoizedToolMinimalStream
          key={idx}
          toolName={content.name || 'unknown'}
          input={input}
          isLoading={!toolResult}
          hasError={toolResult?.is_error}
          result={toolResult}
          onFilePathClick={onFilePathClick}
          onOpenInIDE={onOpenInIDE}
          onUndoEdit={onUndoEdit}
        />
      );
    };

    // Collect text content and rules
    let combinedText = '';
    let ruleNames: string[] = [];

    msg.content.forEach((content: any) => {
      if (content.type === 'text' && content.text) {
        const rulesMatch = content.text.match(/^(?:Following rules?:\s*)(.+)$/m);
        if (rulesMatch) {
          ruleNames = rulesMatch[1].split(',').map((r: string) => r.trim().replace(/\.$/, '')).filter(Boolean);
          combinedText += content.text.replace(/^Following rules?:\s*.+$/m, '').replace(/^\n+/, '');
        } else {
          combinedText += content.text;
        }
      }
    });

    return (
      <div className={`stream-message assistant-message${!showHeader ? ' no-header' : ''}${isNestedUnderAgent ? ' nested-under-agent' : ''}`}>
        {/* Thinking blocks - rendered before the main content */}
        {msg.content.map((content: any, idx: number) => {
          if (content.type === 'thinking' && content.thinking && showThinkingBlocks) {
            return (
              <ThinkingBlock
                key={`thinking-${idx}`}
                content={content.thinking}
                defaultExpanded={false}
              />
            );
          }
          return null;
        })}

        {/* Avatar + Content block */}
        <div className="assistant-text">
          {showHeader && (
            <div className="assistant-avatar">
              {nestedDroidType ? (
                <img src={droidInfo.avatarUrl} alt={nestedDroidType} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt={agentName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <img src={duckAvatar} alt="Quack Agency" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              )}
            </div>
          )}
          <div className="assistant-content">
            {showHeader && (
              <div className="assistant-name">
                {nestedDroidType
                  ? nestedDroidType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : agentName}
                {!nestedDroidType && activeTeam && (() => {
                  const normalizedAgent = agentName.toLowerCase().replace('agent ', '');
                  const isMember = activeTeam.members.some(m =>
                    m.name.toLowerCase().replace('agent ', '') === normalizedAgent
                  );
                  if (!isMember) return null;
                  return <TeamModeBadge team={activeTeam} />;
                })()}
              </div>
            )}
            {ruleNames.length > 0 && (
              <div className="rules-pills">
                <svg className="rules-pills-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {ruleNames.map((name: string) => (
                  <span key={name} className="rule-pill">{name}</span>
                ))}
              </div>
            )}
            {/* Text content */}
            {combinedText.trim() && (
              <div className="assistant-message-text">
                <MarkdownText>{combinedText.trim()}</MarkdownText>
              </div>
            )}
            {/* Tool uses - consecutive groupable tools flow horizontally */}
            {(() => {
              const groups: ToolGroup[] = [];
              let currentGroup: { contentItem: any; index: number }[] | null = null;

              const flushGroup = () => {
                if (!currentGroup) return;
                if (currentGroup.length === 1) {
                  groups.push({ kind: 'standalone', contentItem: currentGroup[0].contentItem, index: currentGroup[0].index });
                } else {
                  groups.push({ kind: 'group', items: currentGroup });
                }
                currentGroup = null;
              };

              msg.content.forEach((content: any, idx: number) => {
                if (content.type !== 'tool_use') {
                  flushGroup();
                  return;
                }
                const name = (content.name || '').toLowerCase();

                // Special widgets, solo-row tools, and image reads always standalone
                if (SPECIAL_WIDGET_TOOLS.has(name) || SOLO_ROW_TOOLS.has(name) || isImageRead(name, content.input)) {
                  flushGroup();
                  groups.push({ kind: 'standalone', contentItem: content, index: idx });
                  return;
                }

                // Add to current group (any groupable tool type)
                if (currentGroup) {
                  currentGroup.push({ contentItem: content, index: idx });
                } else {
                  currentGroup = [{ contentItem: content, index: idx }];
                }
              });
              flushGroup();

              // Check if this message has file-modifying tools (for rewind button)
              const hasFileChanges = msg.content.some(
                (c: any) => c.type === 'tool_use' && ['edit', 'write', 'multiedit'].includes(c.name?.toLowerCase())
              );
              const messageIndex = streamMessages.findIndex((m) => m === message);
              let precedingUserMessageUuid: string | undefined;
              if (messageIndex > 0) {
                for (let i = messageIndex - 1; i >= 0; i--) {
                  const prevMsg = streamMessages[i];
                  if (prevMsg.type === 'user') {
                    precedingUserMessageUuid = (prevMsg as any).uuid;
                    break;
                  }
                }
              }
              const showRewind = hasFileChanges && onRewindFiles && sessionId && precedingUserMessageUuid;

              const rewindButton = showRewind ? (
                <button
                  onClick={() => onRewindFiles(precedingUserMessageUuid!)}
                  className="rewind-button"
                  title="Undo all file changes from this response"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    background: 'transparent',
                    border: '1px solid rgba(251, 146, 60, 0.25)',
                    borderRadius: '4px',
                    color: 'rgba(251, 191, 136, 0.7)',
                    fontSize: '10px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(251, 146, 60, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.4)';
                    e.currentTarget.style.color = 'rgb(251, 191, 136)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.25)';
                    e.currentTarget.style.color = 'rgba(251, 191, 136, 0.7)';
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  Undo
                </button>
              ) : null;

              // Find the last group index to attach the rewind button
              const lastGroupIndex = groups.length - 1;

              return groups.map((group, gi) => {
                const isLast = gi === lastGroupIndex;
                if (group.kind === 'standalone') {
                  if (isLast && rewindButton) {
                    return (
                      <div key={`tool-rewind-${group.index}`} className="tool-rewind-row">
                        {renderToolContent(group.contentItem, group.index)}
                        {rewindButton}
                      </div>
                    );
                  }
                  return renderToolContent(group.contentItem, group.index);
                }
                return (
                  <div key={`tool-group-${group.items[0].index}`} className={`tool-group-row${isLast && rewindButton ? ' tool-rewind-row' : ''}`}>
                    {group.items.map(({ contentItem, index }) =>
                      renderToolContent(contentItem, index)
                    )}
                    {isLast && rewindButton}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  }

  // User messages - typically tool results, but we skip them since they're shown in the tool widgets
  if (message.type === 'user') {
    // Skip - tool results are displayed inline with their tool calls
    return null;
  }

  // Agent event - subagent start/stop
  if (message.type === 'agent') {
    const agentEvent = message as any;
    const agentType = agentEvent.agent_type || agentEvent.agent_name || 'subagent';
    const eventAction = agentEvent.action as 'start' | 'stop';

    // Check if this agent event matches a team member
    if (activeTeam && agentEvent.agent_name) {
      const eventName = (agentEvent.agent_name as string).toLowerCase();
      const matchedMember = activeTeam.members.find(m =>
        m.name.toLowerCase() === eventName ||
        m.name.toLowerCase().includes(eventName) ||
        eventName.includes(m.name.toLowerCase())
      );

      if (matchedMember) {
        return (
          <TeammateWidget
            name={matchedMember.name}
            role={matchedMember.role}
            agentId={matchedMember.agentId}
            action={eventAction || 'start'}
            avatar={matchedMember.avatar}
            color={matchedMember.color}
            sessionId={agentEvent.session_id}
            onDrillDown={onTeammateDrillDown}
          />
        );
      }
    }

    // Default: use TaskWidget for droids/subagents
    if (eventAction === 'start') {
      return (
        <TaskWidget
          subagentType={agentType}
          description="Starting..."
          isLoading={true}
          workingDirectory={workingDirectory}
        />
      );
    }

    if (eventAction === 'stop') {
      return (
        <TaskWidget
          subagentType={agentType}
          description="Completed"
          isLoading={false}
          workingDirectory={workingDirectory}
        />
      );
    }
  }

  // Error event - show errors prominently
  if (message.type === 'error') {
    const errorEvent = message as any;

    return (
      <div className="stream-message error-message">
        <div className="tool-widget" style={{ borderLeft: '3px solid #ff4757' }}>
          <div className="tool-widget-header">
            <div className="tool-widget-title">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#ff4757">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              <span style={{ color: '#ff4757' }}>Stream Error</span>
            </div>
          </div>
          <div className="tool-widget-content">
            <div style={{ color: '#ff4757', padding: '8px', backgroundColor: 'rgba(255, 71, 87, 0.1)', borderRadius: '4px' }}>
              {errorEvent.error}
              {errorEvent.code && <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Code: {errorEvent.code}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Result message - final summary with consolidated layout
  if (message.type === 'result') {
    // Check for structured output in the message
    const structuredOutput = (message as any).structured_output;

    // Check if ANY assistant event already has text content.
    // The result event's text is always an aggregation of streamed assistant text,
    // so showing it would duplicate what the user already sees.
    const anyAssistantHasText = useMemo(() => {
      return streamMessages.some((msg) => {
        if (msg.type !== 'assistant' || !msg.message?.content) return false;
        const content = msg.message.content;
        if (!Array.isArray(content)) return false;
        return content.some((c: any) => c.type === 'text' && c.text?.trim());
      });
    }, [streamMessages]);

    // Only show result text if no assistant event showed text, or if there's an error
    const shouldShowResultText = message.error || (message.result && !anyAssistantHasText);

    // If we don't need to show the text, render only stats without avatar/name
    if (!shouldShowResultText) {
      return (
        <div className="result-stats-only">
          {message.duration_ms !== undefined && (
            <span className="result-stat-inline">
              Duration: {(message.duration_ms / 1000).toFixed(2)}s
            </span>
          )}
          {message.usage && (
            <span className="result-stat-inline">
              Tokens: {message.usage.input_tokens + message.usage.output_tokens} ({message.usage.input_tokens} in, {message.usage.output_tokens} out)
            </span>
          )}
          {message.stop_reason && (
            <span className="result-stat-inline" style={{ color: message.stop_reason === 'end_turn' ? '#00D9FF' : '#F7931E' }}>
              Stop: {message.stop_reason}
            </span>
          )}
        </div>
      );
    }

    // If we need to show text (error or different result), show full message with avatar
    return (
      <div className="assistant-text result-message-consolidated">
        <div className="assistant-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={agentName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <img src={duckAvatar} alt="Quack Agency" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          )}
        </div>
        <div className="assistant-content" style={{ width: '100%' }}>
          <div className="assistant-name">{agentName}</div>

          {/* Structured Output Widgets */}
          {structuredOutput && isBugReportOutput(structuredOutput) && (
            <BugReportWidget
              data={structuredOutput}
              onFileClick={(path, line) => onFilePathClick?.(line ? `${path}:${line}` : path)}
            />
          )}
          {structuredOutput && isWebAnalysisOutput(structuredOutput) && (
            <WebAnalysisCard
              data={structuredOutput}
              onLinkClick={(url) => window.open(url, '_blank')}
            />
          )}
          {/* Registry fallback for new structured output types */}
          {structuredOutput && !isBugReportOutput(structuredOutput) && !isWebAnalysisOutput(structuredOutput) && (() => {
            const RendererComponent = structuredOutputRegistry.find(structuredOutput);
            if (!RendererComponent) return null;
            return <RendererComponent data={structuredOutput as never} />;
          })()}

          {/* Regular text result */}
          {message.result && !structuredOutput && (
            <div className="assistant-message-text">
              <MarkdownText>{message.result}</MarkdownText>
            </div>
          )}

          {/* Error display — Brain: fix-bedrock-model-override */}
          {message.error && (
            <div className="result-error-inline">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              <div>
                {message.error}
                {message.error.includes('model identifier is invalid') && (
                  <div style={{ marginTop: 6, fontSize: 11, opacity: 0.85, lineHeight: 1.5 }}>
                    <strong>Tip:</strong> This model may not be available on your cloud provider (Bedrock/Vertex).
                    Go to Settings → Cloud Provider → Model Override and paste your provider-specific model ID or ARN.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="result-stats-compact">
            {message.duration_ms !== undefined && (
              <span className="result-stat-inline">
                Duration: {(message.duration_ms / 1000).toFixed(2)}s
              </span>
            )}
            {message.usage && (
              <span className="result-stat-inline">
                Tokens: {message.usage.input_tokens + message.usage.output_tokens} ({message.usage.input_tokens} in, {message.usage.output_tokens} out)
              </span>
            )}
            {message.stop_reason && (
              <span className="result-stat-inline" style={{ color: message.stop_reason === 'end_turn' ? '#00D9FF' : '#F7931E' }}>
                Stop: {message.stop_reason}
              </span>
            )}
            {message.session_id && (
              <span className="result-stat-inline">
                Session: {message.session_id.substring(0, 8)}...
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default memo(StreamMessage);
