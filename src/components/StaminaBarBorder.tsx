import { useState, memo } from 'react';
import TokenUsageModal from './TokenUsageModal';

interface StaminaBarBorderProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;
  maxTokens?: number;
  overhead?: number;
  onCompact?: () => void;
  onClear?: () => void;
}

// Default overhead estimate based on Claude CLI /context output (~38k tokens)
const DEFAULT_OVERHEAD = 38000;

// Auto-compact cost: estimated tokens used when auto-compact triggers
const AUTO_COMPACT_COST = 45000;

interface DuckStatus {
  level: string;
  color: string;
  label: string;
  emoji: string;
  message: string;
}

function StaminaBarBorder({
  inputTokens,
  outputTokens,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  totalCost = 0,
  maxTokens = 200000,
  overhead = DEFAULT_OVERHEAD,
  onCompact,
  onClear,
}: StaminaBarBorderProps) {
  const [showModal, setShowModal] = useState(false);

  // Calculate stamina
  const messageTokens = inputTokens + outputTokens;
  const totalContextUsage = messageTokens + overhead;
  const usagePercentage = (totalContextUsage / maxTokens) * 100;

  const maxUsableTokens = maxTokens - overhead - AUTO_COMPACT_COST;
  const remainingUsableTokens = Math.max(0, maxUsableTokens - messageTokens);
  const staminaPercentage = Math.max(0, Math.min(100, (remainingUsableTokens / maxUsableTokens) * 100));

  // Determine status
  const getStatus = (): DuckStatus => {
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

  const status = getStatus();

  return (
    <>
      <div
        className="chat-view-footer-stamina-bar"
        data-status={status.level}
        onClick={() => setShowModal(true)}
        title={`${Math.round(staminaPercentage)}% Stamina - ${status.message} (click for details)`}
      >
        <div
          className="chat-view-footer-stamina-fill"
          style={{ width: `${Math.max(1, staminaPercentage)}%` }}
        />
      </div>
      <span
        className="chat-view-footer-stamina-label"
        onClick={() => setShowModal(true)}
        style={{ cursor: 'pointer' }}
      >
        {Math.round(staminaPercentage)}% STAMINA
      </span>

      {showModal && (
        <TokenUsageModal
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          cacheCreationTokens={cacheCreationTokens}
          cacheReadTokens={cacheReadTokens}
          totalCost={totalCost}
          maxTokens={maxTokens}
          percentage={usagePercentage}
          overhead={overhead}
          status={status}
          onClose={() => setShowModal(false)}
          onCompact={onCompact}
          onClear={onClear}
        />
      )}
    </>
  );
}

export default memo(StaminaBarBorder, (prevProps, nextProps) => {
  return (
    prevProps.inputTokens === nextProps.inputTokens &&
    prevProps.outputTokens === nextProps.outputTokens &&
    prevProps.cacheCreationTokens === nextProps.cacheCreationTokens &&
    prevProps.cacheReadTokens === nextProps.cacheReadTokens &&
    prevProps.totalCost === nextProps.totalCost &&
    prevProps.overhead === nextProps.overhead
  );
});
