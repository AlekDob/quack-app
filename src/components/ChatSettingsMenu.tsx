import { useState, useRef, useEffect } from 'react';
import type { ThinkingMode, PermissionMode } from '../hooks/useClaudeChat';
import './ChatSettingsMenu.css';

interface ChatSettingsMenuProps {
  model: string;
  thinkingMode: ThinkingMode;
  permissionMode: PermissionMode;
  onModelChange: (model: string) => void;
  onThinkingModeChange: (mode: ThinkingMode) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
  disabled?: boolean;
}

const modelOptions = [
  { value: 'haiku-3.5', label: 'Haiku 3.5' },
  { value: 'haiku', label: 'Haiku 4.5' },
  { value: 'sonnet', label: 'Sonnet 4.5' },
  { value: 'opus', label: 'Opus 4.1' },
];

const thinkingModeOptions = [
  { value: 'auto' as ThinkingMode, label: '▮ Auto · Let model decide' },
  { value: 'think' as ThinkingMode, label: '▮▮ Think · Step-by-step' },
  { value: 'hard' as ThinkingMode, label: '▮▮▮ Think Hard · Deeper reasoning' },
  { value: 'harder' as ThinkingMode, label: '▮▮▮▮ Think Harder · Thorough reasoning' },
  { value: 'ultra' as ThinkingMode, label: '▮▮▮▮▮ Ultra Think · Maximum deliberation' },
];

const permissionModeOptions = [
  { value: 'plan' as PermissionMode, label: '◇ Plan · Planning only' },
  { value: 'bypass' as PermissionMode, label: '⬢ Bypass · No confirmations' },
];

export default function ChatSettingsMenu({
  model,
  thinkingMode,
  permissionMode,
  onModelChange,
  onThinkingModeChange,
  onPermissionModeChange,
  disabled,
}: ChatSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const getModelLabel = () => {
    return modelOptions.find(opt => opt.value === model)?.label ?? model;
  };

  const getThinkingLabel = () => {
    const option = thinkingModeOptions.find(opt => opt.value === thinkingMode);
    return option?.label.split('·')[0].trim() ?? thinkingMode;
  };

  const getPermissionLabel = () => {
    const option = permissionModeOptions.find(opt => opt.value === permissionMode);
    return option?.label.split('·')[0].trim() ?? permissionMode;
  };

  const getPermissionColor = () => {
    const colors: Record<PermissionMode, string> = {
      plan: '#60a5fa',
      bypass: '#f87171',
    };
    return colors[permissionMode] || '#ffffff';
  };

  return (
    <div className="chat-settings-menu">
      <button
        ref={buttonRef}
        type="button"
        className="chat-settings-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Chat settings"
        title="Chat settings"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
        <span className="chat-settings-summary">
          {getModelLabel()} · {getThinkingLabel()} ·
          <span style={{ color: getPermissionColor(), fontWeight: 600 }}> {getPermissionLabel()}</span>
        </span>
      </button>

      {isOpen && (
        <div ref={menuRef} className="chat-settings-popover">
          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">Model</span>
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="chat-settings-select"
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">Thinking</span>
              <select
                value={thinkingMode}
                onChange={(e) => onThinkingModeChange(e.target.value as ThinkingMode)}
                className="chat-settings-select"
              >
                {thinkingModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="chat-settings-section">
            <label className="chat-settings-label">
              <span className="chat-settings-label-text">Mode</span>
              <select
                value={permissionMode}
                onChange={(e) => onPermissionModeChange(e.target.value as PermissionMode)}
                className="chat-settings-select"
              >
                {permissionModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
