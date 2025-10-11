import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AgentOptions, ModelInfo } from '../types/agent';
import './AgentOptionsPanel.css';

interface AgentOptionsPanelProps {
  options: AgentOptions;
  onChange: (options: AgentOptions) => void;
  onClose: () => void;
}

export default function AgentOptionsPanel({
  options,
  onChange,
  onClose,
}: AgentOptionsPanelProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState(options.model || 'claude-sonnet-4-20250514');
  const [temperature, setTemperature] = useState(options.temperature || 1.0);
  const [thinkingEnabled, setThinkingEnabled] = useState(options.thinking_enabled || false);
  const [systemPrompt, setSystemPrompt] = useState(options.system_prompt || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const modelsList = await invoke<ModelInfo[]>('list_available_models');
      setModels(modelsList);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleApply = () => {
    onChange({
      model: selectedModel,
      temperature,
      thinking_enabled: thinkingEnabled,
      system_prompt: systemPrompt.trim() || undefined,
    });
    onClose();
  };

  const currentModel = models.find(m => m.id === selectedModel);

  return (
    <div className="agent-options-panel">
      <div className="panel-header">
        <h3>Agent Options</h3>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      <div className="panel-content">
        {/* Model Selection */}
        <div className="option-group">
          <label htmlFor="model-select">Model</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="model-select"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          {currentModel && (
            <p className="model-description">{currentModel.description}</p>
          )}
        </div>

        {/* Temperature */}
        <div className="option-group">
          <label htmlFor="temperature-slider">
            Temperature: {temperature.toFixed(2)}
          </label>
          <input
            id="temperature-slider"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="temperature-slider"
          />
          <div className="slider-labels">
            <span>Precise</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Extended Thinking */}
        {currentModel?.supports_thinking && (
          <div className="option-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={thinkingEnabled}
                onChange={(e) => setThinkingEnabled(e.target.checked)}
              />
              <span>Enable Extended Thinking</span>
            </label>
            <p className="option-hint">
              Allow Claude to think longer about complex problems
            </p>
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </button>

        {/* System Prompt */}
        {showAdvanced && (
          <div className="option-group">
            <label htmlFor="system-prompt">Custom System Prompt</label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Optional: Provide custom instructions for Claude..."
              rows={4}
              className="system-prompt-textarea"
            />
          </div>
        )}
      </div>

      <div className="panel-footer">
        <button className="cancel-button" onClick={onClose}>
          Cancel
        </button>
        <button className="apply-button" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}
