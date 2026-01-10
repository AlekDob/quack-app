import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SlashCommand } from '../hooks/useSlashCommands';
import { canPopoutTab } from '../stores/popoutWindowStore';
import './TabBar.css';

export interface Tab {
  id: string;
  label: string;
  type: 'chat' | 'file' | 'agent-terminal' | 'agent' | 'browser' | 'skill' | 'command' | 'rule' | 'docs' | 'memory-graph' | 'second-brain' | 'claude-assets' | 'kanban' | 'task' | 'semantic-search' | 'project-dashboard';
  closable: boolean;
  filePath?: string;
  color?: string; // Color indicator for chat tabs
  terminalId?: string; // Reference to terminal instance for agent-terminal tabs
  icon?: React.ReactNode; // DEPRECATED: Icon is now rendered based on tab.type to avoid React serialization issues
  agentName?: string; // Agent name for agent tabs
  agentScope?: 'global' | 'project'; // Agent scope for agent tabs
  isNewAgent?: boolean; // Whether this is a new agent being created
  url?: string; // Current URL for browser tabs
  skillName?: string; // Skill name for skill tabs
  skillScope?: 'global' | 'project'; // Skill scope for skill tabs
  command?: SlashCommand; // Full command object for command tabs
  commandName?: string; // Command name for command viewer tabs
  commandScope?: 'global' | 'project'; // Command scope for command viewer tabs
  isNewCommand?: boolean; // Whether this is a new command being created
  ruleName?: string; // Rule name for rule viewer tabs
  ruleScope?: 'global' | 'project'; // Rule scope for rule viewer tabs
  isNewRule?: boolean; // Whether this is a new rule being created
  docsPath?: string; // Path to docs page for docs tabs
  initialNodeId?: string; // Initial node to zoom into for second-brain tabs
  taskId?: string; // Reference to Kanban task for task tabs
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tabId: string | null;
}

export interface PopoutPosition {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabReorder?: (tabs: Tab[]) => void;
  onTabPopout?: (tab: Tab, position: PopoutPosition) => void;
}

