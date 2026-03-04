import './CompactingIndicator.css';

interface CompactingIndicatorProps {
  isCompacting: boolean;
}

export default function CompactingIndicator({ isCompacting }: CompactingIndicatorProps) {
  return (
    <div className="compacting-indicator">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="compacting-icon">
        <path d="M2 2a1 1 0 011-1h10a1 1 0 011 1v4a.5.5 0 01-1 0V2H3v4a.5.5 0 01-1 0V2zm0 12a1 1 0 001 1h10a1 1 0 001-1v-4a.5.5 0 00-1 0v4H3v-4a.5.5 0 00-1 0v4zM7.5 6.5a.5.5 0 011 0v1h1a.5.5 0 010 1h-1v1a.5.5 0 01-1 0v-1h-1a.5.5 0 010-1h1v-1z"/>
      </svg>
      <span className="compacting-text">
        {isCompacting ? 'Compacting context' : 'Context compacted'}
      </span>
      {isCompacting && (
        <span className="compacting-dots">
          <span /><span /><span />
        </span>
      )}
    </div>
  );
}
