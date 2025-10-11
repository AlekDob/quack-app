import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ModelInfo } from '../types/agent';
import './ModelSelector.css';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  compact?: boolean;
}

export default function ModelSelector({
  value,
  onChange,
  compact = false,
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = models.find(m => m.id === value);

  useEffect(() => {
    loadModels();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const loadModels = async () => {
    try {
      const modelsList = await invoke<ModelInfo[]>('list_available_models');
      setModels(modelsList);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const getModelShortName = (modelName: string): string => {
    // Convert "Claude Sonnet 4.5" -> "Sonnet 4.5"
    return modelName.replace('Claude ', '');
  };

  const getModelIcon = (modelName: string): string => {
    if (modelName.includes('Opus')) return '🧠'; // Most powerful
    if (modelName.includes('Sonnet')) return '⚡'; // Balanced/Fast
    if (modelName.includes('Haiku')) return '🚀'; // Fastest
    return '🤖';
  };

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        className={`model-selector-button ${compact ? 'compact' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title={currentModel ? currentModel.description : 'Select model'}
      >
        <span className="model-icon">{currentModel ? getModelIcon(currentModel.name) : '🤖'}</span>
        <span className="model-name">
          {currentModel ? getModelShortName(currentModel.name) : 'Select Model'}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className="model-selector-dropdown">
          <div className="dropdown-header">
            <span className="dropdown-title">Select Model</span>
            <button
              className="dropdown-close"
              onClick={() => setShowDropdown(false)}
            >
              ✕
            </button>
          </div>

          <div className="models-list">
            {models.map((model) => (
              <button
                key={model.id}
                className={`model-option ${value === model.id ? 'selected' : ''}`}
                onClick={() => {
                  onChange(model.id);
                  setShowDropdown(false);
                }}
              >
                <div className="model-option-icon">{getModelIcon(model.name)}</div>
                <div className="model-option-info">
                  <div className="model-option-name">{model.name}</div>
                  <div className="model-option-description">{model.description}</div>
                  <div className="model-option-features">
                    {model.supports_vision && (
                      <span className="feature-badge">👁️ Vision</span>
                    )}
                    {model.supports_thinking && (
                      <span className="feature-badge">🧠 Thinking</span>
                    )}
                  </div>
                </div>
                {value === model.id && (
                  <div className="option-checkmark">✓</div>
                )}
              </button>
            ))}
          </div>

          <div className="dropdown-footer">
            <span className="model-hint">
              💡 Sonnet 4.5 is recommended for most tasks
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
