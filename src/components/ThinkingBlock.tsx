import { useState, useEffect, memo } from 'react';
import './ThinkingBlock.css';

interface ThinkingBlockProps {
  content: string;
  /** Controlled expanded state (optional) */
  isExpanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Default expanded state for uncontrolled mode */
  defaultExpanded?: boolean;
  /** Reset key - when this changes, reset to defaultExpanded */
  resetKey?: string | number;
}

function ThinkingBlock({
  content,
  isExpanded: controlledExpanded,
  onExpandedChange,
  defaultExpanded = false,
  resetKey
}: ThinkingBlockProps) {
  // Internal state for uncontrolled mode
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  // Reset local state when resetKey changes
  useEffect(() => {
    if (resetKey !== undefined) {
      setLocalExpanded(defaultExpanded);
    }
  }, [resetKey, defaultExpanded]);

  // Use controlled state if provided, otherwise use local state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;

  // Inline preview for collapsed state (first line, truncated)
  const inlinePreview = content.split('\n')[0]?.slice(0, 80) || '';

  // Handle toggle - update both controlled and uncontrolled
  const handleToggle = () => {
    const newExpanded = !expanded;

    // Always update local state (for uncontrolled mode)
    setLocalExpanded(newExpanded);

    // Notify parent if callback provided (for controlled mode)
    onExpandedChange?.(newExpanded);
  };

  return (
    <div className={`thinking-block ${expanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="thinking-block-header"
        onClick={handleToggle}
        type="button"
      >
        <span className="thinking-block-icon">
          {expanded ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          )}
        </span>
        <span className="thinking-block-label">Thinking</span>
        {!expanded && (
          <span className="thinking-block-inline-preview">{inlinePreview}</span>
        )}
        <span className="thinking-block-hint">
          {expanded ? 'collapse' : 'expand'}
        </span>
      </button>

      {expanded && (
        <div className="thinking-block-content">
          <pre className="thinking-block-text">{content}</pre>
        </div>
      )}
    </div>
  );
}

export default memo(ThinkingBlock);
