import React, { useState } from 'react';
import { Clock, BookOpen, Network, ChevronRight, ChevronDown, Globe, FolderOpen, ExternalLink, Map, FileText, User, Bot, BookMarked } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

type ScopeType = 'project' | 'global';

export interface GuidePage {
  name: string;
  path: string;
  title: string;
}

export interface GuideFeature {
  id: string;
  label: string;
  pages: number;
  pageList: GuidePage[];
}

interface BrainSidebarProps {
  activeView: string;
  onViewChange: (view: 'timeline' | 'knowledge' | 'graph' | 'guide') => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  counts: {
    decisions: number;
    bugs: number;
    patterns: number;
    gotchas: number;
  };
  guideFeatures: GuideFeature[];
  activeGuideFeature: string;
  onGuideFeatureChange: (featureId: string) => void;
  onSelectEntry: (filePath: string) => void;
  activeEntryPath: string | null;
  scope: ScopeType;
  onScopeChange: (scope: ScopeType) => void;
  projectName: string;
  brainPath: string;
  hasMap: boolean;
  onOpenMap: () => void;
  hasClaudeMd: boolean;
  onOpenClaudeMd: () => void;
}

function shortenPath(path: string): string {
  return path
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^[A-Z]:\\Users\\[^\\]+/, '~');
}

const categories = [
  { id: 'decisions', label: 'Decisions', type: 'decision' },
  { id: 'bugs', label: 'Bug Fix', type: 'bug_fix' },
  { id: 'patterns', label: 'Pattern', type: 'pattern' },
  { id: 'gotchas', label: 'Gotcha', type: 'gotcha' },
];

export default function BrainSidebar({
  activeView,
  onViewChange,
  activeCategory,
  onCategoryChange,
  counts,
  guideFeatures,
  activeGuideFeature,
  onGuideFeatureChange,
  onSelectEntry,
  activeEntryPath,
  scope,
  onScopeChange,
  projectName,
  brainPath,
  hasMap,
  onOpenMap,
  hasClaudeMd,
  onOpenClaudeMd,
}: BrainSidebarProps) {
  const [guideOpen, setGuideOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  const toggleFeature = (featureId: string) => {
    setExpandedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    onViewChange('knowledge');
  };

  const handleGuideClick = (featureId: string) => {
    onGuideFeatureChange(featureId);
    onViewChange('guide');
  };

  const displayTitle = scope === 'project' && projectName ? projectName : 'Quack Brain';

  return (
    <aside className="brain-sidebar" data-tauri-drag-region>
      <div className="brain-sidebar-title" data-tauri-drag-region>{displayTitle}</div>

      {brainPath && (
        <div className="brain-path-row">
          <span className="brain-path-text" title={brainPath}>
            {shortenPath(brainPath)}
          </span>
          <button
            className="brain-path-finder"
            onClick={() => invoke('reveal_in_finder', { path: brainPath })}
            title="Open in Finder"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      )}

      <div className="brain-scope-toggle">
        <button
          className={`brain-scope-btn ${scope === 'project' ? 'active' : ''}`}
          onClick={() => onScopeChange('project')}
          title={projectName || 'Project'}
        >
          <FolderOpen size={12} />
          <span>Project</span>
        </button>
        <button
          className={`brain-scope-btn ${scope === 'global' ? 'active' : ''}`}
          onClick={() => onScopeChange('global')}
          title="Global brain (~/.quack/brain/)"
        >
          <Globe size={12} />
          <span>Global</span>
        </button>
      </div>

      <div className="brain-sidebar-divider" />

      <div className="brain-sidebar-section">
        {(hasMap || hasClaudeMd) && (
          <div className="brain-nav-pinned">
            {hasMap && (
              <button
                className="brain-nav-item brain-nav-map"
                onClick={onOpenMap}
                title="Architecture map"
              >
                <Map size={16} />
                <span>Map</span>
              </button>
            )}
            {hasClaudeMd && (
              <button
                className="brain-nav-item brain-nav-map"
                onClick={onOpenClaudeMd}
                title="CLAUDE.md — Project instructions"
              >
                <FileText size={16} />
                <span>CLAUDE.md</span>
              </button>
            )}
          </div>
        )}

        <button
          className={`brain-nav-item ${activeView === 'timeline' ? 'active' : ''}`}
          onClick={() => onViewChange('timeline')}
        >
          <Clock size={18} />
          <span>Timeline</span>
        </button>

        {guideFeatures.length > 0 && (
          <div className="brain-nav-group">
            <button
              className="brain-nav-section-label"
              onClick={() => setGuideOpen(!guideOpen)}
            >
              <BookMarked size={14} />
              <span>Human Guides</span>
              <span className="brain-audience-badge brain-audience-human" title="For humans">
                <User size={10} />
              </span>
            </button>
            {guideOpen && guideFeatures.map(feat => {
              const isExpanded = expandedFeatures.has(feat.id);
              return (
                <div key={feat.id}>
                  <button
                    className={`brain-nav-subitem ${activeView === 'guide' && activeGuideFeature === feat.id ? 'active' : ''}`}
                    onClick={() => {
                      toggleFeature(feat.id);
                      handleGuideClick(feat.id);
                    }}
                  >
                    {isExpanded
                      ? <ChevronDown size={12} className="brain-chevron" />
                      : <ChevronRight size={12} className="brain-chevron" />}
                    <span>{feat.label}</span>
                    <span className="brain-count">{feat.pages}</span>
                  </button>
                  {isExpanded && feat.pageList.map(page => (
                    <button
                      key={page.path}
                      className={`brain-nav-page ${activeEntryPath === page.path ? 'active' : ''}`}
                      onClick={() => onSelectEntry(page.path)}
                      title={page.name}
                    >
                      <span>{page.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="brain-nav-group">
          <button
            className="brain-nav-section-label"
            onClick={() => setKnowledgeOpen(!knowledgeOpen)}
          >
            <BookOpen size={14} />
            <span>AI Knowledge</span>
            <span className="brain-audience-badge brain-audience-ai" title="For AI agents">
              <Bot size={10} />
            </span>
          </button>
          {knowledgeOpen && categories.map(cat => (
            <button
              key={cat.id}
              className={`brain-nav-subitem ${activeView === 'knowledge' && activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              <span>{cat.label}</span>
              <span className="brain-count">{counts[cat.id as keyof typeof counts]}</span>
            </button>
          ))}
        </div>

        <div className="brain-nav-group">
          <button
            className={`brain-nav-item ${activeView === 'graph' ? 'active' : ''}`}
            onClick={() => onViewChange('graph')}
          >
            <Network size={18} />
            <span>Graph</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
