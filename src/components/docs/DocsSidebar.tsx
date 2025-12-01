import { useState } from 'react';
import type { DocsSection, DocsPage } from './DocsViewer';

// Map icon names to emoji (fallback for string-based icons)
const iconMap: Record<string, string> = {
  rocket: '🚀',
  star: '⭐',
  book: '📖',
  code: '💻',
  gear: '⚙️',
  lightbulb: '💡',
  target: '🎯',
  tools: '🛠️',
  zap: '⚡',
  folder: '📁',
  check: '✅',
  warning: '⚠️',
};

// Convert icon string to emoji (or return as-is if already emoji)
const getIconEmoji = (icon: string | undefined): string => {
  if (!icon) return '📄';
  // If it's already an emoji (starts with non-ASCII), return as-is
  if (icon.charCodeAt(0) > 127) return icon;
  // Otherwise look up in map
  return iconMap[icon.toLowerCase()] || '📄';
};

interface DocsSidebarProps {
  sections: DocsSection[];
  currentPage: DocsPage | null;
  onPageSelect: (pagePath: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function DocsSidebar({
  sections,
  currentPage,
  onPageSelect,
  collapsed,
  onToggleCollapse,
}: DocsSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map(s => s.slug))
  );

  const toggleSection = (sectionSlug: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionSlug)) {
      newExpanded.delete(sectionSlug);
    } else {
      newExpanded.add(sectionSlug);
    }
    setExpandedSections(newExpanded);
  };

  if (collapsed) {
    return (
      <div className="docs-sidebar collapsed">
        <button
          type="button"
          className="docs-sidebar-toggle"
          onClick={onToggleCollapse}
          title="Expand sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M7 4L13 10L7 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="docs-sidebar">
      <div className="docs-sidebar-header">
        <h2>Documentation</h2>
        <button
          type="button"
          className="docs-sidebar-toggle"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M13 4L7 10L13 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="docs-sidebar-nav">
        {sections.map((section) => (
          <div key={section.slug} className="docs-nav-section">
            <button
              type="button"
              className="docs-nav-section-header"
              onClick={() => toggleSection(section.slug)}
            >
              <span className="docs-nav-section-icon">{getIconEmoji(section.icon)}</span>
              <span className="docs-nav-section-title">{section.title}</span>
              <svg
                className={`docs-nav-section-arrow ${
                  expandedSections.has(section.slug) ? 'expanded' : ''
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {expandedSections.has(section.slug) && (
              <div className="docs-nav-pages">
                {section.pages.map((page) => {
                  const isActive = currentPage?.path === page.path;
                  return (
                    <button
                      key={page.path}
                      type="button"
                      className={`docs-nav-page ${isActive ? 'active' : ''}`}
                      onClick={() => onPageSelect(page.path)}
                    >
                      {page.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}
