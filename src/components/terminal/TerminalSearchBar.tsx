import { useState, useCallback, useEffect, useRef, memo } from 'react';
import type { SearchAddon } from '@xterm/addon-search';
import './TerminalSearchBar.css';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon;
  onClose: () => void;
}

const SEARCH_DECORATIONS = {
  matchOverviewRuler: '#f28c52',
  activeMatchColorOverviewRuler: '#f28c52',
};

function TerminalSearchBarComponent({ searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hasMatches, setHasMatches] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Run search when query or options change
  useEffect(() => {
    if (!query) {
      searchAddon.clearDecorations();
      setHasMatches(false);
      return;
    }

    const result = searchAddon.findNext(query, {
      caseSensitive,
      decorations: SEARCH_DECORATIONS,
    });

    setHasMatches(!!result);
  }, [query, caseSensitive, searchAddon]);

  const findNext = useCallback(() => {
    if (!query) return;
    const result = searchAddon.findNext(query, {
      caseSensitive,
      decorations: SEARCH_DECORATIONS,
    });
    setHasMatches(!!result);
  }, [query, caseSensitive, searchAddon]);

  const findPrevious = useCallback(() => {
    if (!query) return;
    const result = searchAddon.findPrevious(query, {
      caseSensitive,
      decorations: SEARCH_DECORATIONS,
    });
    setHasMatches(!!result);
  }, [query, caseSensitive, searchAddon]);

  const handleClose = useCallback(() => {
    searchAddon.clearDecorations();
    onClose();
  }, [searchAddon, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    },
    [findNext, findPrevious, handleClose]
  );

  return (
    <div className="terminal-search-bar">
      <div className="terminal-search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="terminal-search-input"
          placeholder="Find..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <span className="terminal-search-count">
            {hasMatches ? 'Found' : 'No results'}
          </span>
        )}
      </div>

      <button
        type="button"
        className={`terminal-search-option-btn ${caseSensitive ? 'active' : ''}`}
        onClick={() => setCaseSensitive(!caseSensitive)}
        title="Match case"
      >
        Aa
      </button>

      <button
        type="button"
        className="terminal-search-nav-btn"
        onClick={findPrevious}
        title="Previous match (Shift+Enter)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 9L6 3M3 5L6 2L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        className="terminal-search-nav-btn"
        onClick={findNext}
        title="Next match (Enter)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 3L6 9M3 7L6 10L9 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        className="terminal-search-close-btn"
        onClick={handleClose}
        title="Close (Escape)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M8 2L2 8M2 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

export const TerminalSearchBar = memo(TerminalSearchBarComponent);