function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onTabReorder, onTabPopout }: TabBarProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tabId: null,
  });
  const [hasTriggeredPopout, setHasTriggeredPopout] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Threshold in pixels - how far outside the tab bar to trigger popout
  const POPOUT_THRESHOLD = 60;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // Handle right-click on tab
  const handleContextMenu = useCallback((e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();

    // Don't show context menu for non-closable tabs (like main chat)
    if (!tab.closable) {
      return;
    }

    // Calculate position, ensuring menu stays within viewport
    const menuWidth = 180; // Approximate menu width
    const menuHeight = 80; // Approximate menu height

    let x = e.clientX;
    let y = e.clientY;

    // Check right edge - if menu would go off screen, position it to the left of cursor
    if (x + menuWidth > window.innerWidth) {
      x = e.clientX - menuWidth;
    }

    // Check bottom edge - if menu would go off screen, position it above cursor
    if (y + menuHeight > window.innerHeight) {
      y = e.clientY - menuHeight;
    }

    // Ensure menu doesn't go off left or top edge
    x = Math.max(8, x);
    y = Math.max(8, y);

    setContextMenu({
      visible: true,
      x,
      y,
      tabId: tab.id,
    });
  }, []);

  // Close single tab (with agent-terminal protection)
  const handleCloseThisTab = useCallback(() => {
    if (!contextMenu.tabId) return;

    const tab = tabs.find((t) => t.id === contextMenu.tabId);

    // NEVER close agent-terminal tabs via context menu
    if (tab && tab.type !== 'agent-terminal' && tab.closable) {
      onTabClose(contextMenu.tabId);
    }

    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [contextMenu.tabId, tabs, onTabClose]);

  // Close all other tabs (with agent-terminal protection)
  const handleCloseOtherTabs = useCallback(() => {
    if (!contextMenu.tabId) return;

    // Close all closable tabs except:
    // 1. The selected tab (contextMenu.tabId)
    // 2. agent-terminal tabs (NEVER close these)
    // 3. Non-closable tabs (like main chat)
    tabs.forEach((tab) => {
      if (
        tab.id !== contextMenu.tabId &&
        tab.closable &&
        tab.type !== 'agent-terminal'
      ) {
        onTabClose(tab.id);
      }
    });

    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, [contextMenu.tabId, tabs, onTabClose]);

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

  // Check if cursor is outside tab bar bounds (for popout detection)
  const isOutsideTabBar = useCallback((clientX: number, clientY: number): boolean => {
    if (!tabBarRef.current) return false;

    const rect = tabBarRef.current.getBoundingClientRect();
    const isOutside = (
      clientY < rect.top - POPOUT_THRESHOLD ||
      clientY > rect.bottom + POPOUT_THRESHOLD ||
      clientX < rect.left - POPOUT_THRESHOLD ||
      clientX > rect.right + POPOUT_THRESHOLD
    );

    return isOutside;
  }, [POPOUT_THRESHOLD]);

  // Track popout state per tab to prevent duplicates
  const popoutTriggeredRef = useRef<Set<string>>(new Set());

  // Handle drag event to detect when tab is dragged outside
  const handleDrag = useCallback((e: React.DragEvent, tab: Tab) => {
    // Skip if no valid coordinates
    if (e.clientX === 0 && e.clientY === 0) return;
    if (!onTabPopout) return;

    // Skip if popout already triggered for this specific tab (using ref for immediate check)
    if (popoutTriggeredRef.current.has(tab.id)) return;

    // Check if outside bounds
    if (isOutsideTabBar(e.clientX, e.clientY)) {
      console.log('[TabBar] Tab dragged outside bounds:', tab.id);

      // Mark as triggered IMMEDIATELY using ref (synchronous)
      popoutTriggeredRef.current.add(tab.id);
      setHasTriggeredPopout(true);

      // Trigger popout with position
      onTabPopout(tab, {
        x: e.clientX,
        y: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      });
    }
  }, [isOutsideTabBar, onTabPopout]);

  const handleDragEnd = useCallback(() => {
    setDraggedTabId(null);
    setDragOverTabId(null);
    setHasTriggeredPopout(false);
    // Clear the ref for next drag operation
    popoutTriggeredRef.current.clear();
  }, []);

  return (
    <div className="tab-bar" role="tablist" ref={tabBarRef}>
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
          onContextMenu={(e) => handleContextMenu(e, tab)}
          title={tab.filePath || tab.label}
          draggable={tab.type !== 'chat'}
          onDragStart={(e) => handleDragStart(e, tab)}
          onDrag={(e) => handleDrag(e, tab)}
          onDragOver={(e) => handleDragOver(e, tab)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tab)}
          onDragEnd={handleDragEnd}
        >
          {tab.color && tab.type !== 'agent-terminal' && tab.type !== 'agent' && tab.type !== 'task' && (
            <span
              className="tab-color-indicator"
              style={{ backgroundColor: tab.color }}
              aria-hidden="true"
            />
          )}
          {tab.type === 'task' && (
            <span className="tab-icon" aria-hidden="true">
              {/* Task icon - clipboard with lines */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tab.color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="13" x2="15" y2="13" />
              </svg>
            </span>
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
          {tab.type === 'memory-graph' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px' }}>
              🧠
            </span>
          )}
          {tab.type === 'second-brain' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px', color: '#E84A7F' }}>
              🧠
            </span>
          )}
          {tab.type === 'semantic-search' && (
            <span className="tab-icon" aria-hidden="true" style={{ fontSize: '14px' }}>
              🔍
            </span>
          )}
          {tab.type === 'kanban' && (
            <span className="tab-icon" aria-hidden="true">
              {/* Kanban board icon */}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7V7h5v10zm6 0h-4v-6h4v6z"/>
              </svg>
            </span>
          )}
          {tab.type === 'project-dashboard' && (
            <span className="tab-icon" aria-hidden="true">
              {/* Project dashboard icon - house/home */}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </span>
          )}
          <span className="tab-label">{tab.label}</span>
          {/* Popout button - opens tab in separate window */}
          {/* Using span with role="button" to avoid button-inside-button HTML error */}
          {tab.closable && canPopoutTab(tab) && onTabPopout && (
            <span
              role="button"
              tabIndex={0}
              className="tab-popout-btn"
              onClick={(e) => {
                e.stopPropagation();
                console.log('[TabBar] Popout button clicked for tab:', tab.id, tab.type);
                // Use current mouse position for window placement
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const position = {
                  x: rect.left,
                  y: rect.bottom,
                  screenX: window.screenX + rect.left,
                  screenY: window.screenY + rect.bottom + 50,
                };
                console.log('[TabBar] Calling onTabPopout with position:', position);
                onTabPopout(tab, position);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  onTabPopout(tab, {
                    x: rect.left,
                    y: rect.bottom,
                    screenX: window.screenX + rect.left,
                    screenY: window.screenY + rect.bottom + 50,
                  });
                }
              }}
              aria-label={`Open ${tab.label} in new window`}
              title="Open in new window"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 2H14V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          )}
          {tab.closable && (
            <span
              role="button"
              tabIndex={0}
              className="tab-close"
              onClick={(e) => handleCloseClick(e, tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onTabClose(tab.id);
                }
              }}
              aria-label={`Close ${tab.label}`}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </button>
      ))}

      {/* Context Menu - rendered via Portal to avoid overflow issues */}
      {contextMenu.visible && createPortal(
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          {(() => {
            const selectedTab = tabs.find((t) => t.id === contextMenu.tabId);
            const isAgentTerminal = selectedTab?.type === 'agent-terminal';

            return (
              <>
                <button
                  type="button"
                  className={`tab-context-menu-item ${isAgentTerminal ? 'disabled' : ''}`}
                  onClick={handleCloseThisTab}
                  disabled={isAgentTerminal}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Close
                  {isAgentTerminal && <span className="tab-context-menu-hint">(Terminal protected)</span>}
                </button>
                <button
                  type="button"
                  className="tab-context-menu-item"
                  onClick={handleCloseOtherTabs}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                  Close Others
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(TabBar);
