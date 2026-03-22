import { memo, useState, useEffect, useRef, Fragment } from 'react';
import type { ChatMessage as ChatMessageType, AskUserQuestionAnswers } from '../types';
import ToolCallMinimal from './ToolCallMinimal';
import StreamMessage, { SPECIAL_WIDGET_TOOLS, SOLO_ROW_TOOLS, isImageRead } from './StreamMessage';
import ThinkingBlock from './ThinkingBlock';
import MessageSettingsBadges from './MessageSettingsBadges';
import SessionIdDisplay from './SessionIdDisplay';
import MarkdownText from './MarkdownText';
import { AgentMentionChip } from './AgentMentionChip';
import { parseAgentMentions } from '../utils/agentMentions';
import { useAgentAvatar } from '../hooks/useAgentAvatar';
import humanoidAvatar from '../../images/humanoid.jpeg';
import './ChatMessage.css';
import './StreamMessage.css';

// Check if an event is a tool-only assistant event that can be grouped
// into a horizontal row with other tool events (regardless of tool type).
function isGroupableToolEvent(event: any): boolean {
  if (event.type !== 'assistant' || !event.message?.content) return false;
  const content = event.message.content;

  // Must have at least one tool_use and no text content
  const toolUses = content.filter((c: any) => c.type === 'tool_use');
  const hasText = content.some((c: any) => c.type === 'text' && c.text?.trim());
  if (toolUses.length === 0 || hasText) return false;

  // All tool_uses must be groupable (not special widgets, solo-row, or image reads)
  return toolUses.every((t: any) => {
    const name = (t.name || '').toLowerCase();
    if (SPECIAL_WIDGET_TOOLS.has(name) || SOLO_ROW_TOOLS.has(name)) return false;
    if (isImageRead(name, t.input)) return false;
    return true;
  });
}

