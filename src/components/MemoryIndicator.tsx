/**
 * MemoryIndicator Component
 *
 * Badge/chip that displays when memories from the Second Brain
 * were injected into the AI context for a message.
 *
 * Features:
 * - Shows count of memories used
 * - Expandable to show memory details
 * - Colorful gradient background
 */

import React, { useState } from 'react';
import './MemoryIndicator.css';

export type MemoryScope = 'project' | 'global' | 'other';

export interface MemoryInfo {
  name: string;
  type: string;
  projectId?: string;
  observations: string[];
  /** Scope of the memory: 'project' (current project), 'global', or 'other' */
  scope?: MemoryScope;
}

export interface MemoryIndicatorProps {
  memories: MemoryInfo[];
  /** @deprecated Use `query` instead for AI-driven search */
  keywords?: string[];
  /** User-selected priority keywords (3x weight in search) */
  userKeywords?: string[];
  /** AI-driven search query (natural language) */
  query?: string;
  /** Search context explaining why this search was performed */
  searchContext?: string;
  durationMs?: number;
  /** Scope counts from the search result */
  scopeCounts?: {
    project: number;
    global: number;
  };
}

export const MemoryIndicator: React.FC<MemoryIndicatorProps> = ({
  memories,
  keywords = [],
  userKeywords = [],
  query,
  searchContext,
  durationMs,
  scopeCounts,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!memories || memories.length === 0) {
    return null;
  }

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  // Build scope summary for badge
  const hasScopeCounts = scopeCounts && (scopeCounts.project > 0 || scopeCounts.global > 0);
  const scopeSummary = hasScopeCounts
    ? `${scopeCounts.project} project, ${scopeCounts.global} global`
    : null;

  return (
    <div className="memory-indicator">
      <button
        className="memory-indicator-badge"
        onClick={toggleExpanded}
        title={`${memories.length} memories from Second Brain${scopeSummary ? ` (${scopeSummary})` : ''}`}
      >
        <span className="memory-indicator-icon">🧠</span>
        <span className="memory-indicator-count">{memories.length}</span>
        <span className="memory-indicator-label">
          {memories.length === 1 ? 'memory' : 'memories'}
        </span>
        {hasScopeCounts && (
          <span className="memory-indicator-scope-counts">
            {scopeCounts.project > 0 && (
              <span className="memory-indicator-scope-badge scope-project">
                {scopeCounts.project}P
              </span>
            )}
            {scopeCounts.global > 0 && (
              <span className="memory-indicator-scope-badge scope-global">
                {scopeCounts.global}G
              </span>
            )}
          </span>
        )}
        <span className={`memory-indicator-chevron ${isExpanded ? 'expanded' : ''}`}>
          ▾
        </span>
      </button>

      {isExpanded && (
        <div className="memory-indicator-details">
          {/* AI-driven query display (preferred) */}
          {query && (
            <div className="memory-indicator-query">
              <span className="memory-indicator-query-label">Search:</span>
              <span className="memory-indicator-query-text">"{query}"</span>
              {searchContext && (
                <span className="memory-indicator-query-context">({searchContext})</span>
              )}
            </div>
          )}

          {/* User-selected keywords (priority - 3x weight) */}
          {!query && userKeywords.length > 0 && (
            <div className="memory-indicator-keywords memory-indicator-user-keywords">
              <span className="memory-indicator-keywords-label">Priority:</span>
              {userKeywords.map((keyword, idx) => (
                <span key={idx} className="memory-indicator-keyword user-keyword">
                  <span className="keyword-star">★</span> {keyword}
                </span>
              ))}
            </div>
          )}

          {/* Auto-extracted keywords (fallback) - deduplicated for display */}
          {!query && keywords.length > 0 && (
            <div className="memory-indicator-keywords">
              <span className="memory-indicator-keywords-label">Auto:</span>
              {[...new Set(keywords)].map((keyword, idx) => (
                <span key={idx} className="memory-indicator-keyword auto-keyword">
                  <span className="keyword-dot">○</span> {keyword}
                </span>
              ))}
            </div>
          )}

          <div className="memory-indicator-list">
            {memories.map((memory, idx) => (
              <div key={idx} className="memory-indicator-item">
                <div className="memory-indicator-item-header">
                  <span className="memory-indicator-item-name">{memory.name}</span>
                  <div className="memory-indicator-item-badges">
                    {memory.scope && (
                      <span className={`memory-indicator-item-scope scope-${memory.scope}`}>
                        {memory.scope === 'project' ? 'Project' : 'Global'}
                      </span>
                    )}
                    <span className={`memory-indicator-item-type type-${memory.type}`}>
                      {memory.type}
                    </span>
                  </div>
                </div>
                {memory.observations.length > 0 && (
                  <ul className="memory-indicator-observations">
                    {memory.observations.slice(0, 2).map((obs, obsIdx) => (
                      <li key={obsIdx}>{obs}</li>
                    ))}
                    {memory.observations.length > 2 && (
                      <li className="memory-indicator-more">
                        +{memory.observations.length - 2} more...
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {durationMs !== undefined && (
            <div className="memory-indicator-duration">
              Search completed in {durationMs}ms
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoryIndicator;
