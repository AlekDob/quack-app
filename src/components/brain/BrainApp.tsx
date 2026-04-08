import React, { useState, useEffect, useCallback } from 'react';
import BrainSidebar from './BrainSidebar';
import type { GuideFeature } from './BrainSidebar';
import BrainTimeline from './BrainTimeline';
import BrainKnowledge from './BrainKnowledge';
import BrainGraph from './BrainGraph';
import BrainGuide from './BrainGuide';
import BrainEditor from './BrainEditor';
import { invoke } from '@tauri-apps/api/core';
import { listBrainEntries, readBrainEntry, getProjectDocPath, getBrainRootPath } from '../../services/brainFileService';
import { normalizeToForwardSlash } from '../../utils/platform';
import './brain.css';

interface BrainAppProps {
  projectPath?: string;
}

type ViewType = 'timeline' | 'knowledge' | 'graph' | 'guide';
type ScopeType = 'project' | 'global';

export default function BrainApp({ projectPath: rawProjectPath }: BrainAppProps) {
  // Brain: gotcha-windows-path-separators — normalize on entry so all template literals use forward slashes
  const projectPath = rawProjectPath ? normalizeToForwardSlash(rawProjectPath) : rawProjectPath;
  const [activeView, setActiveView] = useState<ViewType>('timeline');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeType>('project');
  const [entryCounts, setEntryCounts] = useState({
    decisions: 0,
    bugs: 0,
    patterns: 0,
    gotchas: 0,
  });
  const [guideFeatures, setGuideFeatures] = useState<GuideFeature[]>([]);
  const [activeGuideFeature, setActiveGuideFeature] = useState<string>('');

  const isGlobal = scope === 'global';
  const projectName = projectPath?.split(/[\\/]/).pop() || '';
  const [brainPath, setBrainPath] = useState<string>('');
  const [mapPath, setMapPath] = useState<string | null>(null);
  const [claudeMdPath, setClaudeMdPath] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    const counts = { decisions: 0, bugs: 0, patterns: 0, gotchas: 0 };
    const filePaths = await listBrainEntries(
      isGlobal ? { global: true } : { projectRoot: projectPath }
    );
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
  }, [projectPath, isGlobal]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  useEffect(() => {
    const resolvePath = async () => {
      let resolvedPath = '';
      if (isGlobal) {
        resolvedPath = await getBrainRootPath();
      } else if (projectPath) {
        resolvedPath = getProjectDocPath(projectPath);
      }
      setBrainPath(resolvedPath);
      if (resolvedPath) {
        const mapFile = normalizeToForwardSlash(`${resolvedPath}/map.md`);
        const entry = await readBrainEntry(mapFile);
        setMapPath(entry ? mapFile : null);
      } else {
        setMapPath(null);
      }
      // Check for CLAUDE.md at project root (only in project scope)
      if (!isGlobal && projectPath) {
        const claudeFile = normalizeToForwardSlash(`${projectPath}/CLAUDE.md`);
        try {
          await invoke('read_file_content', { path: claudeFile });
          setClaudeMdPath(claudeFile);
        } catch {
          setClaudeMdPath(null);
        }
      } else {
        setClaudeMdPath(null);
      }
    };
    resolvePath();
  }, [isGlobal, projectPath]);

  useEffect(() => {
    if (isGlobal || !projectPath) {
      setGuideFeatures([]);
      return;
    }
    const loadGuides = async () => {
      const guidePath = normalizeToForwardSlash(`${getProjectDocPath(projectPath)}/guide`);
      try {
        const listing = await invoke<{
          entries: Array<{ name: string; path: string; is_dir: boolean }>;
        }>('list_directory', { path: guidePath });

        const features: GuideFeature[] = [];
        const order = ['overview', 'getting-started'];
        for (const entry of listing.entries) {
          if (!entry.is_dir) continue;
          try {
            const sub = await invoke<{
              entries: Array<{ name: string; path: string; is_dir: boolean }>;
            }>('list_directory', { path: entry.path });
            const mdFiles = sub.entries.filter(
              e => !e.is_dir && (e.name.endsWith('.md') || e.name.endsWith('.mmd'))
            );
            if (mdFiles.length === 0) continue;

            const pageList: Array<{ name: string; path: string; title: string }> = [];
            for (const f of mdFiles) {
              const ext = f.name.endsWith('.mmd') ? '.mmd' : '.md';
              let title = f.name.replace(ext, '').split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              if (ext === '.mmd') {
                title = `[Diagram] ${title}`;
              } else {
                try {
                  const content = await invoke<string>(
                    'read_file_content', { path: f.path }
                  );
                  const heading = content.match(/^#\s+(.+)$/m);
                  if (heading) title = heading[1];
                } catch { /* use filename title */ }
              }
              pageList.push({ name: f.name, path: f.path, title });
            }
            pageList.sort((a, b) => {
              const aIdx = order.findIndex(o => a.name.includes(o));
              const bIdx = order.findIndex(o => b.name.includes(o));
              if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
              if (aIdx !== -1) return -1;
              if (bIdx !== -1) return 1;
              return a.name.localeCompare(b.name);
            });

            features.push({
              id: entry.name,
              label: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
              pages: mdFiles.length,
              pageList,
            });
          } catch { /* empty folder */ }
        }
        features.sort((a, b) => a.label.localeCompare(b.label));
        setGuideFeatures(features);
      } catch {
        setGuideFeatures([]);
      }
    };
    loadGuides();
  }, [projectPath, isGlobal]);

  const handleSelectEntry = (filePath: string) => {
    setSelectedEntry(filePath);
  };

  const handleCloseEditor = () => {
    setSelectedEntry(null);
  };

  const handleScopeChange = (s: ScopeType) => {
    setSelectedEntry(null);
    setScope(s);
  };

  const scopeProps = isGlobal
    ? { projectPath: undefined, isGlobal: true as const }
    : { projectPath, isGlobal: false as const };

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
          guideFeatures={guideFeatures}
          activeGuideFeature={activeGuideFeature}
          onGuideFeatureChange={(f) => { setSelectedEntry(null); setActiveGuideFeature(f); }}
          onSelectEntry={handleSelectEntry}
          activeEntryPath={selectedEntry}
          scope={scope}
          onScopeChange={handleScopeChange}
          projectName={projectName}
          brainPath={brainPath}
          hasMap={!!mapPath}
          onOpenMap={() => { if (mapPath) setSelectedEntry(mapPath); }}
          hasClaudeMd={!!claudeMdPath}
          onOpenClaudeMd={() => { if (claudeMdPath) setSelectedEntry(claudeMdPath); }}
        />
        <div className="brain-content">
          {selectedEntry ? (
            <BrainEditor filePath={selectedEntry} onClose={handleCloseEditor} />
          ) : (
            <>
              {activeView === 'timeline' && (
                <BrainTimeline {...scopeProps} onSelectEntry={handleSelectEntry} />
              )}
              {activeView === 'knowledge' && (
                <BrainKnowledge
                  {...scopeProps}
                  category={activeCategory}
                  onSelectEntry={handleSelectEntry}
                />
              )}
              {activeView === 'guide' && (
                <BrainGuide
                  projectPath={projectPath}
                  featureId={activeGuideFeature}
                  onSelectEntry={handleSelectEntry}
                />
              )}
              {activeView === 'graph' && (
                <BrainGraph {...scopeProps} onSelectEntry={handleSelectEntry} guideFeatures={guideFeatures} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
