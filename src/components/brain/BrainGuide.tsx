import React, { useState, useEffect } from 'react';
import { ChevronRight, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getProjectDocPath } from '../../services/brainFileService';

interface GuideFile {
  name: string;
  path: string;
  title: string;
}

interface BrainGuideProps {
  projectPath?: string;
  featureId: string;
  onSelectEntry: (filePath: string) => void;
}

function formatTitle(filename: string): string {
  return filename
    .replace('.md', '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function loadGuidePages(
  basePath: string,
  featureId: string
): Promise<GuideFile[]> {
  const guidePath = `${basePath}/guide/${featureId}`;
  try {
    const listing = await invoke<{
      entries: Array<{ name: string; path: string; is_dir: boolean }>;
    }>('list_directory', { path: guidePath });

    const pages: GuideFile[] = [];
    for (const entry of listing.entries) {
      if (entry.is_dir || !entry.name.endsWith('.md')) continue;

      let title = formatTitle(entry.name);
      try {
        const content = await invoke<string>(
          'read_file_content',
          { path: entry.path }
        );
        const heading = content.match(/^#\s+(.+)$/m);
        if (heading) title = heading[1];
      } catch { /* use filename-based title */ }

      pages.push({ name: entry.name, path: entry.path, title });
    }

    const order = ['overview', 'getting-started'];
    pages.sort((a, b) => {
      const aIdx = order.findIndex(o => a.name.includes(o));
      const bIdx = order.findIndex(o => b.name.includes(o));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    return pages;
  } catch {
    return [];
  }
}

export default function BrainGuide({
  projectPath,
  featureId,
  onSelectEntry,
}: BrainGuideProps) {
  const [pages, setPages] = useState<GuideFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectPath) return;
    setLoading(true);
    const basePath = getProjectDocPath(projectPath);
    loadGuidePages(basePath, featureId).then(p => {
      setPages(p);
      setLoading(false);
    });
  }, [projectPath, featureId]);

  const featureLabel = featureId.charAt(0).toUpperCase() + featureId.slice(1);

  if (loading) {
    return <div className="brain-loading">Loading guide...</div>;
  }

  if (pages.length === 0) {
    return (
      <div className="brain-empty-state">
        <User size={32} />
        <p>No guide pages found for {featureLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="brain-guide-header">
        <div>
          <h2>{featureLabel} Guide</h2>
          <span className="brain-guide-audience">
            <User size={12} />
            For humans
          </span>
        </div>
      </div>
      <div className="brain-guide-list">
        {pages.map((page, idx) => (
          <button
            key={page.path}
            className="brain-guide-page"
            onClick={() => onSelectEntry(page.path)}
          >
            <span className="brain-guide-page-num">{idx + 1}</span>
            <div className="brain-guide-page-info">
              <span className="brain-guide-page-title">{page.title}</span>
              <span className="brain-guide-page-file">{page.name}</span>
            </div>
            <ChevronRight size={14} className="brain-guide-page-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
