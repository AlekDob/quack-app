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

// Duck status interface for stamina levels
interface DuckStatus {
  level: string;
  color: string;
  label: string;
  emoji: string;
  message: string;
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

  // Progressive multiplier: starts at 1x, gradually increases to 2x as tokens are consumed
  // This makes stamina drain faster as you use more tokens (more realistic)
  const multiplier = 1 + (totalTokens / maxTokens); // 1x → 2x progression
  const effectiveTokens = totalTokens * multiplier;
  const usagePercentage = (effectiveTokens / maxTokens) * 100;

  // INVERTED: Stamina starts at 100% and decreases as tokens are used
  const staminaPercentage = Math.max(0, 100 - usagePercentage);

  // Debug logging
  console.log('[TokenUsageIndicator] Debug:', {
    inputTokens,
    outputTokens,
    totalTokens,
    multiplier: multiplier.toFixed(2),
    effectiveTokens,
    usagePercentage,
    staminaPercentage,
  });

  // Determine duck stamina status (INVERTED LOGIC)
  const getDuckStatus = (): DuckStatus => {
    if (staminaPercentage <= 10) return {
      level: 'exhausted',
      color: '#EF4444',
      label: 'Exhausted',
      emoji: '🥵',
      message: 'Duck needs rest!'
    };
    if (staminaPercentage <= 25) return {
      level: 'tired',
      color: '#F59E0B',
      label: 'Tired',
      emoji: '😮‍💨',
      message: 'Getting tired...'
    };
    if (staminaPercentage <= 50) return {
      level: 'working',
      color: '#EAB308',
      label: 'Working',
      emoji: '😅',
      message: 'Still going!'
    };
    return {
      level: 'fresh',
      color: '#10B981',
      label: 'Fresh',
      emoji: '🦆',
      message: 'Full energy!'
    };
  };

  const status = getDuckStatus();

  // Format token count (45.2k, 120k, etc.) - unused but kept for potential future use
  // const formatTokens = (tokens: number) => {
  //   if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  //   if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  //   return tokens.toString();
  // };

  return (
    <>
      <div
        className={`token-usage-indicator duck-stamina-meter ${status.level}`}
        onClick={() => setShowModal(true)}
        title={status.message}
      >
        <div className="token-usage-label">
          <img src="/images/stamina-icon.png" alt="Duck" className="duck-stamina-icon" />
          <span className="stamina-text">
            <span className="stamina-percentage">{Math.round(staminaPercentage)}%</span>
            <span className="stamina-label">Stamina</span>
          </span>
        </div>
        <div className="token-usage-progress-bar stamina-bar">
          {staminaPercentage > 0 && (
            <div
              className="token-usage-progress-fill stamina-fill"
              data-stamina={staminaPercentage}
              data-color={status.color}
              style={{
                width: `${Math.max(1, Math.min(staminaPercentage, 100))}%`,
                height: '100%',
                backgroundColor: status.color,
                boxShadow: `0 0 12px ${status.color}, inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
                display: 'block',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
          )}
        </div>
        {status.level !== 'fresh' && (
          <div className="token-usage-badge stamina-badge" style={{ backgroundColor: status.color }}>
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
          percentage={usagePercentage}
          status={status}
          onClose={() => setShowModal(false)}
          onCompact={onCompact}
          onClear={onClear}
        />
      )}
    </>
  );
}
