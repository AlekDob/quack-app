import React, { useMemo } from 'react';
import './ToolWidgets.css';
import {
  SystemInitializedWidget,
  EditWidget,
  WriteWidget,
  BashWidget,
  ReadWidget,
  GrepWidget,
} from './ToolWidgets';
import type { ClaudeEvent } from '../types';

interface StreamMessageProps {
  message: ClaudeEvent;
  streamMessages: ClaudeEvent[];
}

const StreamMessage: React.FC<StreamMessageProps> = ({ message, streamMessages }) => {
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
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M16 8A8 8 0 110 8a8 8 0 0116 0zM5.354 4.646a.5.5 0 10-.708.708L7.293 8l-2.647 2.646a.5.5 0 00.708.708L8 8.707l2.646 2.647a.5.5 0 00.708-.708L8.707 8l2.647-2.646a.5.5 0 00-.708-.708L8 7.293 5.354 4.646z"/>
                  </svg>
                </div>
                <div className="assistant-content">
                  <div className="assistant-name">Jack</div>
                  <div className="assistant-message-text">{content.text}</div>
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

            // Default fallback for unknown tools
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

  // Result message - final summary
  if (message.type === 'result') {
    return (
      <div className="stream-message result-message">
        <div className="result-header">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            {message.is_error ? (
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            ) : (
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
            )}
          </svg>
          <span className="result-title">
            {message.is_error ? 'Execution Failed' : 'Execution Complete'}
          </span>
        </div>
        {message.result && (
          <div className="result-content">
            <p>{message.result}</p>
          </div>
        )}
        {message.error && (
          <div className="result-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.47.22A.75.75 0 015 0h6a.75.75 0 01.53.22l4.25 4.25c.141.14.22.331.22.53v6a.75.75 0 01-.22.53l-4.25 4.25A.75.75 0 0111 16H5a.75.75 0 01-.53-.22L.22 11.53A.75.75 0 010 11V5a.75.75 0 01.22-.53L4.47.22z"/>
            </svg>
            {message.error}
          </div>
        )}
        <div className="result-stats">
          {message.cost_usd !== undefined && (
            <div className="result-stat">
              <span className="result-stat-label">Cost:</span>
              <span className="result-stat-value">${message.cost_usd.toFixed(4)}</span>
            </div>
          )}
          {message.duration_ms !== undefined && (
            <div className="result-stat">
              <span className="result-stat-label">Duration:</span>
              <span className="result-stat-value">{(message.duration_ms / 1000).toFixed(2)}s</span>
            </div>
          )}
          {message.usage && (
            <div className="result-stat">
              <span className="result-stat-label">Tokens:</span>
              <span className="result-stat-value">
                {message.usage.input_tokens + message.usage.output_tokens}
                {' '}
                ({message.usage.input_tokens} in, {message.usage.output_tokens} out)
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default StreamMessage;
