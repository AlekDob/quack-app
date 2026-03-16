import { useState, memo } from 'react';
import './TokenUsageIndicator.css';
import TokenUsageModal from './TokenUsageModal';
import MaxPlanStatsModal from './MaxPlanStatsModal';
// TEMPORARILY DISABLED: MaxPlanProvider
// import { useMaxPlan } from '../contexts/MaxPlanContext';
import { toast } from 'sonner';

interface TokenUsageIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number; // total_cost_usd from Claude SDK (authoritative)
  maxTokens?: number; // Context window size from SDK (undefined until first result event)
  overhead?: number; // Dynamic overhead calculated from project files (default: 38000)
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

// Default overhead estimate based on Claude CLI /context output (~38k tokens)
const DEFAULT_OVERHEAD = 38000;

// Auto-compact cost: estimated tokens used when auto-compact triggers
const AUTO_COMPACT_COST = 45000;

function TokenUsageIndicator({
  inputTokens,
  outputTokens,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  totalCost = 0,
  maxTokens,
  overhead = DEFAULT_OVERHEAD,
  onCompact,
  onClear,
}: TokenUsageIndicatorProps) {
  const [showModal, setShowModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Don't render until SDK reports the actual context window size
  if (!maxTokens) {
    return null;
  }

  // TEMPORARILY DISABLED: Max Plan tracking
  // const { stats: maxPlanStats, history, clearHistory, exportHistory } = useMaxPlan();
  const maxPlanStats = undefined;
  const history = {
    dailyUsage: [],
    weeklyUsage: [],
    totalMessages: 0,
    totalTokens: 0,
    averageMessagesPerDay: 0,
    averageTokensPerDay: 0,
    peakDay: null,
    peakWeek: null,
  };
  const clearHistory = () => {};
  const exportHistory = () => '';

  // With the new tracking model, inputTokens from SDK = full context window input
  // (already includes system + tools + all messages). Overhead is included in inputTokens.
  // Total context usage = inputTokens + auto-compact reserve
  const totalContextUsage = inputTokens + AUTO_COMPACT_COST;

  // Calculate usage percentage based on total context
  const usagePercentage = (totalContextUsage / maxTokens) * 100;

  // STAMINA LOGIC: Based on FREE tokens (usable space)
  // maxUsableTokens = total context minus auto-compact reserve
  const maxUsableTokens = maxTokens - AUTO_COMPACT_COST;
  const remainingUsableTokens = Math.max(0, maxUsableTokens - inputTokens);

  // Stamina = percentage of usable space remaining
  // Fresh agent (0 input tokens): 100%
  // Context window full: 0%
  const staminaPercentage = Math.max(0, Math.min(100, (remainingUsableTokens / maxUsableTokens) * 100));

  // Debug logging (disabled for performance)
  // console.log('[TokenUsageIndicator] Debug:', {
  //   inputTokens,
  //   outputTokens,
  //   totalTokens,
  //   multiplier: multiplier.toFixed(2),
  //   effectiveTokens,
  //   usagePercentage,
  //   staminaPercentage,
  // });

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

  // Handler functions for analytics modal
  const handleExportHistory = () => {
    const json = exportHistory();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maxplan-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('📥 History exported successfully!');
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all usage history? This cannot be undone.')) {
      clearHistory();
      toast.success('🗑️ Usage history cleared!');
      setShowAnalytics(false);
    }
  };

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
          totalCost={totalCost}
          maxTokens={maxTokens}
          percentage={usagePercentage}
          overhead={overhead}
          status={status}
          onClose={() => setShowModal(false)}
          onCompact={onCompact}
          onClear={onClear}
          onShowAnalytics={() => setShowAnalytics(true)}
          maxPlanStats={maxPlanStats}
        />
      )}

      {showAnalytics && (
        <MaxPlanStatsModal
          history={history}
          onClose={() => setShowAnalytics(false)}
          onExport={handleExportHistory}
          onClear={handleClearHistory}
        />
      )}
    </>
  );
}

// Export with memo to prevent unnecessary re-renders
export default memo(TokenUsageIndicator, (prevProps, nextProps) => {
  // Only re-render if token counts, cost, or overhead actually changed
  return (
    prevProps.inputTokens === nextProps.inputTokens &&
    prevProps.outputTokens === nextProps.outputTokens &&
    prevProps.cacheCreationTokens === nextProps.cacheCreationTokens &&
    prevProps.cacheReadTokens === nextProps.cacheReadTokens &&
    prevProps.totalCost === nextProps.totalCost &&
    prevProps.overhead === nextProps.overhead
  );
});
