import './TokenUsageModal.css';
import type { MaxPlanStats } from '../hooks/maxPlanTypes';
import { formatTimeRemaining, formatTime, getPlanDisplayName } from '../hooks/useMaxPlanTracking';

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
  onShowAnalytics?: () => void;
  // Max Plan tracking (optional)
  maxPlanStats?: MaxPlanStats;
  // Model name (optional)
  model?: string;
  // Recovery options (for when compact fails)
  onExport?: () => void;
  onLocalReset?: () => void;
  compactFailed?: boolean;
}

// Format tokens as K (e.g., 55500 -> "55.5k")
const formatTokensK = (tokens: number): string => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
};

// Breakdown calculation using REAL cache data from SDK
// cache_creation_input_tokens = overhead created at first message (system + MCP + memory)
// cache_read_input_tokens = overhead read from cache on subsequent messages
interface ContextBreakdown {
  messages: number;        // Actual message tokens (input + output - cached overhead)
  overhead: number;        // Real overhead from cache (system + MCP + memory)
  overheadSource: 'cache' | 'estimated';  // Whether overhead is from real cache data
}

// Estimated overhead costs (fallback when no cache data available)
// These are used only before the first message establishes the cache
const ESTIMATED_OVERHEAD = {
  system: 17900,   // System prompt, CLAUDE.md, instructions
  memory: 5900,    // Memory MCP context
  mcpTools: 2700,  // MCP tool definitions
  get total() { return this.system + this.memory + this.mcpTools; }
};

/**
 * Calculate context breakdown using real cache data from SDK
 *
 * The SDK reports:
 * - cache_creation_input_tokens: tokens used to CREATE cache (first message) - this IS the overhead
 * - cache_read_input_tokens: tokens READ from cache (subsequent messages) - confirms cached overhead
 *
 * Logic:
 * 1. If we have cacheCreationTokens > 0: overhead = cacheCreationTokens (real data!)
 * 2. If we have cacheReadTokens > 0 but no creation: overhead = cacheReadTokens (real data!)
 * 3. Fallback: use estimated overhead values
 */
const calculateBreakdown = (
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): ContextBreakdown => {
  // Determine real overhead from cache data
  // Priority: cacheCreationTokens > cacheReadTokens > estimated
  let overhead: number;
  let overheadSource: 'cache' | 'estimated';

  if (cacheCreationTokens > 0) {
    // Best case: we have real cache creation data
    overhead = cacheCreationTokens;
    overheadSource = 'cache';
  } else if (cacheReadTokens > 0) {
    // Second best: we have cache read data (from resumed session)
    overhead = cacheReadTokens;
    overheadSource = 'cache';
  } else {
    // Fallback: no cache data yet, use estimates
    overhead = ESTIMATED_OVERHEAD.total;
    overheadSource = 'estimated';
  }

  // Messages = actual user input/output tokens
  // Note: inputTokens from SDK already EXCLUDES cached overhead when cache is active
  const messagesTokens = inputTokens + outputTokens;

  return {
    messages: messagesTokens,
    overhead,
    overheadSource,
  };
};

/**
 * Calculate total context usage including overhead
 * This is what actually counts against the 200k limit
 */
