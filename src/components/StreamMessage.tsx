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
  ToolIcon,
  getToolColor,
} from './ToolWidgets';
import MarkdownText from './MarkdownText';
import ThinkingBlock from './ThinkingBlock';
import { TaskAgentAvatar } from './TaskAgentAvatar';
import { getAvatarUrl } from '../utils/agentAvatars';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import type { ClaudeEvent} from '../types';
import { BugReportWidget, WebAnalysisCard } from './structured-outputs';
import { isBugReportOutput, isWebAnalysisOutput } from '../types/structuredOutputs';

// Import duck avatar
import duckAvatar from '../../images/duck.png';

interface StreamMessageProps {
  message: ClaudeEvent;
  streamMessages: ClaudeEvent[];
  onFilePathClick?: (path: string) => void;
  agentName?: string;
  agentAvatar?: string;
  workingDirectory?: string; // Current working directory for file operations
}

const StreamMessage: React.FC<StreamMessageProps> = ({ message, streamMessages, onFilePathClick, agentName = 'Jack', agentAvatar, workingDirectory }) => {
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
          if (content.type === 'thinking' && content.thinking) {
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
                  workingDirectory={workingDirectory}
                  defaultExpanded={true}
                />
              );
            }

            // Default fallback for unknown tools
            // Special handling for Task tool (subagent invocation)
            if (toolName === 'task' && input?.subagent_type) {
              const subagentType = input.subagent_type;
              const description = input.description || 'Running task';

              return (
                <div key={idx} className="tool-widget task-widget">
                  <div className="tool-widget-header">
                    <div className="tool-widget-title">
                      <TaskAgentAvatar subagentType={subagentType} />
                      <span>Droid: <strong>{subagentType.replace(/-/g, ' ')}</strong></span>
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

            const toolColor = getToolColor(content.name || '');
            return (
              <div key={idx} className="tool-widget unknown-tool-widget" style={{ borderColor: toolColor }}>
                <div className="tool-widget-header">
                  <div className="tool-widget-title" style={{ color: toolColor }}>
                    <ToolIcon name={content.name || ''} />
                    <span>Tool: {content.name}</span>
                  </div>
                  {!toolResult && (
                    <div className="tool-widget-loading">
                      <div className="spinner"></div>
                    </div>
                  )}
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

  // Agent event - subagent start/stop
  if (message.type === 'agent') {
    const agentEvent = message as any;

    if (agentEvent.action === 'start') {
      return (
        <div className="stream-message subagent-message">
          <div className="tool-widget task-widget">
            <div className="tool-widget-header">
              <div className="tool-widget-title">
                <TaskAgentAvatar subagentType={agentEvent.agent_type || agentEvent.agent_name || 'subagent'} />
                <span>Droid: <strong>{agentEvent.agent_name || agentEvent.agent_type || 'Unknown'}</strong></span>
              </div>
              <span className="tool-widget-meta">Starting...</span>
              <div className="tool-widget-loading">
                <div className="spinner"></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (agentEvent.action === 'stop') {
      return (
        <div className="stream-message subagent-message">
          <div className="tool-widget task-widget">
            <div className="tool-widget-header">
              <div className="tool-widget-title">
                <TaskAgentAvatar subagentType={agentEvent.agent_type || agentEvent.agent_name || 'subagent'} />
                <span>Droid: <strong>{agentEvent.agent_name || agentEvent.agent_type || 'Unknown'}</strong></span>
              </div>
              <span className="tool-widget-meta" style={{ color: '#00D9FF' }}>Completed</span>
            </div>
          </div>
        </div>
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

export default StreamMessage;
