import { memo } from 'react';
import './TabBar.css';

export interface Tab {
  id: string;
  label: string;
  type: 'chat' | 'file';
  closable: boolean;
  filePath?: string;
  color?: string; // Color indicator for chat tabs
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  const handleTabClick = (tab: Tab) => {
    onTabClick(tab.id);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTabId === tab.id}
          className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
          onClick={() => handleTabClick(tab)}
          title={tab.filePath || tab.label}
        >
          {tab.color && (
            <span
              className="tab-color-indicator"
              style={{ backgroundColor: tab.color }}
              aria-hidden="true"
            />
          )}
          <span className="tab-label">{tab.label}</span>
          {tab.closable && (
            <button
              type="button"
              className="tab-close"
              onClick={(e) => handleCloseClick(e, tab.id)}
              aria-label={`Close ${tab.label}`}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </button>
      ))}
    </div>
  );
}

export default memo(TabBar);
