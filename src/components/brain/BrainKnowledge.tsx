import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { listBrainEntries, readBrainEntry } from '../../services/brainFileService';
import type { BrainEntry } from '../../services/brainFileService';
import BrainEntryCard from './BrainEntryCard';

interface BrainKnowledgeProps {
  projectPath?: string;
  isGlobal?: boolean;
  category?: string;
  onSelectEntry: (filePath: string) => void;
}

const categoryLabels: Record<string, { label: string; type: string }> = {
  decisions: { label: 'Decisions', type: 'decision' },
  bugs: { label: 'Bug Fix', type: 'bug_fix' },
  patterns: { label: 'Pattern', type: 'pattern' },
  gotchas: { label: 'Gotcha', type: 'gotcha' },
};

export default function BrainKnowledge({
  projectPath,
  isGlobal,
  category,
  onSelectEntry,
}: BrainKnowledgeProps) {
  const [entries, setEntries] = useState<BrainEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, [projectPath, category, isGlobal]);

  const loadEntries = async () => {
    if (!isGlobal && !projectPath) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const typeFilter = category ? categoryLabels[category]?.type : undefined;
      const filePaths = await listBrainEntries(
        isGlobal
          ? { global: true, type: typeFilter }
          : { projectRoot: projectPath, type: typeFilter }
      );

      const entriesData = await Promise.all(
        filePaths.map(async path => {
          const entry = await readBrainEntry(path);
          return entry;
        })
      );

      const validEntries = entriesData.filter((e): e is BrainEntry => e !== null);
      // Sort by date descending (newest first)
      validEntries.sort((a, b) => {
        const dateA = a.created || '';
        const dateB = b.created || '';
        return dateB.localeCompare(dateA);
      });
      setEntries(validEntries);
    } catch (err) {
      console.error('Failed to load brain entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const categoryInfo = category ? categoryLabels[category] : null;
  const displayLabel = categoryInfo?.label || 'Knowledge';

  return (
    <div className="brain-knowledge">
      <div className="brain-knowledge-header">
        <div>
          <h2>{displayLabel}</h2>
          <span className="brain-knowledge-count">{entries.length} entries</span>
        </div>
        <button className="brain-btn-new" title="Create new entry">
          <Plus size={18} />
          New entry
        </button>
      </div>

      {loading ? (
        <div className="brain-loading">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="brain-empty-state">
          <p>No entries found</p>
        </div>
      ) : (
        <div className="brain-knowledge-grid">
          {entries.map(entry => (
            <BrainEntryCard
              key={entry.filePath}
              entry={entry}
              onClick={() => onSelectEntry(entry.filePath)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
