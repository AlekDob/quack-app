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

function TokenUsageIndicator({
  inputTokens,
  outputTokens,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  maxTokens = 200000,
  onCompact,
  onClear,
}: TokenUsageIndicatorProps) {
  const [showModal, setShowModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

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

  // Calculate overhead using REAL cache data from SDK
  // Priority: cacheCreationTokens > cacheReadTokens > estimated
  const ESTIMATED_OVERHEAD = 26500; // Fallback: system (17.9k) + memory (5.9k) + mcpTools (2.7k)

  let overhead: number;
  if (cacheCreationTokens > 0) {
    // Best case: we have real cache creation data
    overhead = cacheCreationTokens;
  } else if (cacheReadTokens > 0) {
    // Second best: we have cache read data (from resumed session)
    overhead = cacheReadTokens;
  } else {
    // Fallback: no cache data yet, use estimates
    overhead = ESTIMATED_OVERHEAD;
  }

  // Total context = messages + overhead (from real cache or estimated)
  const messageTokens = inputTokens + outputTokens;
  const totalContextUsage = messageTokens + overhead;

  // Calculate usage percentage based on total context (not just messages)
  const usagePercentage = (totalContextUsage / maxTokens) * 100;

  // INVERTED: Stamina starts at 100% and decreases as tokens are used
  const staminaPercentage = Math.max(0, 100 - usagePercentage);

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
          maxTokens={maxTokens}
          percentage={usagePercentage}
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
  // Only re-render if token counts actually changed
  return (
    prevProps.inputTokens === nextProps.inputTokens &&
    prevProps.outputTokens === nextProps.outputTokens &&
    prevProps.cacheCreationTokens === nextProps.cacheCreationTokens &&
    prevProps.cacheReadTokens === nextProps.cacheReadTokens
  );
});
