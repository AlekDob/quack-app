import { memo, useState } from 'react';
import type { SlashCommand } from '../hooks/useSlashCommands';
import './TabBar.css';

export interface Tab {
  id: string;
  label: string;
  type: 'chat' | 'file' | 'agent-terminal' | 'agent' | 'browser' | 'skill' | 'command' | 'docs';
  closable: boolean;
  filePath?: string;
  color?: string; // Color indicator for chat tabs
  terminalId?: string; // Reference to terminal instance for agent-terminal tabs
  icon?: React.ReactNode; // DEPRECATED: Icon is now rendered based on tab.type to avoid React serialization issues
  agentName?: string; // Agent name for agent tabs
  agentScope?: 'global' | 'project'; // Agent scope for agent tabs
  url?: string; // Current URL for browser tabs
  skillName?: string; // Skill name for skill tabs
  skillScope?: 'global' | 'project'; // Skill scope for skill tabs
  command?: SlashCommand; // Full command object for command tabs
  docsPath?: string; // Path to docs page for docs tabs
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
          {tab.color && tab.type !== 'agent-terminal' && tab.type !== 'agent' && (
            <span
              className="tab-color-indicator"
              style={{ backgroundColor: tab.color }}
              aria-hidden="true"
            />
          )}
          {tab.type === 'agent-terminal' && (
            <span className="tab-icon" aria-hidden="true">
              {/* Terminal icon - rendered here instead of from tab.icon to avoid React serialization issues */}
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9zM3.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9zM5.146 6.146a.5.5 0 0 1 .708 0L7 7.293l1.146-1.147a.5.5 0 0 1 .708.708L7.707 8l1.147 1.146a.5.5 0 0 1-.708.708L7 8.707l-1.146 1.147a.5.5 0 0 1-.708-.708L6.293 8 5.146 6.854a.5.5 0 0 1 0-.708z"/>
              </svg>
            </span>
          )}
          {tab.type === 'skill' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px' }}>
              ⚡
            </span>
          )}
          {tab.type === 'command' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px' }}>
              /
            </span>
          )}
          {tab.type === 'docs' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px' }}>
              📖
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
