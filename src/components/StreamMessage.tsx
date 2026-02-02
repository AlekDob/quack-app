import React, { useMemo, useState, useEffect, memo, useCallback } from 'react';
import './ToolWidgets.css';
import {
  SystemInitializedWidget,
  EditWidget,
  WriteWidget,
  BashWidget,
  ReadWidget,
  GrepWidget,
  TodoWriteWidget,
  ExitPlanModeWidget,
  EnterPlanModeWidget,
  ImagePreviewWidget,
  ToolIcon,
  getToolColor,
} from './ToolWidgets';
import MarkdownText from './MarkdownText';
import ThinkingBlock from './ThinkingBlock';
import { TaskWidget } from './TaskWidget';
import { TaskOutputWidget } from './TaskOutputWidget';
import AskUserQuestionWidget from './AskUserQuestionWidget';
import ToolGifInline from './ToolGifInline';
import { getAvatarUrl } from '../utils/agentAvatars';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import type { ClaudeEvent, AskUserQuestionAnswers } from '../types';
import { BugReportWidget, WebAnalysisCard } from './structured-outputs';
import { isBugReportOutput, isWebAnalysisOutput } from '../types/structuredOutputs';

// Import duck avatar
import duckAvatar from '../../images/duck.png';

// Memoized tool widget components for performance
const MemoizedEditWidget = memo(EditWidget);
const MemoizedWriteWidget = memo(WriteWidget);
const MemoizedBashWidget = memo(BashWidget);
const MemoizedReadWidget = memo(ReadWidget);
const MemoizedGrepWidget = memo(GrepWidget);
const MemoizedTaskWidget = memo(TaskWidget);
const MemoizedTaskOutputWidget = memo(TaskOutputWidget);
const MemoizedTodoWriteWidget = memo(TodoWriteWidget);
const MemoizedExitPlanModeWidget = memo(ExitPlanModeWidget);
const MemoizedEnterPlanModeWidget = memo(EnterPlanModeWidget);
const MemoizedAskUserQuestionWidget = memo(AskUserQuestionWidget);
const MemoizedImagePreviewWidget = memo(ImagePreviewWidget);

/**
 * CollapsibleToolWidget - A collapsible widget for generic MCP tools
 * Shows tool name in header, collapsed by default, expandable to show input
 */
interface CollapsibleToolWidgetProps {
  toolName: string;
  toolColor: string;
  input: any;
  isLoading: boolean;
}

