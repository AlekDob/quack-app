import React from 'react';
import type { BrainEntry } from '../../services/brainFileService';

interface BrainEntryCardProps {
  entry: BrainEntry;
  onClick?: () => void;
}

const typeColors: Record<string, string> = {
  bug_fix: '#ef4444',
  bug: '#ef4444',
  decision: '#3b82f6',
  pattern: '#22c55e',
  gotcha: '#eab308',
  preference: '#a855f7',
  diary: '#64748b',
};

const typeLabels: Record<string, string> = {
  bug_fix: 'Bug Fix',
  bug: 'Bug',
  decision: 'Decision',
  pattern: 'Pattern',
  gotcha: 'Gotcha',
  preference: 'Preference',
  diary: 'Diary',
};

export default function BrainEntryCard({ entry, onClick }: BrainEntryCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getPreview = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    return lines.slice(0, 2).join(' ').substring(0, 150);
  };

  const badgeColor = typeColors[entry.type] || '#64748b';
  const badgeLabel = typeLabels[entry.type] || entry.type;

  return (
    <div className="brain-entry-card" onClick={onClick}>
      <div className="brain-entry-card-header">
        <span className="brain-entry-badge" style={{ backgroundColor: badgeColor }}>
          {badgeLabel}
        </span>
        <span className="brain-entry-date">{formatDate(entry.created)}</span>
      </div>
      <h3 className="brain-entry-title">{entry.title}</h3>
      {entry.tags.length > 0 && (
        <div className="brain-entry-tags">
          {entry.tags.map(tag => (
            <span key={tag} className="brain-entry-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="brain-entry-preview">{getPreview(entry.content)}</p>
    </div>
  );
}