// System Message Component
function SystemMessage({ agentName, content }: { agentName: string | null; content: string }) {
  const avatarUrl = useAgentAvatar(agentName || '', undefined);

  return (
    <div className="chat-message system">
      <div className="chat-message-system-content">
        {agentName && avatarUrl ? (
          <>
            <img
              src={avatarUrl}
              alt={agentName}
              className="agent-system-avatar"
            />
            <span>Invoking droid: <strong>{agentName}</strong></span>
          </>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
  onOpenFile?: (path: string) => void;
  onFilePathClick?: (path: string) => void;
  onOpenInIDE?: (path: string) => void;
  onSessionIdClick?: (sessionId: string) => void;
  agentName?: string;
  agentAvatar?: string;
  projectName?: string;
  gitBranch?: string;
  isLastUserMessage?: boolean;
  workingDirectory?: string;
  // Thinking mode reset key (changes when mode cycles via Tab)
  thinkingModeResetKey?: string | number;
  // AskUserQuestion support
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  // Session ID for display in header
  currentSessionId?: string;
  // Show/hide ThinkingBlocks (controlled by footer icon)
  showThinkingBlocks?: boolean;
  // File Checkpointing (SDK 0.2.7+)
  onRewindFiles?: (userMessageId: string) => void;
  // Image preview
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  // Plan approval
  pendingPlanApprovalIds?: Set<string>;
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  // Teammate stream drill-down
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
  // Whether to show the agent header (avatar, name, timestamp) — used for grouping consecutive messages
  showHeader?: boolean;
}

function ChatMessage({ message, onOpenFile, onFilePathClick, onOpenInIDE, onSessionIdClick, agentName = 'Jack', agentAvatar, projectName, gitBranch, isLastUserMessage = false, workingDirectory, thinkingModeResetKey, onUserQuestionAnswer, pendingQuestionIds, answeredQuestions, currentSessionId, showThinkingBlocks = true, onRewindFiles, onOpenImageTab, pendingPlanApprovalIds, onPlanApprovalResponse, onTeammateDrillDown, showHeader = true }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const hasError = message.status === 'error';
  const attachments = message.attachments ?? [];

  // Check if this is a resume session message
  const isResumeMessage = message.metadata?.isResumeMessage === true;
  const sessionId = message.metadata?.sessionId as string | undefined;

  // Check if this message is from a resumed session (hide header + init widget)
  // metadata.isResumed is set at message creation (instant), events check is fallback
  const isResumedSession = message.metadata?.isResumed === true || message.events?.some(
    (e: any) => e.type === 'system' && e.subtype === 'init' && e.isResumed
  );

  // Use cached avatar hook - much faster than manual loading
  const avatarUrl = useAgentAvatar(agentName, agentAvatar);

  // State for sticky message actions
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Auto-collapse with delay after hover is removed
  useEffect(() => {
    // Clear any existing timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    // If expanded and not hovering, start collapse timer (only for sticky messages)
    if (isExpanded && !isHovering && isLastUserMessage) {
      collapseTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 300); // 300ms delay after hover out
    }

    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, [isExpanded, isHovering]);

  // Copy message content to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setIsCopied(true);

        // Clear any existing timeout
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }

        // Reset after 2 seconds
        copyTimeoutRef.current = setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy message:', err);
      });
  };

  // Toggle expanded state
  const handleToggleExpand = () => {
    setIsExpanded(prev => !prev);
  };

  const formatSize = (size: number | undefined) => {
    if (!size) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  };

  // Check if text needs truncation
  const isTruncated = (text: string, maxWords: number, maxChars: number = 250): boolean => {
    const trimmed = text.trim();

    // Check character limit
    if (trimmed.length > maxChars) {
      return true;
    }

    // Check word limit
    const words = trimmed.split(/\s+/);
    return words.length > maxWords;
  };

  // Truncate text to max words AND max characters (for sticky messages)
  const truncateText = (text: string, maxWords: number, maxChars: number = 250): string => {
    const trimmed = text.trim();

    // First check character limit
    if (trimmed.length <= maxChars) {
      // Text is short enough, check word limit
      const words = trimmed.split(/\s+/);
      if (words.length <= maxWords) {
        return trimmed;
      }
      return words.slice(0, maxWords).join(' ') + '...';
    }

    // Text exceeds character limit - truncate to maxChars
    let truncated = trimmed.substring(0, maxChars);

    // Try to break at last space to avoid cutting words
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.8) { // Only break at space if it's near the end
      truncated = truncated.substring(0, lastSpace);
    }

    return truncated + '...';
  };

  // Extract original slash command from expanded command-context XML
  // When user types "/task prompt", it expands to "<command-context>...</command-context>\n---\n/task prompt"
  // This helper extracts the clean "/task prompt" for display in sticky messages
  const extractOriginalCommand = (content: string): string => {
    // Check if content contains <command-context> (expanded slash command)
    if (!content.includes('<command-context')) {
      return content;
    }

    // Pattern 1: Look for content after "---\n" separator (original command follows)
    const separatorMatch = content.match(/---\s*\n\s*(.+)/s);
    if (separatorMatch) {
      return separatorMatch[1].trim();
    }

    // Pattern 2: Extract just the command name from the tag if no separator
    const nameMatch = content.match(/<command-context\s+name="([^"]+)"/);
    if (nameMatch) {
      return `/${nameMatch[1]}`;
    }

    // Fallback: return original content
    return content;
  };

  // Check if current message is truncated (for ALL user messages)
  // Use extractOriginalCommand to get clean content for truncation check
  const isMessageTruncated = isUser
    ? isTruncated(
        extractOriginalCommand(message.content),
        isLastUserMessage ? 30 : 20,
        isLastUserMessage ? 250 : 150
      )
    : false;

  // 🦆 FIX: Stable event key generator - ALWAYS uses index for guaranteed uniqueness
  const getStableEventKey = (event: any, index: number): string => {
    // System events: include index to handle multiple status events
    if (event.type === 'system' && 'subtype' in event) {
      return `system-${event.subtype}-${index}`;
    }
    // Assistant events: include index to handle edge cases
    if (event.type === 'assistant' && 'message' in event && event.message?.id) {
      return `assistant-${event.message.id}-${index}`;
    }
    // 🦆 FIX: Handle user events - use tool_use_ids which are unique UUIDs
    if (event.type === 'user' && 'message' in event) {
      const toolUseIds = event.message?.content
        ?.filter((c: any) => c.tool_use_id)
        ?.map((c: any) => c.tool_use_id)
        .join('-') || '';
      if (toolUseIds) {
        return `user-${toolUseIds}`;
      }
      // Fallback: use message.id + index for uniqueness
      return `user-${message.id}-${index}`;
    }
    if (event.type === 'result' && 'session_id' in event) {
      return `result-${event.session_id}-${index}`;
    }
    if ('session_id' in event && event.session_id) {
      return `${event.type}-${event.session_id}-${index}`;
    }
    // Fallback: use message.id + event type + index for guaranteed uniqueness
    return `${event.type}-${message.id}-${index}`;
  };

  // Render text with @mentions as inline chips and clickable Session ID
  const renderTextWithMentions = (text: string) => {
    // If this is a resume message with sessionId, make it clickable
    if (isResumeMessage && sessionId && onSessionIdClick) {
      // Replace Session ID: `sessionId` with clickable element
      const sessionIdPattern = /Session ID: `([^`]+)`/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = sessionIdPattern.exec(text)) !== null) {
        // Add text before Session ID
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }

        // Capture match values before adding to parts (to avoid closure issues)
        const capturedSessionId = match[1];
        const capturedIndex = match.index;

        // Add clickable Session ID
        parts.push(
          <span key={`session-${capturedIndex}`}>
            Session ID:{' '}
            <button
              onClick={() => onSessionIdClick(capturedSessionId)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-mono text-xs transition-colors cursor-pointer border border-blue-500/30 hover:border-blue-500/50"
              title="Click to view session details"
            >
              <span>{capturedSessionId}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </span>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      if (parts.length > 0) {
        return parts;
      }
    }

    // Default: Render with @mentions
    const mentions = parseAgentMentions(text);

    if (mentions.length === 0) {
      return text;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    mentions.forEach((mention, idx) => {
      // Add text before mention
      if (mention.startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, mention.startIndex));
      }

      // Add mention chip
      parts.push(
        <AgentMentionChip
          key={`mention-${idx}`}
          agentName={mention.agentName}
        />
      );

      lastIndex = mention.endIndex;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // System messages (agent invocation) - render as centered notification
  if (isSystem) {
    // Extract agent name from content (format: "🦆 Invoking droid: **agent name**")
    const agentNameMatch = message.content.match(/\*\*(.*?)\*\*/);
    const extractedAgentName = agentNameMatch ? agentNameMatch[1] : null;

    return (
      <SystemMessage
        agentName={extractedAgentName}
        content={message.content}
      />
    );
  }

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${hasError ? 'error' : ''} ${isLastUserMessage && isUser ? 'sticky-user-message' : ''} ${!isUser && (!showHeader || isResumedSession) ? 'no-header' : ''}`}>
      <div
        className="chat-message-content"
        onMouseEnter={() => isLastUserMessage && isUser && setIsHovering(true)}
        onMouseLeave={() => isLastUserMessage && isUser && setIsHovering(false)}
      >
        <div className="chat-message-header">
          {/* Agent avatar for assistant messages - always shows (cached) */}
          {!isUser && (
            <img
              src={avatarUrl}
              alt={agentName}
              className="chat-message-avatar"
            />
          )}
          <span className="chat-message-role">
            {isUser
              ? 'You'
              : (projectName && gitBranch)
                ? `${projectName} • ${gitBranch}`
                : agentName
            }
          </span>
          <span className="chat-message-timestamp">
            {new Date(message.timestamp).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {/* Show settings badges for assistant messages (SDK 0.1.54+) */}
          {!isUser && message.settings && (
            <MessageSettingsBadges settings={message.settings} />
          )}
          {/* Show session ID for assistant messages */}
          {!isUser && currentSessionId && (
            <SessionIdDisplay sessionId={currentSessionId} />
          )}
          {isUser && (isLastUserMessage || isMessageTruncated) && (
            <div className="sticky-message-actions">
              {/* Copy button only on last (sticky) user message */}
              {isLastUserMessage && (
                <button
                  className={`sticky-action-btn ${isCopied ? 'copied' : ''}`}
                  onClick={handleCopyMessage}
                  title={isCopied ? "Copied!" : "Copy full message"}
                >
                  {isCopied ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </button>
              )}
              {/* Expand button on ALL truncated user messages */}
              {isMessageTruncated && (
                <button
                  className="sticky-action-btn"
                  onClick={handleToggleExpand}
                  title={isExpanded ? "Collapse" : "Expand full message"}
                >
                  {isExpanded ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        {/* Show thinking block if present (SDK 0.1.54+ extended thinking) */}
        {!isUser && message.thinkingContent && showThinkingBlocks && (
          <ThinkingBlock
            content={message.thinkingContent}
            resetKey={thinkingModeResetKey}
            defaultExpanded={true}
          />
        )}
        {/* If we have Claude events, show them using StreamMessage */}
        {message.events && message.events.length > 0 ? (
          <div className="chat-message-events">
            {(() => {
              // Group consecutive groupable tool events into horizontal rows.
              // User events are invisible and skipped when determining consecutive-ness.
              // Groups across different tool types (e.g. WebSearch + Glob on same row).
              type EventGroup =
                | { kind: 'single'; event: any; eventIndex: number }
                | { kind: 'group'; items: { event: any; eventIndex: number }[] };

              const groups: EventGroup[] = [];
              let currentGroup: { event: any; eventIndex: number }[] | null = null;

              const flushGroup = () => {
                if (!currentGroup) return;
                if (currentGroup.length === 1) {
                  groups.push({ kind: 'single', event: currentGroup[0].event, eventIndex: currentGroup[0].eventIndex });
                } else {
                  groups.push({ kind: 'group', items: currentGroup });
                }
                currentGroup = null;
              };

              message.events!.forEach((event: any, eventIndex: number) => {
                // User events are invisible — skip them for grouping purposes
                if (event.type === 'user') return;

                if (isGroupableToolEvent(event)) {
                  if (currentGroup) {
                    currentGroup.push({ event, eventIndex });
                  } else {
                    currentGroup = [{ event, eventIndex }];
                  }
                } else {
                  flushGroup();
                  groups.push({ kind: 'single', event, eventIndex });
                }
              });
              flushGroup();

              // Detect nested context: orchestrator tools running while a subagent is active
              const nestedEventIndices = new Set<number>();
              {
                const pendingAgentToolIds = new Set<string>();
                message.events!.forEach((evt: any, idx: number) => {
                  if (evt.type === 'assistant' && evt.message?.content) {
                    for (const block of evt.message.content) {
                      if (block.type === 'tool_use') {
                        const n = (block.name || '').toLowerCase();
                        if (n === 'agent' || (n === 'task' && block.input?.subagent_type)) {
                          pendingAgentToolIds.add(block.id);
                        }
                      }
                    }
                  }
                  if (evt.type === 'user' && evt.message?.content) {
                    for (const block of evt.message.content) {
                      if (block.type === 'tool_result' && pendingAgentToolIds.has(block.tool_use_id)) {
                        pendingAgentToolIds.delete(block.tool_use_id);
                      }
                    }
                  }
                  // Mark assistant events that don't contain the agent tool itself
                  if (pendingAgentToolIds.size > 0 && evt.type === 'assistant') {
                    const hasAgentTool = evt.message?.content?.some((b: any) => {
                      if (b.type !== 'tool_use') return false;
                      const n = (b.name || '').toLowerCase();
                      return n === 'agent' || (n === 'task' && b.input?.subagent_type);
                    });
                    if (!hasAgentTool) {
                      nestedEventIndices.add(idx);
                    }
                  }
                });
              }

              // Helper to compute showHeader for an event
              const computeShowHeader = (eventIndex: number, event: any): boolean => {
                let prevVisibleType: string | null = null;
                for (let i = eventIndex - 1; i >= 0; i--) {
                  const e = message.events![i];
                  if (e.type !== 'user') {
                    prevVisibleType = e.type;
                    break;
                  }
                }
                return event.type !== 'assistant' || prevVisibleType !== 'assistant';
              };

              const renderStreamMessage = (event: any, eventIndex: number, showHeader: boolean, isNested?: boolean) => (
                <StreamMessage
                  key={getStableEventKey(event, eventIndex)}
                  message={event}
                  streamMessages={message.events || []}
                  onFilePathClick={onFilePathClick}
                  onOpenInIDE={onOpenInIDE}
                  agentName={agentName}
                  agentAvatar={agentAvatar}
                  workingDirectory={workingDirectory}
                  onUserQuestionAnswer={onUserQuestionAnswer}
                  pendingQuestionIds={pendingQuestionIds}
                  answeredQuestions={answeredQuestions}
                  showThinkingBlocks={showThinkingBlocks}
                  onOpenImageTab={onOpenImageTab}
                  sessionId={currentSessionId}
                  onRewindFiles={onRewindFiles}
                  pendingPlanApprovalIds={pendingPlanApprovalIds}
                  onPlanApprovalResponse={onPlanApprovalResponse}
                  onTeammateDrillDown={onTeammateDrillDown}
                  showHeader={showHeader}
                  isNestedUnderAgent={isNested}
                />
              );

              return groups.map((group) => {
                if (group.kind === 'single') {
                  const isNested = nestedEventIndices.has(group.eventIndex);
                  return renderStreamMessage(
                    group.event,
                    group.eventIndex,
                    computeShowHeader(group.eventIndex, group.event),
                    isNested
                  );
                }
                // If the first item needs a header (avatar/name), render it
                // standalone so the header stays on its own line above the group.
                const firstNeedsHeader = computeShowHeader(group.items[0].eventIndex, group.items[0].event);
                const headerItem = firstNeedsHeader ? group.items[0] : null;
                const groupItems = firstNeedsHeader ? group.items.slice(1) : group.items;
                const isGroupNested = group.items.some(item => nestedEventIndices.has(item.eventIndex));

                return (
                  <Fragment key={`event-group-${group.items[0].eventIndex}`}>
                    {headerItem && renderStreamMessage(headerItem.event, headerItem.eventIndex, true, isGroupNested)}
                    {groupItems.length > 1 ? (
                      <div className={`tool-event-group-row${isGroupNested ? ' nested-under-agent' : ''}`}>
                        {groupItems.map(({ event, eventIndex }) =>
                          renderStreamMessage(event, eventIndex, false, isGroupNested)
                        )}
                      </div>
                    ) : groupItems.length === 1 ? (
                      renderStreamMessage(groupItems[0].event, groupItems[0].eventIndex, false, isGroupNested)
                    ) : null}
                  </Fragment>
                );
              });
            })()}
          </div>
        ) : (
          <div className={`chat-message-body ${isExpanded ? 'expanded' : ''}`}>
            {isUser ? (
              // User messages: render with mentions support - always truncated unless expanded
              <>
                <span className="user-message-text">
                  {!isExpanded
                    ? renderTextWithMentions(truncateText(extractOriginalCommand(message.content), isLastUserMessage ? 30 : 20, isLastUserMessage ? 250 : 150))
                    : renderTextWithMentions(message.content)
                  }
                  {/* Inline See more / Show less button for truncated messages */}
                  {isMessageTruncated && (
                    <button
                      className="see-more-btn"
                      onClick={handleToggleExpand}
                    >
                      {isExpanded ? 'Show less' : 'See more'}
                    </button>
                  )}
                </span>
                <img
                  src={humanoidAvatar}
                  alt="User"
                  className="user-message-avatar"
                />
              </>
            ) : (
              // Assistant messages: render with markdown formatting
              // Use same wrapper structure as StreamMessage for consistent padding
              <div className="assistant-message-text">
                <MarkdownText>{message.content}</MarkdownText>
              </div>
            )}
          </div>
        )}
        {attachments.length > 0 && (
          <div className={`chat-message-attachments ${isLastUserMessage && isUser ? 'compact' : ''}`}>
            {attachments.map((attachment) => {
              const isImage = attachment.previewUrl !== undefined;
              return (
                <div key={attachment.id} className="chat-message-attachment">
                  <div className="chat-message-attachment-preview">
                    {isImage ? (
                      <img src={attachment.previewUrl} alt={attachment.name} />
                    ) : (
                      <svg className="chat-message-attachment-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.5 3.5a2.5 2.5 0 0 1 5 0V11h-1V3.5a1.5 1.5 0 0 0-3 0V12a3 3 0 1 1-6 0V3h1v9a2 2 0 1 0 4 0V3.5Z"/>
                      </svg>
                    )}
                  </div>
                  <div className="chat-message-attachment-meta">
                    <span className="chat-message-attachment-name">{attachment.name}</span>
                    <span className="chat-message-attachment-size">{formatSize(attachment.size)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasError && message.error && (
          <div className="chat-message-error">
            {message.error === 'Aborted' ? 'Aborted' :
              `Error: ${message.error.length > 200 ? message.error.substring(0, 200) + '...' : message.error}`}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="chat-message-tools-minimal">
            {message.toolCalls.map((tool) => (
              <ToolCallMinimal key={tool.id} tool={tool} onOpenFile={onOpenFile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
