/**
 * AgentRulesBanner Component
 *
 * Displays active rules for the current agent in a collapsible banner.
 * Automatically shown when rules are active - zero configuration required.
 */

import { useState } from 'react';
import type { AgentRuleInfo } from '../hooks/useAgentRules';
import './AgentRulesBanner.css';

interface AgentRulesBannerProps {
  /** Array of active rules with metadata */
  rules: AgentRuleInfo[];
  /** Optional: Compact mode shows just count, not full list */
  compact?: boolean;
  /** Optional: Callback when user wants to edit rules */
  onEditRules?: () => void;
}

export default function AgentRulesBanner({
  rules,
  compact = false,
  onEditRules,
}: AgentRulesBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no rules
  if (rules.length === 0) {
    return null;
  }

  // Compact mode: just show count badge
  if (compact) {
    return (
      <div className="agent-rules-badge" title={rules.map(r => r.name).join(', ')}>
        <svg className="rules-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="rules-count">{rules.length}</span>
      </div>
    );
  }

  // Full banner mode
  return (
    <div className={`agent-rules-banner ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="rules-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="rules-header-left">
          <svg className="rules-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="rules-title">
            Active Rules
            <span className="rules-count-badge">{rules.length}</span>
          </span>
        </div>
        <div className="rules-header-right">
          {!isExpanded && (
            <span className="rules-preview">
              {rules.length <= 2
                ? rules.map(r => r.name).join(', ')
                : `${rules[0].name}, ${rules[1].name} +${rules.length - 2}`}
            </span>
          )}
          <svg
            className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="rules-content">
          <ul className="rules-list">
            {rules.map((rule) => (
              <li key={rule.filePath} className="rule-item">
                <div className="rule-info">
                  <span className="rule-name">
                    {rule.name}
                    {rule.alwaysApply && (
                      <span className="always-badge">ALWAYS</span>
                    )}
                  </span>
                  {rule.description && (
                    <span className="rule-description">{rule.description}</span>
                  )}
                  <span className="rule-meta">
                    <span className={`rule-scope ${rule.scope}`}>
                      {rule.scope}
                    </span>
                    {rule.globs && rule.globs.length > 0 && (
                      <span className="rule-globs" title={rule.globs.join(', ')}>
                        {rule.globs.length} glob{rule.globs.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {onEditRules && (
            <button
              type="button"
              className="edit-rules-btn"
              onClick={onEditRules}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Rules
            </button>
          )}
        </div>
      )}
    </div>
  );
}
