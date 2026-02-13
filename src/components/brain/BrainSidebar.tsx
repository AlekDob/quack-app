import React from 'react';
import { Clock, BookOpen, Network, ChevronRight } from 'lucide-react';

interface BrainSidebarProps {
  activeView: string;
  onViewChange: (view: 'timeline' | 'knowledge' | 'graph') => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  counts: {
    decisions: number;
    bugs: number;
    patterns: number;
    gotchas: number;
  };
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
}: BrainSidebarProps) {
  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    onViewChange('knowledge');
  };

  return (
    <aside className="brain-sidebar" data-tauri-drag-region>
      <div className="brain-sidebar-title" data-tauri-drag-region>Quack Brain</div>
      <div className="brain-sidebar-section">
        <button
          className={`brain-nav-item ${activeView === 'timeline' ? 'active' : ''}`}
          onClick={() => onViewChange('timeline')}
        >
          <Clock size={18} />
          <span>Timeline</span>
        </button>

        <div className="brain-nav-group">
          <div className="brain-nav-group-header">
            <BookOpen size={18} />
            <span>Knowledge</span>
          </div>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`brain-nav-subitem ${activeView === 'knowledge' && activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
            >
              <ChevronRight size={14} />
              <span>{cat.label}</span>
              <span className="brain-count">{counts[cat.id as keyof typeof counts]}</span>
            </button>
          ))}
        </div>

        <button
          className={`brain-nav-item ${activeView === 'graph' ? 'active' : ''}`}
          onClick={() => onViewChange('graph')}
        >
          <Network size={18} />
          <span>Graph</span>
        </button>
      </div>
    </aside>
  );
}
