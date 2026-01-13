import { memo, useState, useEffect, useRef, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, AskUserQuestionAnswers } from '../types';
import ToolCallCard from './ToolCallCard';
import StreamMessage from './StreamMessage';
import ThinkingBlock from './ThinkingBlock';
import MessageSettingsBadges from './MessageSettingsBadges';
import SessionIdDisplay from './SessionIdDisplay';
import { AgentMentionChip } from './AgentMentionChip';
import { getAvatarUrl } from '../utils/agentAvatars';
import { parseAgentMentions } from '../utils/agentMentions';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import { useAgentAvatar } from '../hooks/useAgentAvatar';
import { convertFileSrc } from '@tauri-apps/api/core';
import cyberducksAvatar from '../../images/cyberducks.png';
import './ChatMessage.css';
import './StreamMessage.css';

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
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  // Session ID for display in header
  currentSessionId?: string;
  // Show/hide ThinkingBlocks (controlled by footer icon)
  showThinkingBlocks?: boolean;
}

function ChatMessage({ message, onOpenFile, onFilePathClick, onSessionIdClick, agentName = 'Jack', agentAvatar, projectName, gitBranch, isLastUserMessage = false, workingDirectory, thinkingModeResetKey, onUserQuestionAnswer, pendingQuestionIds, answeredQuestions, currentSessionId, showThinkingBlocks = true }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = message.status === 'streaming';
  const hasError = message.status === 'error';
  const attachments = message.attachments ?? [];

  // Check if this is a resume session message
  const isResumeMessage = message.metadata?.isResumeMessage === true;
  const sessionId = message.metadata?.sessionId as string | undefined;

  // State for avatar URL (handles both default and custom avatars)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // State for sticky message actions
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load avatar URL (custom or default) - WITH FALLBACK for undefined avatars
  useEffect(() => {
    let isMounted = true;

    async function loadAvatarUrl() {
      // If no avatar specified, use duck30.jpeg fallback
      if (!agentAvatar) {
        console.log('[ChatMessage] No avatar specified, using duck30.jpeg fallback');
        if (isMounted) {
          // Use duck30.jpeg as fallback for agents with undefined avatar
          if (window.__TAURI__) {
            setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
          } else {
            setAvatarUrl('/duck30.jpeg');
          }
        }
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
          console.error('Failed to load custom avatar in chat:', error);
          if (isMounted) {
            // Fallback to duck30.jpeg if custom avatar fails
            if (window.__TAURI__) {
              setAvatarUrl(convertFileSrc('/images/ducks/new-avatars/duck30.jpeg', 'asset'));
            } else {
              setAvatarUrl('/duck30.jpeg');
            }
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
      // Clean up timeout on unmount
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, [agentAvatar]);

  // Auto-collapse with delay after hover is removed
  useEffect(() => {
    // Clear any existing timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    // If expanded and not hovering, start collapse timer
    if (isExpanded && !isHovering) {
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

  // Check if current message is truncated (only for sticky user messages)
  // Use extractOriginalCommand to get clean content for truncation check
  const isMessageTruncated = isLastUserMessage && isUser
    ? isTruncated(extractOriginalCommand(message.content), 30, 250)
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
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${hasError ? 'error' : ''} ${isLastUserMessage && isUser ? 'sticky-user-message' : ''}`}>
      <div className="chat-message-avatar">
        {isUser ? (
          <div className="avatar-icon user-avatar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="5" r="3"/>
              <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
          </div>
        ) : (projectName && gitBranch) ? (
          <img
            src={cyberducksAvatar}
            alt="Project Context"
            className="avatar-icon assistant-avatar-img"
            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt={agentName}
            className="avatar-icon assistant-avatar-img"
            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div className="avatar-icon assistant-avatar">🦆</div>
        )}
      </div>
      <div
        className="chat-message-content"
        onMouseEnter={() => isLastUserMessage && isUser && setIsHovering(true)}
        onMouseLeave={() => isLastUserMessage && isUser && setIsHovering(false)}
      >
        <div className="chat-message-header">
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
          {isLastUserMessage && isUser && (
            <div className="sticky-message-actions">
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
              {/* Only show expand button if message is actually truncated */}
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
            {message.events.map((event, eventIndex) => (
              <StreamMessage
                key={getStableEventKey(event, eventIndex)}
                message={event}
                streamMessages={message.events || []}
                onFilePathClick={onFilePathClick}
                agentName={agentName}
                agentAvatar={agentAvatar}
                workingDirectory={workingDirectory}
                onUserQuestionAnswer={onUserQuestionAnswer}
                pendingQuestionIds={pendingQuestionIds}
                answeredQuestions={answeredQuestions}
                showThinkingBlocks={showThinkingBlocks}
              />
            ))}
          </div>
        ) : (
          <div className={`chat-message-body ${isExpanded ? 'expanded' : ''}`}>
            {isLastUserMessage && isUser && !isExpanded
              ? renderTextWithMentions(truncateText(extractOriginalCommand(message.content), 30))
              : renderTextWithMentions(message.content)
            }
            {isStreaming && <span className="streaming-cursor">▊</span>}
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
            Error: {message.error}
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="chat-message-tools">
            {message.toolCalls.map((tool) => (
              <ToolCallCard key={tool.id} tool={tool} onOpenFile={onOpenFile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);
