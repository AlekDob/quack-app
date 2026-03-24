import { useState, useRef, useEffect } from 'react';
import type { PermissionMode } from '../hooks/useClaudeChat';
import './CustomPermissionSelect.css';

interface PermissionOption {
  value: PermissionMode;
  label: string;
  icon: string;
  color: string;
}

const permissionOptions: PermissionOption[] = [
  { value: 'plan', label: 'Plan · Planning only', icon: '◇', color: '#60a5fa' },
  { value: 'bypass', label: 'Build · No confirmations', icon: '⬢', color: '#f87171' },
  { value: 'debug', label: 'Debug · Systematic debugging', icon: '⬡', color: '#22c55e' },
  { value: 'chat', label: 'Chat · Ask before acting', icon: '○', color: '#00D9FF' },
];

interface CustomPermissionSelectProps {
  value: PermissionMode;
  onChange: (value: PermissionMode) => void;
}

export default function CustomPermissionSelect({ value, onChange }: CustomPermissionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = permissionOptions.find(opt => opt.value === value) || permissionOptions[1]; // Default to bypass

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
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

  const handleSelect = (option: PermissionOption) => {
    // Close immediately to prevent visual glitches
    setIsOpen(false);
    // Call onChange after state update to avoid race conditions
    setTimeout(() => onChange(option.value), 0);
  };

  return (
    <div className="custom-permission-select" ref={containerRef}>
      <button
        type="button"
        className="permission-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="permission-icon" style={{ color: selectedOption.color }}>
          {selectedOption.icon}
        </span>
        <span className="permission-label">{selectedOption.label}</span>
        <svg
          className={`permission-chevron ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"/>
        </svg>
      </button>

      {isOpen && (
        <div className="permission-options-dropdown">
          {permissionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`permission-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option)}
            >
              <span className="permission-icon" style={{ color: option.color }}>
                {option.icon}
              </span>
              <span className="permission-label">{option.label}</span>
              {value === option.value && (
                <svg className="check-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
