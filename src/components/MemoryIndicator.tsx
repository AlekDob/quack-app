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

export interface MemoryInfo {
  name: string;
  type: string;
  projectId?: string;
  observations: string[];
}

export interface MemoryIndicatorProps {
  memories: MemoryInfo[];
  /** @deprecated Use `query` instead for AI-driven search */
  keywords?: string[];
  /** AI-driven search query (natural language) */
  query?: string;
  /** Search context explaining why this search was performed */
  searchContext?: string;
  durationMs?: number;
}

export const MemoryIndicator: React.FC<MemoryIndicatorProps> = ({
  memories,
  keywords = [],
  query,
  searchContext,
  durationMs,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!memories || memories.length === 0) {
    return null;
  }

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  return (
    <div className="memory-indicator">
      <button
        className="memory-indicator-badge"
        onClick={toggleExpanded}
        title={`${memories.length} memories from Second Brain`}
      >
        <span className="memory-indicator-icon">🧠</span>
        <span className="memory-indicator-count">{memories.length}</span>
        <span className="memory-indicator-label">
          {memories.length === 1 ? 'memory' : 'memories'}
        </span>
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

          {/* Fallback to legacy keywords if no query */}
          {!query && keywords.length > 0 && (
            <div className="memory-indicator-keywords">
              <span className="memory-indicator-keywords-label">Keywords:</span>
              {keywords.map((keyword, idx) => (
                <span key={idx} className="memory-indicator-keyword">
                  {keyword}
                </span>
              ))}
            </div>
          )}

          <div className="memory-indicator-list">
            {memories.map((memory, idx) => (
              <div key={idx} className="memory-indicator-item">
                <div className="memory-indicator-item-header">
                  <span className="memory-indicator-item-name">{memory.name}</span>
                  <span className={`memory-indicator-item-type type-${memory.type}`}>
                    {memory.type}
                  </span>
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
