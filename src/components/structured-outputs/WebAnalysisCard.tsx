import { useState } from 'react';
import type { WebAnalysisOutput } from '../../types/structuredOutputs';
import './WebAnalysisCard.css';

interface WebAnalysisCardProps {
  data: WebAnalysisOutput;
  onLinkClick?: (url: string) => void;
}

export default function WebAnalysisCard({ data, onLinkClick }: WebAnalysisCardProps) {
  const [showAllKeyPoints, setShowAllKeyPoints] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);

  const visibleKeyPoints = showAllKeyPoints ? data.key_points : data.key_points.slice(0, 5);
  const visibleLinks = showAllLinks ? data.links : data.links.slice(0, 3);

  const hasMoreKeyPoints = data.key_points.length > 5;
  const hasMoreLinks = data.links.length > 3;

  return (
    <div className="web-analysis-card">
      {/* Header */}
      <div className="web-analysis-header">
        <div className="web-analysis-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <h3>{data.title}</h3>
        </div>
        {data.confidence_score !== undefined && (
          <div className="confidence-badge">
            <div className="confidence-bar-container">
              <div
                className="confidence-bar-fill"
                style={{
                  width: `${data.confidence_score * 100}%`,
                  backgroundColor: data.confidence_score >= 0.7 ? '#10B981' : data.confidence_score >= 0.4 ? '#EAB308' : '#EF4444'
                }}
              />
            </div>
            <span className="confidence-value">{Math.round(data.confidence_score * 100)}%</span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="web-analysis-summary">
        <div className="summary-label">Summary</div>
        <p>{data.summary}</p>
      </div>

      {/* Metadata */}
      {data.metadata && (
        <div className="web-analysis-metadata">
          {data.metadata.word_count && (
            <div className="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{data.metadata.word_count.toLocaleString()} words</span>
            </div>
          )}
          {data.metadata.reading_time_minutes && (
            <div className="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{data.metadata.reading_time_minutes} min read</span>
            </div>
          )}
          {data.metadata.last_updated && (
            <div className="metadata-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Updated {new Date(data.metadata.last_updated).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Key Points */}
      <div className="web-analysis-section">
        <div className="section-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <h4>Key Points</h4>
          <span className="section-count">{data.key_points.length}</span>
        </div>
        <ul className="key-points-list">
          {visibleKeyPoints.map((point, index) => (
            <li key={index} className="key-point-item">
              <span className="key-point-bullet">•</span>
              <span className="key-point-text">{point}</span>
            </li>
          ))}
        </ul>
        {hasMoreKeyPoints && (
          <button
            className="show-more-btn"
            onClick={() => setShowAllKeyPoints(!showAllKeyPoints)}
          >
            {showAllKeyPoints ? 'Show Less' : `Show ${data.key_points.length - 5} More`}
            <svg
              className={`chevron ${showAllKeyPoints ? 'rotated' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {/* Links */}
      {data.links.length > 0 && (
        <div className="web-analysis-section">
          <div className="section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <h4>Related Links</h4>
            <span className="section-count">{data.links.length}</span>
          </div>
          <div className="links-list">
            {visibleLinks.map((link, index) => (
              <div
                key={index}
                className="link-item"
                onClick={() => onLinkClick?.(link.url)}
              >
                <div className="link-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </div>
                <div className="link-content">
                  <div className="link-description">{link.description}</div>
                  <div className="link-url">{link.url}</div>
                </div>
              </div>
            ))}
          </div>
          {hasMoreLinks && (
            <button
              className="show-more-btn"
              onClick={() => setShowAllLinks(!showAllLinks)}
            >
              {showAllLinks ? 'Show Less' : `Show ${data.links.length - 3} More`}
              <svg
                className={`chevron ${showAllLinks ? 'rotated' : ''}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
