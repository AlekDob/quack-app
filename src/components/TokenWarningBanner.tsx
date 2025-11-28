/**
 * TokenWarningBanner Component
 *
 * Shows progressive warnings when token usage is high.
 * Provides quick actions for /compact and clear conversation.
 */

import { useState, useEffect } from 'react';
import type { TokenBudgetStatus } from '../services/conversationRecovery';
import './TokenWarningBanner.css';

interface TokenWarningBannerProps {
  tokenStatus: TokenBudgetStatus;
  onCompact?: () => void;
  onClear?: () => void;
  onExport?: () => void;
  onLocalReset?: () => void;
  onDismiss?: () => void;
  compactFailed?: boolean; // Show recovery options when compact fails
}

export default function TokenWarningBanner({
  tokenStatus,
  onCompact,
  onClear,
  onExport,
  onLocalReset,
  onDismiss,
  compactFailed = false,
}: TokenWarningBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when level changes significantly
  useEffect(() => {
    if (tokenStatus.level === 'blocked' || tokenStatus.level === 'critical') {
      setIsDismissed(false);
    }
  }, [tokenStatus.level]);

  // Don't show for ok/info levels unless compact failed
  if (!compactFailed && (tokenStatus.level === 'ok' || tokenStatus.level === 'info')) {
    return null;
  }

  // Don't show if dismissed (except for blocked/critical)
  if (isDismissed && tokenStatus.level !== 'blocked' && tokenStatus.level !== 'critical') {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Get banner style based on level
  const getBannerClass = () => {
    if (compactFailed) return 'token-warning-banner recovery';
    switch (tokenStatus.level) {
      case 'blocked': return 'token-warning-banner blocked';
      case 'critical': return 'token-warning-banner critical';
      case 'danger': return 'token-warning-banner danger';
      case 'warning': return 'token-warning-banner warning';
      default: return 'token-warning-banner info';
    }
  };

  // Get icon based on level
  const getIcon = () => {
    if (compactFailed) return '🔧';
    switch (tokenStatus.level) {
      case 'blocked': return '🚫';
      case 'critical': return '🚨';
      case 'danger': return '⚠️';
      case 'warning': return '📊';
      default: return 'ℹ️';
    }
  };

  // Render recovery mode (when compact fails)
  if (compactFailed) {
    return (
      <div className={getBannerClass()}>
        <div className="token-warning-content">
          <span className="token-warning-icon">{getIcon()}</span>
          <div className="token-warning-text">
            <strong>Compact Failed - Recovery Options</strong>
            <p>The conversation is too long to compact. Choose a recovery option:</p>
          </div>
        </div>
        <div className="token-warning-actions">
          {onExport && (
            <button
              className="token-action-btn export"
              onClick={onExport}
              title="Save conversation to file before clearing"
            >
              Export
            </button>
          )}
          {onLocalReset && (
            <button
              className="token-action-btn local-reset"
              onClick={onLocalReset}
              title="Keep recent messages, summarize old ones locally"
            >
              Soft Reset
            </button>
          )}
          {onClear && (
            <button
              className="token-action-btn clear"
              onClick={onClear}
              title="Clear entire conversation and start fresh"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render blocked state
  if (tokenStatus.level === 'blocked') {
    return (
      <div className={getBannerClass()}>
        <div className="token-warning-content">
          <span className="token-warning-icon">{getIcon()}</span>
          <div className="token-warning-text">
            <strong>Token Limit Exceeded</strong>
            <p>{tokenStatus.message}</p>
            <span className="token-usage-detail">
              {tokenStatus.percentage.toFixed(0)}% used ({(tokenStatus.usedTokens / 1000).toFixed(1)}k / {(tokenStatus.maxTokens / 1000).toFixed(0)}k tokens)
            </span>
          </div>
        </div>
        <div className="token-warning-actions">
          {onExport && (
            <button className="token-action-btn export" onClick={onExport}>
              Export First
            </button>
          )}
          {onClear && (
            <button className="token-action-btn clear primary" onClick={onClear}>
              Clear Conversation
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render warning states
  return (
    <div className={getBannerClass()}>
      <div className="token-warning-content">
        <span className="token-warning-icon">{getIcon()}</span>
        <div className="token-warning-text">
          <strong>
            {tokenStatus.level === 'critical' ? 'Critical Token Usage' :
             tokenStatus.level === 'danger' ? 'High Token Usage' :
             'Token Usage Notice'}
          </strong>
          <p>{tokenStatus.message}</p>
          <span className="token-usage-detail">
            {tokenStatus.percentage.toFixed(0)}% used ({(tokenStatus.usedTokens / 1000).toFixed(1)}k / {(tokenStatus.maxTokens / 1000).toFixed(0)}k tokens)
          </span>
        </div>
      </div>
      <div className="token-warning-actions">
        {tokenStatus.action === 'compact' && onCompact && (
          <button
            className={`token-action-btn compact ${tokenStatus.level === 'critical' ? 'primary' : ''}`}
            onClick={onCompact}
          >
            /compact
          </button>
        )}
        {tokenStatus.level !== 'warning' && onClear && (
          <button className="token-action-btn clear" onClick={onClear}>
            Clear
          </button>
        )}
        {tokenStatus.level === 'warning' && (
          <button className="token-action-btn dismiss" onClick={handleDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
