import React, { useState, useEffect, useCallback } from 'react';
import BrainSidebar from './BrainSidebar';
import BrainTimeline from './BrainTimeline';
import BrainKnowledge from './BrainKnowledge';
import BrainGraph from './BrainGraph';
import BrainEditor from './BrainEditor';
import { listBrainEntries, readBrainEntry } from '../../services/brainFileService';
import './brain.css';

interface BrainAppProps {
  projectPath?: string;
}

type ViewType = 'timeline' | 'knowledge' | 'graph';

export default function BrainApp({ projectPath }: BrainAppProps) {
  const [activeView, setActiveView] = useState<ViewType>('timeline');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [entryCounts, setEntryCounts] = useState({
    decisions: 0,
    bugs: 0,
    patterns: 0,
    gotchas: 0,
  });

  const loadCounts = useCallback(async () => {
    if (!projectPath) return;
    const counts = { decisions: 0, bugs: 0, patterns: 0, gotchas: 0 };
    const filePaths = await listBrainEntries({ projectRoot: projectPath });
    const entries = await Promise.all(
      filePaths.map(p => readBrainEntry(p))
    );
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.type === 'decision') counts.decisions++;
      if (entry.type === 'bug_fix' || entry.type === 'bug') counts.bugs++;
      if (entry.type === 'pattern' || entry.type === 'component') counts.patterns++;
      if (entry.type === 'gotcha') counts.gotchas++;
    }
    setEntryCounts(counts);
  }, [projectPath]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const handleSelectEntry = (filePath: string) => {
    setSelectedEntry(filePath);
  };

  const handleCloseEditor = () => {
    setSelectedEntry(null);
  };

  return (
    <div className="brain-app">
      <div className="brain-drag-bar" data-tauri-drag-region />
      <div className="brain-layout">
        <BrainSidebar
          activeView={activeView}
          onViewChange={(v) => { setSelectedEntry(null); setActiveView(v); }}
          activeCategory={activeCategory}
          onCategoryChange={(c) => { setSelectedEntry(null); setActiveCategory(c); }}
          counts={entryCounts}
        />
        <div className="brain-content">
          {selectedEntry ? (
            <BrainEditor filePath={selectedEntry} onClose={handleCloseEditor} />
          ) : (
            <>
              {activeView === 'timeline' && <BrainTimeline projectPath={projectPath} />}
              {activeView === 'knowledge' && (
                <BrainKnowledge
                  projectPath={projectPath}
                  category={activeCategory}
                  onSelectEntry={handleSelectEntry}
                />
              )}
              {activeView === 'graph' && (
                <BrainGraph projectPath={projectPath} onSelectEntry={handleSelectEntry} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
