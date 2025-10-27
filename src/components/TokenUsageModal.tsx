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
      <div className="token-modal" onClick={(e) => e.stopPropagation()}>
        <div className="token-modal-header">
          <h3>Token Usage Details</h3>
          <button className="token-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="token-modal-content">
          {/* Progress Circle */}
          <div className="token-usage-circle">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={status.color}
                strokeWidth="8"
                strokeDasharray={`${(percentage / 100) * 339.292} 339.292`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="55"
                textAnchor="middle"
                fontSize="24"
                fontWeight="600"
                fill="rgba(255, 255, 255, 0.9)"
              >
                {percentage.toFixed(1)}%
              </text>
              <text
                x="60"
                y="75"
                textAnchor="middle"
                fontSize="12"
                fill="rgba(255, 255, 255, 0.6)"
              >
                {status.label}
              </text>
            </svg>
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