const CollapsibleToolWidget: React.FC<CollapsibleToolWidgetProps> = ({
  toolName,
  toolColor,
  input,
  isLoading,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get friendly display name
  const getDisplayName = (name: string): string => {
    // Remove mcp__ prefix and clean up
    return name.replace(/^mcp__\w+__/, '').replace(/_/g, ' ');
  };

  return (
    <div
      className="tool-widget collapsible-tool-widget"
      style={{ borderColor: toolColor }}
    >
      <div
        className="tool-widget-header collapsible-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="tool-widget-title" style={{ color: toolColor }}>
          <ToolIcon name={toolName} />
          <span>{getDisplayName(toolName)}</span>
        </div>
        <div className="tool-widget-actions">
          {isLoading && (
            <div className="tool-widget-loading">
              <div className="spinner"></div>
            </div>
          )}
          <svg
            className={`collapse-chevron ${isExpanded ? 'expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              opacity: 0.6,
            }}
          >
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
          </svg>
        </div>
      </div>
      {isExpanded && (
        <div className="tool-widget-content">
          <pre className="tool-widget-code">{JSON.stringify(input, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

interface StreamMessageProps {
  message: ClaudeEvent;
  streamMessages: ClaudeEvent[];
  onFilePathClick?: (path: string) => void;
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
}

const StreamMessage: React.FC<StreamMessageProps> = ({
  message,
  streamMessages,
  onFilePathClick,
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
}) => {
  // State for avatar URL (handles both default and custom avatars)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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


  // System initialization message
  if (message.type === 'system' && message.subtype === 'init') {
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

  // Assistant message - contains text and tool uses
  if (message.type === 'assistant' && message.message) {
    const msg = message.message;

    if (!msg.content || !Array.isArray(msg.content)) {
      return null;
    }

    // Debug: Log all content blocks for this message (expanded)
    msg.content.forEach((c: any, idx: number) => {
      console.log(`🔍 [StreamMessage] Content block ${idx}:`, {
        type: c.type,
        name: c.name,
        text: c.text?.substring(0, 50),
        hasInput: !!c.input,
        inputKeys: c.input ? Object.keys(c.input) : [],
        subagent_type: c.input?.subagent_type,
      });
    });

    return (
      <div className="stream-message assistant-message">
        {msg.content.map((content: any, idx: number) => {
          // Thinking block content (SDK 0.1.54+ extended thinking)
          // Only render if showThinkingBlocks is true (controlled by footer icon)
          if (content.type === 'thinking' && content.thinking && showThinkingBlocks) {
            return (
              <ThinkingBlock
                key={idx}
                content={content.thinking}
                defaultExpanded={false}
              />
            );
          }

          // Text content
          if (content.type === 'text' && content.text) {
            // Extract "Following rules:" line into styled pills
            const rulesMatch = content.text.match(/^(?:Following rules?:\s*)(.+)$/m);
            const ruleNames = rulesMatch
              ? rulesMatch[1].split(',').map((r: string) => r.trim().replace(/\.$/, '')).filter(Boolean)
              : [];
            const cleanedText = rulesMatch
              ? content.text.replace(/^Following rules?:\s*.+$/m, '').replace(/^\n+/, '')
              : content.text;

            return (
              <div key={idx} className="assistant-text">
                <div className="assistant-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={agentName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <img src={duckAvatar} alt="Quack Agency" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  )}
                </div>
                <div className="assistant-content">
                  <div className="assistant-name">{agentName}</div>
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
                  <div className="assistant-message-text">
                    <MarkdownText>{cleanedText}</MarkdownText>
                  </div>
                </div>
              </div>
            );
          }

          // Tool use content
          if (content.type === 'tool_use') {
            const toolName = content.name?.toLowerCase();
            const input = content.input;
            const toolId = content.id;
            const toolResult = toolResults.get(toolId);

            // 🦆 DEBUG: Log every tool_use being processed
            console.log(`🔧 [StreamMessage] TOOL_USE detected: name="${content.name}" id="${toolId}" toolName="${toolName}"`);

            // Debug logging for Task tool
            if (toolName === 'task') {
              console.log('🎯 [StreamMessage] Task tool detected!', {
                toolName,
                hasSubagentType: !!input?.subagent_type,
                subagentType: input?.subagent_type,
                description: input?.description,
                fullInput: input,
              });
            }

            // Edit tool
            if (toolName === 'edit' && input?.file_path) {
              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'edit'} toolId={toolId} />
                  <MemoizedEditWidget
                    file_path={input.file_path}
                    old_string={input.old_string}
                    new_string={input.new_string}
                    result={toolResult}
                    onFilePathClick={onFilePathClick}
                  />
                </React.Fragment>
              );
            }

            // Write tool
            if (toolName === 'write' && input?.file_path && input?.content) {
              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'write'} toolId={toolId} />
                  <MemoizedWriteWidget
                    filePath={input.file_path}
                    content={input.content}
                    result={toolResult}
                    onFilePathClick={onFilePathClick}
                  />
                </React.Fragment>
              );
            }

            // Bash tool
            if (toolName === 'bash' && input?.command) {
              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'bash'} toolId={toolId} />
                  <MemoizedBashWidget
                    command={input.command}
                    description={input.description}
                    result={toolResult}
                  />
                </React.Fragment>
              );
            }

            // Read tool - check if image file first
            if (toolName === 'read' && input?.file_path) {
              const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp', '.ico'];
              const isImageFile = imageExtensions.some(ext => input.file_path?.toLowerCase().endsWith(ext));

              if (isImageFile && toolResult) {
                // Extract image data from tool result
                const imageContent = extractImageData(toolResult);
                if (imageContent) {
                  return (
                    <React.Fragment key={idx}>
                      <ToolGifInline toolName={content.name || 'read'} toolId={toolId} />
                      <MemoizedImagePreviewWidget
                        filePath={input.file_path}
                        imageData={imageContent.data}
                        mediaType={imageContent.mediaType}
                        onOpenInTab={onOpenImageTab}
                      />
                    </React.Fragment>
                  );
                }
              }

              // Text files - existing ReadWidget
              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'read'} toolId={toolId} />
                  <MemoizedReadWidget
                    filePath={input.file_path}
                    result={toolResult}
                    onFilePathClick={onFilePathClick}
                  />
                </React.Fragment>
              );
            }

            // Grep tool
            if (toolName === 'grep' && input?.pattern) {
              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'grep'} toolId={toolId} />
                  <MemoizedGrepWidget
                    pattern={input.pattern}
                    path={input.path}
                    result={toolResult}
                  />
                </React.Fragment>
              );
            }

            // TodoWrite tool - no GIF (skipped in ToolGifInline)
            if (toolName === 'todowrite' && input?.todos && Array.isArray(input.todos)) {
              return (
                <MemoizedTodoWriteWidget
                  key={idx}
                  todos={input.todos}
                  defaultExpanded={true}
                />
              );
            }

            // ExitPlanMode tool - no GIF
            if (toolName === 'exitplanmode' && input?.plan) {
              return (
                <MemoizedExitPlanModeWidget
                  key={idx}
                  plan={input.plan}
                  workingDirectory={workingDirectory}
                  defaultExpanded={true}
                />
              );
            }

            // EnterPlanMode tool - purple header widget, no GIF
            // Only render ONCE even if called multiple times
            if (toolName === 'enterplanmode') {
              // Skip if this is a duplicate (same tool in same message already rendered)
              const isFirstEnterPlanMode = msg.content.findIndex(
                (c: any) => c.type === 'tool_use' && c.name?.toLowerCase() === 'enterplanmode'
              ) === idx;

              if (!isFirstEnterPlanMode) {
                return null; // Skip duplicates
              }

              return (
                <MemoizedEnterPlanModeWidget
                  key={idx}
                  objective={input?.objective}
                  defaultExpanded={false}
                />
              );
            }

            // AskUserQuestion tool - no GIF (skipped in ToolGifInline)
            // Handle both array and stringified JSON (SDK may serialize as string)
            if (toolName === 'askuserquestion' && input?.questions) {
              let questions = input.questions;

              // Parse if questions came as stringified JSON
              if (typeof questions === 'string') {
                try {
                  questions = JSON.parse(questions);
                  console.log('🔧 [AskUserQuestion] Parsed stringified questions:', questions);
                } catch (e) {
                  console.error('🔧 [AskUserQuestion] Failed to parse questions string:', e);
                }
              }

              // Now check if we have a valid array
              if (Array.isArray(questions)) {
                const isPending = pendingQuestionIds?.has(toolId);
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

            // Task tool (subagent invocation) - launches droids
            if (toolName === 'task' && input?.subagent_type) {
              const subagentType = input.subagent_type;
              const description = input.description || 'Running task';

              console.log('🤖 [StreamMessage] RENDERING Task widget for droid:', subagentType);

              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'task'} toolId={toolId} />
                  <MemoizedTaskWidget
                    subagentType={subagentType}
                    description={description}
                    isLoading={!toolResult}
                    workingDirectory={workingDirectory}
                  />
                </React.Fragment>
              );
            }

            // TaskOutput tool - retrieves output from background tasks
            if (toolName === 'taskoutput' && input?.task_id) {
              // Parse status from tool result if available
              let status: 'pending' | 'running' | 'completed' | 'error' | 'unknown' = 'unknown';
              let output: string | undefined;
              let error: string | undefined;

              if (toolResult) {
                try {
                  // toolResult might be a string or parsed object
                  const result = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
                  status = result.status || 'completed';
                  output = result.output || result.result || (typeof toolResult === 'string' ? toolResult : JSON.stringify(result, null, 2));
                  error = result.error;
                } catch {
                  // If parsing fails, use the raw result as output
                  output = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
                  status = 'completed';
                }
              }

              return (
                <React.Fragment key={idx}>
                  <ToolGifInline toolName={content.name || 'taskoutput'} toolId={toolId} />
                  <MemoizedTaskOutputWidget
                    taskId={input.task_id}
                    status={status}
                    output={output}
                    error={error}
                    block={input.block}
                    timeout={input.timeout}
                    isLoading={!toolResult}
                    defaultExpanded={true}
                  />
                </React.Fragment>
              );
            }

            // Generic fallback for MCP and other tools
            // GIF is OUTSIDE the widget with caption
            const toolColor = getToolColor(content.name || '');
            return (
              <React.Fragment key={idx}>
                {/* GIF outside with caption */}
                <ToolGifInline toolName={content.name || 'unknown'} toolId={toolId} />
                {/* Collapsible tool widget */}
                <CollapsibleToolWidget
                  toolName={content.name || 'unknown'}
                  toolColor={toolColor}
                  input={input}
                  isLoading={!toolResult}
                />
              </React.Fragment>
            );
          }

          return null;
        })}

        {/* File Checkpointing Rewind Button (SDK 0.2.7+) */}
        {(() => {
          // Check if this message has file-modifying tools (Edit, Write, MultiEdit)
          const hasFileChanges = msg.content.some(
            (c: any) => c.type === 'tool_use' && ['edit', 'write', 'multiedit'].includes(c.name?.toLowerCase())
          );

          // Get the UUID from the preceding user message (required for rewind)
          // We need the user message UUID that preceded this assistant response
          const messageIndex = streamMessages.findIndex((m) => m === message);
          let precedingUserMessageUuid: string | undefined;

          if (messageIndex > 0) {
            // Look backwards for the user message
            for (let i = messageIndex - 1; i >= 0; i--) {
              const prevMsg = streamMessages[i];
              if (prevMsg.type === 'user') {
                // Get UUID from user event (SDK provides this in the uuid field)
                precedingUserMessageUuid = (prevMsg as any).uuid;
                break;
              }
            }
          }

          // DEBUG: Log why rewind button might not show
          if (hasFileChanges) {
            console.log('[RewindButton] hasFileChanges:', hasFileChanges);
            console.log('[RewindButton] onRewindFiles:', !!onRewindFiles);
            console.log('[RewindButton] sessionId:', sessionId);
            console.log('[RewindButton] precedingUserMessageUuid:', precedingUserMessageUuid);
            // Log full structure of user messages to find UUID location
            const userMessages = streamMessages.filter((m: any) => m.type === 'user');
            console.log('[RewindButton] User messages:', userMessages.length);
            if (userMessages.length > 0) {
              console.log('[RewindButton] First user message keys:', Object.keys(userMessages[0]));
              console.log('[RewindButton] First user message:', JSON.stringify(userMessages[0]).substring(0, 500));
            }
          }

          if (hasFileChanges && onRewindFiles && sessionId && precedingUserMessageUuid) {
            return (
              <div className="rewind-files-action" style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => onRewindFiles(precedingUserMessageUuid!)}
                  className="rewind-button"
                  title="Undo all file changes from this response"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(251, 146, 60, 0.12)',
                    border: '1px solid rgba(251, 146, 60, 0.3)',
                    borderRadius: '8px',
                    color: 'rgb(251, 191, 136)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(251, 146, 60, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.5)';
                    e.currentTarget.style.color = 'rgb(251, 146, 60)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(251, 146, 60, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(251, 146, 60, 0.3)';
                    e.currentTarget.style.color = 'rgb(251, 191, 136)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Undo/Rewind arrow icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  Undo Changes
                </button>
              </div>
            );
          }
          return null;
        })()}
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

    if (agentEvent.action === 'start') {
      return (
        <TaskWidget
          subagentType={agentType}
          description="Starting..."
          isLoading={true}
          workingDirectory={workingDirectory}
        />
      );
    }

    if (agentEvent.action === 'stop') {
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

    // Check if the result text is already shown in the last assistant message
    // to avoid duplication
    const lastAssistantMessage = useMemo(() => {
      for (let i = streamMessages.length - 1; i >= 0; i--) {
        const msg = streamMessages[i];
        if (msg === message) continue; // Skip current message
        if (msg.type === 'assistant' && msg.message?.content) {
          return msg;
        }
      }
      return null;
    }, [streamMessages, message]);

    // Get the text from last assistant message
    const lastAssistantText = useMemo(() => {
      if (!lastAssistantMessage?.message?.content) return null;
      const content = lastAssistantMessage.message.content;
      if (Array.isArray(content)) {
        const textBlock = content.find((c: any) => c.type === 'text');
        return textBlock?.text || null;
      }
      return null;
    }, [lastAssistantMessage]);

    // Only show result text if it's different from assistant text or if there's an error
    const shouldShowResultText = message.error || (message.result && message.result !== lastAssistantText);

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
          {message.session_id && (
            <span className="result-stat-inline">
              Session: {message.session_id.substring(0, 8)}...
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

          {/* Regular text result */}
          {message.result && !structuredOutput && (
            <div className="assistant-message-text">
              <MarkdownText>{message.result}</MarkdownText>
            </div>
          )}

          {/* Error display */}
          {message.error && (
            <div className="result-error-inline">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              {message.error}
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
