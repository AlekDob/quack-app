import './TokenUsageModal.css';

interface TokenUsageModalProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  maxTokens: number;
  percentage: number;
  status: {
    level: string;
    color: string;
    label: string;
    emoji?: string;
    message?: string;
  };
  onClose: () => void;
  onCompact?: () => void;
  onClear?: () => void;
}

export default function TokenUsageModal({
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
  maxTokens,
  percentage,
  status,
  onClose,
  onCompact,
  onClear,
}: TokenUsageModalProps) {
  const totalTokens = inputTokens + outputTokens;
  const remainingTokens = maxTokens - totalTokens;

  // INVERTED: Stamina percentage (100% = fresh, 0% = exhausted)
  const staminaPercentage = Math.max(0, 100 - percentage);

  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString();
  };

  const getSuggestion = () => {
    if (percentage >= 90) {
      return {
        title: '🚨 Critical: Action Required',
        message: 'You are very close to the token limit. Clear the conversation or use /compact to continue.',
        action: 'clear',
      };
    }
    if (percentage >= 75) {
      return {
        title: '⚠️ Warning: Approaching Limit',
        message: 'Consider using /compact to reduce token usage while preserving context.',
        action: 'compact',
      };
    }
    if (percentage >= 50) {
      return {
        title: '💡 Tip',
        message: 'You\'re halfway to the token limit. Monitor your usage or use /compact when needed.',
        action: null,
      };
    }
    return {
      title: '✅ All Good',
      message: 'You have plenty of tokens remaining for this session.',
      action: null,
    };
  };

  const suggestion = getSuggestion();

  return (
    <div className="token-modal-overlay" onClick={onClose}>
      <div className="token-modal fallout-style" onClick={(e) => e.stopPropagation()}>
        <div className="token-modal-header fallout-header">
          <h3>🦆 DUCK STAMINA STATUS</h3>
          <button className="token-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="token-modal-content fallout-content">
          {/* Fallout-style Duck Stamina Display */}
          <div className="fallout-stamina-display">
            {/* Duck Image */}
            <div className="fallout-duck-container">
              <img
                src="/images/stamina.png"
                alt="Duck Stamina"
                className="fallout-duck-image"
              />
              <div className="fallout-duck-status-badge" style={{ backgroundColor: status.color }}>
                {status.emoji} {status.label}
              </div>
            </div>

            {/* Stamina Bar (Fallout-style) */}
            <div className="fallout-stamina-section">
              <div className="fallout-stat-label">
                <span className="fallout-stat-name">STAMINA</span>
                <span className="fallout-stat-value">{Math.round(staminaPercentage)}%</span>
              </div>
              <div className="fallout-progress-bar-container">
                <div className="fallout-progress-bar">
                  <div
                    className="fallout-progress-fill"
                    style={{
                      width: `${staminaPercentage}%`,
                      backgroundColor: status.color,
                    }}
                  />
                </div>
                <div className="fallout-progress-segments">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="fallout-segment" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="token-breakdown">
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Total Used</span>
              <span className="token-breakdown-value">{formatTokens(totalTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Remaining</span>
              <span className="token-breakdown-value">{formatTokens(remainingTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Input Tokens</span>
              <span className="token-breakdown-value">{formatTokens(inputTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Output Tokens</span>
              <span className="token-breakdown-value">{formatTokens(outputTokens)}</span>
            </div>
            {(cacheCreationTokens > 0 || cacheReadTokens > 0) && (
              <>
                <div className="token-breakdown-divider" />
                {cacheCreationTokens > 0 && (
                  <div className="token-breakdown-item">
                    <span className="token-breakdown-label">Cache Creation</span>
                    <span className="token-breakdown-value">{formatTokens(cacheCreationTokens)}</span>
                  </div>
                )}
                {cacheReadTokens > 0 && (
                  <div className="token-breakdown-item">
                    <span className="token-breakdown-label">Cache Read</span>
                    <span className="token-breakdown-value">{formatTokens(cacheReadTokens)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggestion Card */}
          <div className={`token-suggestion ${status.level}`}>
            <div className="token-suggestion-title">{suggestion.title}</div>
            <div className="token-suggestion-message">{suggestion.message}</div>
            {suggestion.action && (
              <div className="token-suggestion-actions">
                {suggestion.action === 'compact' && onCompact && (
                  <button className="token-action-btn primary" onClick={() => {
                    onCompact();
                    onClose();
                  }}>
                    Run /compact
                  </button>
                )}
                {suggestion.action === 'clear' && onClear && (
                  <button className="token-action-btn danger" onClick={() => {
                    onClear();
                    onClose();
                  }}>
                    Clear Conversation
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="token-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Claude sessions have a 200k token context window. Use /compact to preserve context while reducing tokens.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
