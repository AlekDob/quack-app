import { useState, useCallback, useEffect, useRef, memo } from 'react';
import './TerminalFilterBar.css';

interface TerminalFilterBarProps {
  onFilterChange: (term: string) => void;
  onClose: () => void;
  matchCount: number;
}

function TerminalFilterBarComponent({ onFilterChange, onClose, matchCount }: TerminalFilterBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced filter update
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onFilterChange(query);
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, onFilterChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  return (
    <div className="terminal-filter-bar">
      <span className="terminal-filter-label">Filter</span>
      <div className="terminal-filter-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="terminal-filter-input"
          placeholder="Filter lines..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <span className="terminal-filter-count">
            {matchCount} {matchCount === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>

      <button
        type="button"
        className="terminal-filter-close-btn"
        onClick={onClose}
        title="Close filter (Escape)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export const TerminalFilterBar = memo(TerminalFilterBarComponent);
