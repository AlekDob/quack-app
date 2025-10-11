import { useState } from 'react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import AgentOptionsPanel from './AgentOptionsPanel';
import ModelSelector from './ModelSelector';
import ThinkingModeSelector from './ThinkingModeSelector';
import type { ChatMessage } from '../types';
import type { ChatMode, AgentOptions } from '../types/agent';
import './ChatView.css';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  mode: ChatMode;
  agentOptions: AgentOptions;
  attachedImages: File[];
  onSendMessage: (content: string) => Promise<void>;
  onModeChange: (mode: ChatMode) => void;
  onAgentOptionsChange: (options: AgentOptions) => void;
  onImagesAttach: (files: File[]) => void;
  onImageRemove: (index: number) => void;
}

export default function ChatView({
  messages,
  isLoading,
  mode,
  agentOptions,
  attachedImages,
  onSendMessage,
  onModeChange,
  onAgentOptionsChange,
  onImagesAttach,
  onImageRemove,
}: ChatViewProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;
    await onSendMessage(content);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      onImagesAttach(imageFiles);
    }
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="chat-view">
      <div className="chat-view-header">
        <div className="chat-view-title">
          <span className="chat-view-icon">🦆</span>
          <h2>Claude Chat</h2>
        </div>

        {/* Mode Selector */}
        <div className="mode-selector">
          <button
            className={`mode-button ${mode === 'cli' ? 'active' : ''}`}
            onClick={() => onModeChange('cli')}
            title="CLI Mode: Quick & Simple"
          >
            ⚡ CLI
          </button>
          <button
            className={`mode-button ${mode === 'agent' ? 'active' : ''}`}
            onClick={() => onModeChange('agent')}
            title="Agent Mode: Advanced Features"
          >
            🤖 Agent
          </button>
        </div>

        {/* Model & Thinking Selectors (Available in both modes) */}
        <div className="agent-controls">
          <ModelSelector
            value={agentOptions.model || 'claude-sonnet-4-20250514'}
            onChange={(model) => onAgentOptionsChange({ ...agentOptions, model })}
          />
          <ThinkingModeSelector
            value={agentOptions.thinking_mode || 'auto'}
            onChange={(thinking_mode) =>
              onAgentOptionsChange({ ...agentOptions, thinking_mode })
            }
          />
        </div>

        {/* Agent Options Toggle (Only in Agent mode for advanced settings) */}
        {mode === 'agent' && (
          <button
            className="options-toggle"
            onClick={() => setShowOptions(!showOptions)}
            title="Advanced Options"
          >
            ⚙️
          </button>
        )}

        <div className="chat-view-status">
          <span className={`status-indicator ${isLoading ? 'active' : ''}`} />
          <span className="status-text">{isLoading ? 'Thinking...' : 'Ready'}</span>
        </div>
      </div>

      {/* Agent Options Panel */}
      {mode === 'agent' && showOptions && (
        <AgentOptionsPanel
          options={agentOptions}
          onChange={onAgentOptionsChange}
          onClose={() => setShowOptions(false)}
        />
      )}

      {/* Image Attachments Preview */}
      {mode === 'agent' && attachedImages.length > 0 && (
        <div className="image-attachments-preview">
          {attachedImages.map((file, index) => (
            <div key={index} className="image-preview-item">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="preview-thumbnail"
              />
              <button
                className="remove-image"
                onClick={() => onImageRemove(index)}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <MessageList messages={messages} loading={isLoading} />

      {/* Chat Input with Image Attach */}
      <div className="chat-input-container">
        {mode === 'agent' && (
          <div className="attachment-actions">
            <label className="attach-image-button" title="Attach images">
              📎 Images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder={
            mode === 'cli'
              ? "Ask Claude about your code, commands, or project..."
              : "Ask Claude anything. You can attach images and use advanced features."
          }
        />
      </div>
    </div>
  );
}