const calculateTotalContextUsage = (
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number => {
  const breakdown = calculateBreakdown(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens);
  return breakdown.messages + breakdown.overhead;
};

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
  onShowAnalytics,
  maxPlanStats,
  model = 'Opus 4.5',
  onExport,
  onLocalReset,
  compactFailed = false,
}: TokenUsageModalProps) {
  // Calculate context breakdown using REAL cache data from SDK
  const breakdown = calculateBreakdown(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens);

  // Total context usage = messages + overhead (from real cache data or estimated)
  const totalContextUsage = calculateTotalContextUsage(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens);

  // Remaining tokens = max - total context usage
  const remainingTokens = Math.max(0, maxTokens - totalContextUsage);

  // INVERTED: Stamina percentage (100% = fresh, 0% = exhausted)
  const staminaPercentage = Math.max(0, 100 - percentage);

  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString();
  };

  const getSuggestion = () => {
    // Recovery mode: compact failed
    if (compactFailed) {
      return {
        title: '🔧 Recovery Mode',
        message: 'Compact failed because the conversation is too long. Use recovery options below.',
        action: 'recovery',
      };
    }
    if (percentage >= 100) {
      return {
        title: '🚫 Blocked: Token Limit Exceeded',
        message: 'Cannot send new messages. Export your conversation, then clear to continue.',
        action: 'blocked',
      };
    }
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
      <div className="token-modal fallout-style context-receipt" onClick={(e) => e.stopPropagation()}>
        <div className="token-modal-header fallout-header">
          <h3>CONTEXT RECEIPT</h3>
          <button className="token-modal-close" onClick={onClose}>X</button>
        </div>

        <div className="token-modal-content fallout-content">
          {/* Two-column layout: Duck + Breakdown */}
          <div className="context-receipt-main">
            {/* Left Column: Duck + Model + Progress */}
            <div className="context-receipt-left">
              {/* Duck Image */}
              <div className="fallout-duck-container">
                <img
                  src="/images/stamina.png"
                  alt="Duck Stamina"
                  className="fallout-duck-image"
                />
                <div className="fallout-duck-status-badge" style={{ backgroundColor: status.color }}>
                  {status.label}
                </div>
              </div>

              {/* Model Name */}
              <div className="context-model-name">
                <span className="context-model-label">MODEL</span>
                <span className="context-model-value">{model}</span>
              </div>

              {/* Context Used Progress */}
              <div className="context-usage-section">
                <div className="fallout-progress-bar-container">
                  <div className="fallout-progress-bar">
                    <div
                      className="fallout-progress-fill"
                      style={{
                        width: `${percentage}%`,
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
                <div className="context-usage-stats">
                  <span className="context-usage-percentage">{Math.round(percentage)}%</span>
                  <span className="context-usage-tokens">{formatTokensK(totalContextUsage)} / {formatTokensK(maxTokens)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Breakdown */}
            <div className="context-receipt-right">
              <div className="context-breakdown-title">BREAKDOWN</div>
              <div className="context-breakdown-list">
                <div className="context-breakdown-row">
                  <span className="context-breakdown-label">Messages</span>
                  <span className="context-breakdown-value">{formatTokensK(breakdown.messages)}</span>
                </div>
                <div className="context-breakdown-row">
                  <span className="context-breakdown-label">
                    Overhead
                    {breakdown.overheadSource === 'cache' && (
                      <span className="context-breakdown-source" title="Real data from SDK cache">*</span>
                    )}
                  </span>
                  <span className="context-breakdown-value">{formatTokensK(breakdown.overhead)}</span>
                </div>
                {/* Show cache stats if available */}
                {(cacheCreationTokens > 0 || cacheReadTokens > 0) && (
                  <div className="context-breakdown-cache">
                    {cacheCreationTokens > 0 && (
                      <div className="context-breakdown-row cache-row">
                        <span className="context-breakdown-label">Cache Created</span>
                        <span className="context-breakdown-value">{formatTokensK(cacheCreationTokens)}</span>
                      </div>
                    )}
                    {cacheReadTokens > 0 && (
                      <div className="context-breakdown-row cache-row">
                        <span className="context-breakdown-label">Cache Read</span>
                        <span className="context-breakdown-value">{formatTokensK(cacheReadTokens)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {breakdown.overheadSource === 'estimated' && (
                <div className="context-breakdown-note">
                  * Overhead estimated - send a message to get real data
                </div>
              )}
              {breakdown.overheadSource === 'cache' && (
                <div className="context-breakdown-note success">
                  * Overhead from real SDK cache data
                </div>
              )}
            </div>
          </div>

          {/* Total/Free Summary */}
          <div className="context-summary">
            <div className="context-summary-row">
              <span className="context-summary-label">TOTAL</span>
              <span className="context-summary-value">{formatTokensK(totalContextUsage)}</span>
            </div>
            <div className="context-summary-row free">
              <span className="context-summary-label">FREE</span>
              <span className="context-summary-value">{formatTokensK(remainingTokens)}</span>
            </div>
          </div>

          {/* Max Plan Status (if available) */}
          {maxPlanStats && (
            <div className="max-plan-status">
              <div className="max-plan-header">
                <span className="max-plan-icon">💎</span>
                <span className="max-plan-title">{getPlanDisplayName(maxPlanStats.planType).toUpperCase()} PLAN</span>
              </div>

              <div className="max-plan-breakdown">
                {/* Messages Used */}
                <div className="max-plan-item">
                  <span className="max-plan-label">Messages</span>
                  <span className="max-plan-value">
                    {maxPlanStats.messageCount}/{maxPlanStats.messageLimit}
                    <span className="max-plan-percentage"> ({Math.round(maxPlanStats.messagePercentage)}%)</span>
                  </span>
                </div>

                {/* Burn Rate */}
                {maxPlanStats.burnRatePerHour > 0 && (
                  <div className="max-plan-item">
                    <span className="max-plan-label">Burn Rate</span>
                    <span className="max-plan-value">{maxPlanStats.burnRatePerHour.toFixed(1)}/hr</span>
                  </div>
                )}

                {/* Est. Time Until Limit */}
                {maxPlanStats.estimatedTimeUntilLimit < Infinity && maxPlanStats.estimatedTimeUntilLimit > 0 && (
                  <div className="max-plan-item">
                    <span className="max-plan-label">Est. Duration</span>
                    <span className="max-plan-value">{formatTimeRemaining(maxPlanStats.estimatedTimeUntilLimit)}</span>
                  </div>
                )}

                <div className="max-plan-divider" />

                {/* Session Info */}
                <div className="max-plan-section-title">⏰ SESSION INFO</div>

                <div className="max-plan-item">
                  <span className="max-plan-label">Started</span>
                  <span className="max-plan-value">{formatTime(maxPlanStats.sessionStartTime)}</span>
                </div>

                <div className="max-plan-item">
                  <span className="max-plan-label">Window Ends</span>
                  <span className="max-plan-value">{formatTime(maxPlanStats.windowEndsAt)}</span>
                </div>

                <div className="max-plan-item">
                  <span className="max-plan-label">Time Remaining</span>
                  <span className="max-plan-value">{formatTimeRemaining(maxPlanStats.timeRemaining)}</span>
                </div>
              </div>

              {/* Warning if near limit */}
              {maxPlanStats.isCritical && (
                <div className="max-plan-warning critical">
                  <span className="max-plan-warning-icon">🚨</span>
                  <span className="max-plan-warning-text">
                    You've used {Math.round(maxPlanStats.messagePercentage)}% of your message limit.
                    Window resets at {formatTime(maxPlanStats.windowEndsAt)}.
                  </span>
                </div>
              )}
              {maxPlanStats.isNearLimit && !maxPlanStats.isCritical && (
                <div className="max-plan-warning warning">
                  <span className="max-plan-warning-icon">⚠️</span>
                  <span className="max-plan-warning-text">
                    Approaching message limit ({Math.round(maxPlanStats.messagePercentage)}%).
                    Consider compacting or waiting for window reset.
                  </span>
                </div>
              )}

              {/* View Analytics Button */}
              {onShowAnalytics && (
                <button
                  className="max-plan-analytics-btn"
                  onClick={() => {
                    onShowAnalytics();
                    onClose();
                  }}
                >
                  📊 View Analytics
                </button>
              )}
            </div>
          )}

          {/* Suggestion Card */}
          <div className={`token-suggestion ${status.level} ${compactFailed ? 'recovery' : ''}`}>
            <div className="token-suggestion-title">{suggestion.title}</div>
            <div className="token-suggestion-message">{suggestion.message}</div>
            {suggestion.action && (
              <div className="token-suggestion-actions">
                {/* Recovery mode actions */}
                {(suggestion.action === 'recovery' || suggestion.action === 'blocked') && (
                  <>
                    {onExport && (
                      <button className="token-action-btn export" onClick={() => {
                        onExport();
                      }}>
                        Export
                      </button>
                    )}
                    {onLocalReset && suggestion.action === 'recovery' && (
                      <button className="token-action-btn soft-reset" onClick={() => {
                        onLocalReset();
                        onClose();
                      }}>
                        Soft Reset
                      </button>
                    )}
                    {onClear && (
                      <button className="token-action-btn danger" onClick={() => {
                        onClear();
                        onClose();
                      }}>
                        Clear All
                      </button>
                    )}
                  </>
                )}
                {/* Standard actions */}
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
