import { memo, useState } from 'react';
import './TabBar.css';

export interface Tab {
  id: string;
  label: string;
  type: 'chat' | 'file' | 'agent-terminal';
  closable: boolean;
  filePath?: string;
  color?: string; // Color indicator for chat tabs
  terminalId?: string; // Reference to terminal instance for agent-terminal tabs
  icon?: React.ReactNode; // Icon to display before label (e.g., terminal icon)
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder?: (tabs: Tab[]) => void;
}

function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onTabReorder }: TabBarProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const handleTabClick = (tab: Tab) => {
    onTabClick(tab.id);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  const handleDragStart = (e: React.DragEvent, tab: Tab) => {
    // Don't allow dragging the chat tab (terminals are draggable now!)
    if (tab.type === 'chat') {
      e.preventDefault();
      return;
    }

    setDraggedTabId(tab.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);

    // Add drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, tab: Tab) => {
    e.preventDefault();

    // Don't allow dropping on chat tab or same tab
    if (tab.type === 'chat' || tab.id === draggedTabId) {
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tab.id);
  };

  const handleDragLeave = () => {
    setDragOverTabId(null);
  };

  const handleDrop = (e: React.DragEvent, targetTab: Tab) => {
    e.preventDefault();

    if (!draggedTabId || targetTab.id === draggedTabId || targetTab.type === 'chat') {
      return;
    }

    // Reorder tabs
    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = tabs.findIndex(t => t.id === targetTab.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    // Notify parent of reorder
    if (onTabReorder) {
      onTabReorder(newTabs);
    }

    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTabId === tab.id}
          className={`tab-item ${activeTabId === tab.id ? 'active' : ''} ${
            draggedTabId === tab.id ? 'dragging' : ''
          } ${dragOverTabId === tab.id ? 'drag-over' : ''}`}
          onClick={() => handleTabClick(tab)}
          title={tab.filePath || tab.label}
          draggable={tab.type !== 'chat'}
          onDragStart={(e) => handleDragStart(e, tab)}
          onDragOver={(e) => handleDragOver(e, tab)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tab)}
          onDragEnd={handleDragEnd}
        >
          {tab.color && tab.type !== 'agent-terminal' && (
            <span
              className="tab-color-indicator"
              style={{ backgroundColor: tab.color }}
              aria-hidden="true"
            />
          )}
          {tab.icon && (
            <span className="tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
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
