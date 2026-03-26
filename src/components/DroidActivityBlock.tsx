/**
 * DroidActivityBlock — Wraps consecutive nested tool calls from the same droid
 * into a single visual block: avatar + name once, all tool events inside.
 * Collapsible with chevron, expanded by default.
 */

import { useState, Children } from 'react';
import { useAgentInfo } from '../hooks/useAgentInfo';

interface DroidActivityBlockProps {
  droidType: string;
  workingDirectory?: string;
  children: React.ReactNode;
}

export function DroidActivityBlock({ droidType, workingDirectory, children }: DroidActivityBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { avatarUrl } = useAgentInfo(droidType, workingDirectory);
  const displayName = droidType
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const toolCount = Children.count(children);

  return (
    <div className="droid-activity-block">
      <img src={avatarUrl} alt={droidType} className="droid-activity-avatar" />
      <div className="droid-activity-content">
        <button
          className="droid-activity-header"
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <span className="droid-activity-name">{displayName}</span>
          {!isExpanded && toolCount > 0 && (
            <span className="droid-activity-count">{toolCount} tools</span>
          )}
          <svg
            className={`droid-activity-chevron ${isExpanded ? 'expanded' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {isExpanded && children}
      </div>
    </div>
  );
}
