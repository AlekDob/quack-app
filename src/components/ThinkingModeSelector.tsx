import { useState, useRef, useEffect } from 'react';
import type { ThinkingMode } from '../types/agent';
import { THINKING_MODES } from '../types/agent';
import './ThinkingModeSelector.css';

interface ThinkingModeSelectorProps {
  value: ThinkingMode;
  onChange: (mode: ThinkingMode) => void;
  compact?: boolean;
}

export default function ThinkingModeSelector({
  value,
  onChange,
  compact = false,
}: ThinkingModeSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentConfig = THINKING_MODES[value];

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

  const renderBars = (numBars: number, color: string) => {
    if (numBars === 0) {
      return <span className="thinking-auto-icon">Auto</span>;
    }

    return (
      <div className="thinking-bars">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={`thinking-bar ${index < numBars ? 'active' : ''}`}
            style={{
              backgroundColor: index < numBars ? color : '#e2e8f0',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="thinking-mode-selector" ref={dropdownRef}>
      <button
        className={`thinking-mode-button ${compact ? 'compact' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title={`Thinking Mode: ${currentConfig.description}`}
      >
        {renderBars(currentConfig.visualBars, currentConfig.color)}
        {!compact && (
          <span className="thinking-mode-label">{currentConfig.mode === 'auto' ? 'Auto' : currentConfig.mode.replace('-', ' ')}</span>
        )}
        <span className="dropdown-arrow">▼</span>
      </button>

      {showDropdown && (
        <div className="thinking-mode-dropdown">
          <div className="dropdown-header">
            <span className="dropdown-title">Thinking Mode</span>
            <button
              className="dropdown-close"
              onClick={() => setShowDropdown(false)}
            >
              ✕
            </button>
          </div>

          <div className="thinking-modes-list">
            {(Object.entries(THINKING_MODES) as [ThinkingMode, typeof THINKING_MODES[ThinkingMode]][]).map(([mode, config]) => (
              <button
                key={mode}
                className={`thinking-mode-option ${value === mode ? 'selected' : ''}`}
                onClick={() => {
                  onChange(mode);
                  setShowDropdown(false);
                }}
              >
                <div className="option-visual">
                  {renderBars(config.visualBars, config.color)}
                </div>
                <div className="option-info">
                  <div className="option-name">
                    {config.mode === 'auto' ? 'Auto' : config.mode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </div>
                  <div className="option-description">{config.description}</div>
                </div>
                {value === mode && (
                  <div className="option-checkmark">✓</div>
                )}
              </button>
            ))}
          </div>

          <div className="dropdown-footer">
            <span className="thinking-hint">
              💡 Higher thinking modes use more tokens but provide deeper reasoning
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
