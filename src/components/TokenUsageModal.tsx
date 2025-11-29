import './TokenUsageModal.css';
import type { MaxPlanStats } from '../hooks/maxPlanTypes';
import { formatTimeRemaining, formatTime, getPlanDisplayName } from '../hooks/useMaxPlanTracking';

interface TokenUsageModalProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost?: number; // total_cost_usd from Claude SDK (authoritative)
  maxTokens: number;
  percentage: number;
  overhead?: number; // Dynamic overhead calculated from project files (default: 38000)
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

// Format cost in USD (e.g., 0.0234 -> "$0.0234")
const formatCostUsd = (cost: number): string => {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
};

// Breakdown calculation
// IMPORTANT: The SDK's cache_creation_input_tokens and cache_read_input_tokens
// include ALL tokens being cached (system + tools + memory + previous messages),
// NOT just the overhead. So we CANNOT use them as a proxy for overhead.
//
// The overhead is now calculated dynamically per-project based on:
// - CLAUDE.md files (global + project)
// - MCP servers installed (.mcp.json)
// - Base system overhead (system prompt + tools + memory)
interface ContextBreakdown {
  messages: number;        // Actual message tokens (input + output)
  overhead: number;        // Overhead (dynamic or default ~38k)
  autoCompact: number;     // Auto-compact cost reserve (45k)
}

// Default overhead estimate based on Claude CLI /context output (~38k tokens)
const DEFAULT_OVERHEAD = 38000;

// Auto-compact cost: estimated tokens used when auto-compact triggers at 45k free
const AUTO_COMPACT_COST = 45000;

/**
 * Calculate context breakdown
 *
 * Messages = inputTokens + outputTokens (accumulated from the session)
 * Overhead = dynamic (from project files) or default ~38k
 * Auto-Compact = reserve for auto-compact operation (45k)
 */
const calculateBreakdown = (
  inputTokens: number,
  outputTokens: number,
  overhead: number = DEFAULT_OVERHEAD
): ContextBreakdown => {
  // Messages = actual user input/output tokens from the session
  const messagesTokens = inputTokens + outputTokens;

  return {
    messages: messagesTokens,
    overhead,
    autoCompact: AUTO_COMPACT_COST,
  };
};

/**
 * Calculate total context usage including overhead and auto-compact reserve
 * This is what actually counts against the 200k limit
 */
const calculateTotalContextUsage = (
  inputTokens: number,
  outputTokens: number,
  overhead: number = DEFAULT_OVERHEAD
): number => {
  const breakdown = calculateBreakdown(inputTokens, outputTokens, overhead);
  return breakdown.messages + breakdown.overhead + breakdown.autoCompact;
};

export default function TokenUsageModal({
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
  totalCost = 0,
  maxTokens,
  percentage,
  overhead = DEFAULT_OVERHEAD,
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
  // Calculate context breakdown using dynamic overhead
  const breakdown = calculateBreakdown(inputTokens, outputTokens, overhead);

  // Total context usage = messages + overhead + auto-compact reserve
  const totalContextUsage = calculateTotalContextUsage(inputTokens, outputTokens, overhead);

  // Remaining tokens = max - total context usage (auto-compact already included)
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
                    <span className="context-breakdown-source" title="System + tools + CLAUDE.md + MCP servers">*</span>
                  </span>
                  <span className="context-breakdown-value">{formatTokensK(breakdown.overhead)}</span>
                </div>
                <div className="context-breakdown-row">
                  <span className="context-breakdown-label">
                    Auto-Compact
                    <span className="context-breakdown-source" title="Reserved tokens for auto-compact operation">**</span>
                  </span>
                  <span className="context-breakdown-value">{formatTokensK(breakdown.autoCompact)}</span>
                </div>
              </div>
              <div className="context-breakdown-note">
                * Overhead: system + tools + CLAUDE.md + MCP servers
                <br />
                ** Auto-Compact: reserved for conversation compaction
              </div>
            </div>
          </div>

          {/* Total/Free/Cost Summary */}
          <div className="context-summary">
            <div className="context-summary-row">
              <span className="context-summary-label">TOTAL</span>
              <span className="context-summary-value">{formatTokensK(totalContextUsage)}</span>
            </div>
            <div className="context-summary-row free">
              <span className="context-summary-label">FREE</span>
              <span className="context-summary-value">{formatTokensK(remainingTokens)}</span>
            </div>
            {totalCost > 0 && (
              <div className="context-summary-row cost">
                <span className="context-summary-label">COST</span>
                <span className="context-summary-value">{formatCostUsd(totalCost)}</span>
              </div>
            )}
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
