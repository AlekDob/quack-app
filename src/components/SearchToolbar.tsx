import { memo, useState, useCallback, useEffect, useRef } from 'react';
import './SearchToolbar.css';

interface SearchToolbarProps {
  onSearch: (query: string, options: SearchOptions) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onReplace?: (replaceText: string) => void;
  onReplaceAll?: (replaceText: string) => void;
  matchCount?: number;
  currentMatch?: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

function SearchToolbar({
  onSearch,
  onNext,
  onPrevious,
  onClose,
  onReplace,
  onReplaceAll,
  matchCount = 0,
  currentMatch = 0,
}: SearchToolbarProps) {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Trigger search when query or options change
  useEffect(() => {
    onSearch(query, { caseSensitive, wholeWord, regex });
  }, [query, caseSensitive, wholeWord, regex, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          onPrevious();
        } else {
          onNext();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [onNext, onPrevious, onClose]
  );

  return (
    <div className="search-toolbar">
      <div className="search-inputs-container">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Find in file..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {matchCount > 0 && (
            <span className="search-match-count">
              {currentMatch} of {matchCount}
            </span>
          )}
        </div>

        {showReplace && (
          <div className="replace-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="search-options">
        <button
          type="button"
          className={`search-option-btn ${caseSensitive ? 'active' : ''}`}
          onClick={() => setCaseSensitive(!caseSensitive)}
          title="Match case (Alt+C)"
          aria-label="Match case"
        >
          Aa
        </button>
        <button
          type="button"
          className={`search-option-btn ${wholeWord ? 'active' : ''}`}
          onClick={() => setWholeWord(!wholeWord)}
          title="Match whole word (Alt+W)"
          aria-label="Match whole word"
        >
          Ab
        </button>
        <button
          type="button"
          className={`search-option-btn ${regex ? 'active' : ''}`}
          onClick={() => setRegex(!regex)}
          title="Use regular expression (Alt+R)"
          aria-label="Use regular expression"
        >
          .*
        </button>
      </div>

      <div className="search-navigation">
        <button
          type="button"
          className="search-nav-btn"
          onClick={onPrevious}
          disabled={matchCount === 0}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 9L5 6L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          className="search-nav-btn"
          onClick={onNext}
          disabled={matchCount === 0}
          title="Next match (Enter)"
          aria-label="Next match"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 3L7 6L4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {onReplace && onReplaceAll && (
        <div className="search-replace-actions">
          <button
            type="button"
            className={`search-option-btn ${showReplace ? 'active' : ''}`}
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle replace (Cmd+H / Ctrl+H)"
            aria-label="Toggle replace"
          >
            R
          </button>
          {showReplace && (
            <>
              <button
                type="button"
                className="search-replace-btn"
                onClick={() => onReplace(replaceText)}
                disabled={matchCount === 0}
                title="Replace current match"
                aria-label="Replace"
              >
                Replace
              </button>
              <button
                type="button"
                className="search-replace-btn"
                onClick={() => onReplaceAll(replaceText)}
                disabled={matchCount === 0}
                title="Replace all matches"
                aria-label="Replace all"
              >
                All
              </button>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="search-close-btn"
        onClick={onClose}
        title="Close search (Escape)"
        aria-label="Close search"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

export default memo(SearchToolbar);
