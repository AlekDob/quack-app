import { useState, memo } from 'react';
import './ThinkingBlock.css';

interface ThinkingBlockProps {
  content: string;
  defaultExpanded?: boolean;
}

function ThinkingBlock({ content, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Count lines for preview
  const lines = content.split('\n');
  const previewLines = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;

  return (
    <div className={`thinking-block ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="thinking-block-header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className="thinking-block-icon">
          {isExpanded ? (
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
        <span className="thinking-block-hint">
          {isExpanded ? 'click to collapse' : 'click to expand'}
        </span>
      </button>

      <div className="thinking-block-content">
        {isExpanded ? (
          <pre className="thinking-block-text">{content}</pre>
        ) : (
          <pre className="thinking-block-preview">
            {previewLines}
            {hasMore && <span className="thinking-block-more">...</span>}
          </pre>
        )}
      </div>
    </div>
  );
}

export default memo(ThinkingBlock);
