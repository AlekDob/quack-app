import React, { useMemo, useState, useEffect } from 'react';
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
} from './ToolWidgets';
import MarkdownText from './MarkdownText';
import { getAgentAvatar, getAvatarUrl } from '../utils/agentAvatars';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import type { ClaudeEvent } from '../types';

// Import duck avatar
import duckAvatar from '../../images/duck.png';

interface StreamMessageProps {
  message: ClaudeEvent;
  streamMessages: ClaudeEvent[];
  onFilePathClick?: (path: string) => void;
  agentName?: string;
  agentAvatar?: string;
}

const StreamMessage: React.FC<StreamMessageProps> = ({ message, streamMessages, onFilePathClick, agentName = 'Jack', agentAvatar }) => {
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

    return (
      <div className="stream-message assistant-message">
        {msg.content.map((content: any, idx: number) => {
          // Text content
          if (content.type === 'text' && content.text) {
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
                  <div className="assistant-message-text">
                    <MarkdownText>{content.text}</MarkdownText>
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

            // Edit tool
            if (toolName === 'edit' && input?.file_path) {
              return (
                <EditWidget
                  key={idx}
                  file_path={input.file_path}
                  old_string={input.old_string}
                  new_string={input.new_string}
                  result={toolResult}
                  onFilePathClick={onFilePathClick}
                />
              );
            }

            // Write tool
            if (toolName === 'write' && input?.file_path && input?.content) {
              return (
                <WriteWidget
                  key={idx}
                  filePath={input.file_path}
                  content={input.content}
                  result={toolResult}
                  onFilePathClick={onFilePathClick}
                />
              );
            }

            // Bash tool
            if (toolName === 'bash' && input?.command) {
              return (
                <BashWidget
                  key={idx}
                  command={input.command}
                  description={input.description}
                  result={toolResult}
                />
              );
            }

            // Read tool
            if (toolName === 'read' && input?.file_path) {
              return (
                <ReadWidget
                  key={idx}
                  filePath={input.file_path}
                  result={toolResult}
                  onFilePathClick={onFilePathClick}
                />
              );
            }

            // Grep tool
            if (toolName === 'grep' && input?.pattern) {
              return (
                <GrepWidget
                  key={idx}
                  pattern={input.pattern}
                  path={input.path}
                  result={toolResult}
                />
              );
            }

            // TodoWrite tool
            if (toolName === 'todowrite' && input?.todos && Array.isArray(input.todos)) {
              return (
                <TodoWriteWidget
                  key={idx}
                  todos={input.todos}
                  defaultExpanded={true}
                />
              );
            }

            // ExitPlanMode tool
            if (toolName === 'exitplanmode' && input?.plan) {
              return (
                <ExitPlanModeWidget
                  key={idx}
                  plan={input.plan}
                  defaultExpanded={true}
                />
              );
            }

            // Default fallback for unknown tools
            // Special handling for Task tool (subagent invocation)
            if (toolName === 'task' && input?.subagent_type) {
              const subagentType = input.subagent_type;
              const avatarPath = getAgentAvatar(subagentType) || duckAvatar;
              const description = input.description || 'Running task';

              return (
                <div key={idx} className="tool-widget task-widget">
                  <div className="tool-widget-header">
                    <div className="tool-widget-title">
                      <img
                        src={avatarPath}
                        alt={subagentType}
                        className="tool-widget-agent-avatar"
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          objectFit: 'contain',
                          marginRight: '6px'
                        }}
                      />
                      <span>Agent: <strong>{subagentType.replace(/-/g, ' ')}</strong></span>
                    </div>
                    <span className="tool-widget-meta">{description}</span>
                    {!toolResult && (
                      <div className="tool-widget-loading">
                        <div className="spinner"></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="tool-widget unknown-tool-widget">
                <div className="tool-widget-header">
                  <div className="tool-widget-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75z"/>
                    </svg>
                    <span>Tool: {content.name}</span>
                  </div>
                </div>
                <div className="tool-widget-content">
                  <pre className="tool-widget-code">{JSON.stringify(input, null, 2)}</pre>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  }

  // User messages - typically tool results, but we skip them since they're shown in the tool widgets
  if (message.type === 'user') {
    // Skip - tool results are displayed inline with their tool calls
    return null;
  }

  // Result message - final summary with consolidated layout
  if (message.type === 'result') {
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
        <div className="assistant-content">
          <div className="assistant-name">{agentName}</div>
          {message.result && (
            <div className="assistant-message-text">
              <MarkdownText>{message.result}</MarkdownText>
            </div>
          )}
          {message.error && (
            <div className="result-error-inline">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
              </svg>
              {message.error}
            </div>
          )}
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

export default StreamMessage;
