interface StoreEmptyStateProps {
  type: 'no-results' | 'empty' | 'error' | 'loading';
  query?: string;
  onRetry?: () => void;
}

export default function StoreEmptyState({ type, query, onRetry }: StoreEmptyStateProps) {
  if (type === 'loading') {
    return (
      <div className="store-skeleton">
        <div className="store-skeleton-hero" />
        <div className="store-skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="store-skeleton-card">
              <div className="store-skeleton-icon" />
              <div className="store-skeleton-lines">
                <div className="store-skeleton-bar" style={{ width: '60%' }} />
                <div className="store-skeleton-bar" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="store-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="store-empty-title">Could not load the store</span>
        <span className="store-empty-subtitle">Check your connection and try again</span>
        {onRetry && (
          <button type="button" className="store-empty-retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (type === 'no-results') {
    return (
      <div className="store-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="store-empty-title">No results for &ldquo;{query}&rdquo;</span>
        <span className="store-empty-subtitle">Try a different search or filter</span>
      </div>
    );
  }

  return (
    <div className="store-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span className="store-empty-title">No items available yet</span>
      <span className="store-empty-subtitle">New extensions are added regularly</span>
    </div>
  );
}
