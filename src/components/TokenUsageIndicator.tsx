import { useState } from 'react';
import './TokenUsageIndicator.css';
import TokenUsageModal from './TokenUsageModal';

interface TokenUsageIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  maxTokens?: number; // Default: 200000
  onCompact?: () => void;
  onClear?: () => void;
}

export default function TokenUsageIndicator({
  inputTokens,
  outputTokens,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  maxTokens = 200000,
  onCompact,
  onClear,
}: TokenUsageIndicatorProps) {
  const [showModal, setShowModal] = useState(false);

  // Calculate totals
  const totalTokens = inputTokens + outputTokens;
  const percentage = (totalTokens / maxTokens) * 100;

  // Determine status and color
  const getStatus = () => {
    if (percentage >= 90) return { level: 'critical', color: '#EF4444', label: 'Critical' };
    if (percentage >= 75) return { level: 'warning', color: '#F59E0B', label: 'Warning' };
    if (percentage >= 50) return { level: 'caution', color: '#EAB308', label: 'Caution' };
    return { level: 'normal', color: '#10B981', label: 'Normal' };
  };

  const status = getStatus();

  // Format token count (45.2k, 120k, etc.)
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toString();
  };

  return (
    <>
      <div
        className={`token-usage-indicator ${status.level}`}
        onClick={() => setShowModal(true)}
        title="Click for details"
      >
        <div className="token-usage-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>{formatTokens(totalTokens)} / {formatTokens(maxTokens)}</span>
        </div>
        <div className="token-usage-progress-bar">
          <div
            className="token-usage-progress-fill"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: status.color,
            }}
          />
        </div>
        {status.level !== 'normal' && (
          <div className="token-usage-badge" style={{ backgroundColor: status.color }}>
            {status.label}
          </div>
        )}
      </div>

      {showModal && (
        <TokenUsageModal
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          cacheCreationTokens={cacheCreationTokens}
          cacheReadTokens={cacheReadTokens}
          maxTokens={maxTokens}
          percentage={percentage}
          status={status}
          onClose={() => setShowModal(false)}
          onCompact={onCompact}
          onClear={onClear}
        />
      )}
    </>
  );
}
