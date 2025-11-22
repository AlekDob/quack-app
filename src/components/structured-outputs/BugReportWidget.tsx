import { useState } from 'react';
import type { BugReportOutput, BugSeverity } from '../../types/structuredOutputs';
import './BugReportWidget.css';

interface BugReportWidgetProps {
  data: BugReportOutput;
  onFileClick?: (filePath: string, line?: number) => void;
}

const severityColors: Record<BugSeverity, string> = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#EAB308',
  low: '#10B981',
};

const severityIcons: Record<BugSeverity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

export default function BugReportWidget({ data, onFileClick }: BugReportWidgetProps) {
  const [expandedBugs, setExpandedBugs] = useState<Set<number>>(new Set());

  const toggleBug = (index: number) => {
    const newExpanded = new Set(expandedBugs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBugs(newExpanded);
  };

  const severityCount = {
    critical: data.bugs_found.filter(b => b.severity === 'critical').length,
    high: data.bugs_found.filter(b => b.severity === 'high').length,
    medium: data.bugs_found.filter(b => b.severity === 'medium').length,
    low: data.bugs_found.filter(b => b.severity === 'low').length,
  };

  return (
    <div className="bug-report-widget">
      {/* Header */}
      <div className="bug-report-header">
        <div className="bug-report-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <h3>Bug Analysis Report</h3>
        </div>
        <div className="bug-report-count">
          <span className="bug-count-total">{data.total_issues}</span>
          <span className="bug-count-label">issues found</span>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="bug-report-summary">
          <p>{data.summary}</p>
        </div>
      )}

      {/* Risk Score */}
      {data.risk_score !== undefined && (
        <div className="bug-report-risk">
          <div className="risk-label">Risk Score</div>
          <div className="risk-bar">
            <div
              className="risk-fill"
              style={{
                width: `${(data.risk_score / 10) * 100}%`,
                backgroundColor: data.risk_score >= 7 ? '#EF4444' : data.risk_score >= 4 ? '#F59E0B' : '#10B981'
              }}
            />
          </div>
          <div className="risk-score">{data.risk_score.toFixed(1)}/10</div>
        </div>
      )}

      {/* Severity Breakdown */}
      <div className="bug-severity-breakdown">
        {(Object.keys(severityCount) as BugSeverity[]).map((severity) => {
          const count = severityCount[severity];
          if (count === 0) return null;

          return (
            <div
              key={severity}
              className="severity-badge"
              style={{ borderColor: severityColors[severity] }}
            >
              <span className="severity-icon">{severityIcons[severity]}</span>
              <span className="severity-name">{severity}</span>
              <span className="severity-count" style={{ color: severityColors[severity] }}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bug List */}
      <div className="bug-list">
        {data.bugs_found.map((bug, index) => {
          const isExpanded = expandedBugs.has(index);
          const fileName = bug.file.split('/').pop() || bug.file;

          return (
            <div
              key={index}
              className={`bug-item ${isExpanded ? 'expanded' : ''}`}
              style={{ borderLeftColor: severityColors[bug.severity] }}
            >
              {/* Bug Header */}
              <div className="bug-item-header" onClick={() => toggleBug(index)}>
                <div className="bug-item-left">
                  <span className="bug-severity-icon">{severityIcons[bug.severity]}</span>
                  <div className="bug-item-info">
                    <div className="bug-description">{bug.description}</div>
                    <div className="bug-location">
                      <span className="bug-file">{fileName}</span>
                      {bug.line && (
                        <>
                          <span className="bug-separator">:</span>
                          <span className="bug-line">L{bug.line}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bug-item-right">
                  <span
                    className="bug-severity-label"
                    style={{
                      backgroundColor: `${severityColors[bug.severity]}20`,
                      color: severityColors[bug.severity]
                    }}
                  >
                    {bug.severity}
                  </span>
                  <svg
                    className={`bug-chevron ${isExpanded ? 'expanded' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Bug Details (Expanded) */}
              {isExpanded && (
                <div className="bug-item-details">
                  {bug.category && (
                    <div className="bug-detail-row">
                      <span className="bug-detail-label">Category:</span>
                      <span className="bug-detail-value">{bug.category}</span>
                    </div>
                  )}
                  {bug.impact && (
                    <div className="bug-detail-row">
                      <span className="bug-detail-label">Impact:</span>
                      <span className="bug-detail-value">{bug.impact}</span>
                    </div>
                  )}
                  {bug.suggested_fix && (
                    <div className="bug-suggested-fix">
                      <div className="bug-detail-label">Suggested Fix:</div>
                      <div className="bug-fix-content">{bug.suggested_fix}</div>
                    </div>
                  )}
                  <button
                    className="bug-open-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileClick?.(bug.file, bug.line);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Open File
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
