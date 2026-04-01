/**
 * BrainContextBanner Component
 *
 * Shows Brain knowledge stats at the top of chat when a
 * new session starts. Collapsible, follows AgentRulesBanner pattern.
 */

import { useState } from 'react';
import { useBrainStats } from '../hooks/useBrainStats';
import './BrainContextBanner.css';

interface BrainContextBannerProps {
  basePath?: string;
  sessionId?: string;
  onOpenBrain?: () => void;
}

export default function BrainContextBanner({
  basePath,
  sessionId,
  onOpenBrain,
}: BrainContextBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { stats, isLoading } = useBrainStats(basePath, sessionId);

  if (dismissed || isLoading || !stats || stats.total === 0) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const hasDiaryToday = stats.lastDiary === today;

  return (
    <div className={`brain-context-banner ${isExpanded ? 'expanded' : ''}`}>
      <button
        type="button"
        className="brain-banner-header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="brain-banner-left">
          <svg
            className="brain-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
            <path d="M9 21h6" />
            <path d="M10 17v4" />
            <path d="M14 17v4" />
          </svg>
          <span className="brain-banner-title">
            Brain
            <span className="brain-count-badge">{stats.total}</span>
          </span>
        </div>
        <div className="brain-banner-right">
          {!isExpanded && (
            <span className="brain-preview">
              {stats.gotchas}G {stats.bugs}B {stats.patterns}P {stats.decisions}D
              {stats.staleCount > 0 && (
                <span className="brain-stale-badge">
                  {stats.staleCount} stale
                </span>
              )}
            </span>
          )}
          <svg
            className={`brain-chevron ${isExpanded ? 'rotated' : ''}`}
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
        <div className="brain-banner-content">
          <div className="brain-stats-grid">
            <div className="brain-stat">
              <span className="brain-stat-value brain-stat-gotcha">
                {stats.gotchas}
              </span>
              <span className="brain-stat-label">Gotcha</span>
            </div>
            <div className="brain-stat">
              <span className="brain-stat-value brain-stat-bug">
                {stats.bugs}
              </span>
              <span className="brain-stat-label">Bug</span>
            </div>
            <div className="brain-stat">
              <span className="brain-stat-value brain-stat-pattern">
                {stats.patterns}
              </span>
              <span className="brain-stat-label">Pattern</span>
            </div>
            <div className="brain-stat">
              <span className="brain-stat-value brain-stat-decision">
                {stats.decisions}
              </span>
              <span className="brain-stat-label">Decision</span>
            </div>
          </div>

          <div className="brain-meta-row">
            <span className="brain-meta-item">
              Ultimo diary: {stats.lastDiary || 'mai'}
              {!hasDiaryToday && stats.lastDiary && (
                <span className="brain-warn-dot" title="Nessun diary oggi" />
              )}
            </span>
            {stats.staleCount > 0 && (
              <span className="brain-meta-item brain-meta-warn">
                {stats.staleCount} entry non verificate da 7+ giorni
              </span>
            )}
          </div>

          <div className="brain-banner-actions">
            {onOpenBrain && (
              <button
                type="button"
                className="brain-open-btn"
                onClick={onOpenBrain}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Apri Brain
              </button>
            )}
            <button
              type="button"
              className="brain-dismiss-btn"
              onClick={() => setDismissed(true)}
            >
              Nascondi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
