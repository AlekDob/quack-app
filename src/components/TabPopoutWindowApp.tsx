import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import type { Tab } from './TabBar';
import './TabPopoutWindowApp.css';

// Lazy load components to match main app tab views
const CodeEditor = lazy(() => import('./CodeEditorCodeMirror'));
const DocsViewer = lazy(() => import('./docs/DocsViewer'));
const SkillViewer = lazy(() => import('./SkillViewer'));
const AgentViewer = lazy(() => import('./AgentViewer'));
const KanbanPopoutView = lazy(() => import('./kanban/KanbanPopoutView'));

// Loading spinner component
const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="tab-popout-loading-content">
    <div className="tab-popout-spinner" />
    <div className="tab-popout-loading-message">{message}</div>
  </div>
);

// Error display component
const ErrorDisplay: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="tab-popout-error">
    <div className="tab-popout-error-icon">!</div>
    <div className="tab-popout-error-message">{error}</div>
    {onRetry && (
      <button type="button" className="tab-popout-retry-btn" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

const TabPopoutWindowApp: React.FC = () => {
  const [tab, setTab] = useState<Tab | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // File content state
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');

  // Parse tab data from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabDataParam = params.get('tabData');

    if (tabDataParam) {
      try {
        const parsedTab = JSON.parse(decodeURIComponent(tabDataParam)) as Tab;
        setTab(parsedTab);
        console.log('[TabPopoutWindow] Parsed tab:', parsedTab.id, parsedTab.type);
      } catch (error) {
        console.error('[TabPopoutWindow] Failed to parse tab data:', error);
      }
    } else {
      console.error('[TabPopoutWindow] No tabData param found in URL');
    }
  }, []);

  // Load file content when tab is a file type
  const loadFileContent = useCallback(async (filePath: string) => {
    setFileLoading(true);
    setFileError(null);

    try {
      // Use correct Tauri command name: read_file_content
      const content = await invoke<string>('read_file_content', { path: filePath });
      setFileContent(content);
      setEditedContent(content);
      setHasUnsavedChanges(false);
      console.log('[TabPopoutWindow] File loaded successfully:', filePath);
    } catch (error) {
      console.error('[TabPopoutWindow] Failed to load file:', error);
      setFileError(`Failed to load file: ${error}`);
    } finally {
      setFileLoading(false);
    }
  }, []);

  // Load content when tab changes (supports both file and code-editor tabs)
  useEffect(() => {
    if (!tab) return;

    if (tab.type === 'file' && tab.filePath) {
      loadFileContent(tab.filePath);
    } else if (tab.type === 'code-editor' && tab.editorFilePath) {
      loadFileContent(tab.editorFilePath);
    }
  }, [tab, loadFileContent]);

  // Sanitize tab ID for event names (Tauri only allows alphanumeric, '-', '/', ':', '_')
  const sanitizeEventName = useCallback((id: string): string => {
    return id.replace(/[^a-zA-Z0-9\-/:_]/g, '_');
  }, []);

  // Listen for tab updates from main window
  useEffect(() => {
    if (!tab) return;

    const sanitizedId = sanitizeEventName(tab.id);

    const unlisten = listen<Tab>(`tab-popout-update/${sanitizedId}`, (event) => {
      setTab(event.payload);
    });

    const unlistenClose = listen(`tab-popout-close/${sanitizedId}`, async () => {
      const window = getCurrentWindow();
      await window.close();
    });

    // Notify main window that popout is ready
    emit('tab-popout-ready', { tabId: tab.id, sanitizedId });

    return () => {
      unlisten.then((fn) => fn());
      unlistenClose.then((fn) => fn());
    };
  }, [tab, sanitizeEventName]);

  // Handle titlebar drag to move window
  const handleTitlebarMouseDown = useCallback(async () => {
    setIsDragging(true);
    const window = getCurrentWindow();
    try {
      await window.startDragging();
    } catch (error) {
      console.error('Failed to start window dragging:', error);
    }
  }, []);

  const handleTitlebarMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle window close - save position and size
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (!tab) return;

      const window = getCurrentWindow();
      const position = await window.outerPosition();
      const size = await window.outerSize();

      await emit('tab-popout-closing', {
        tabId: tab.id,
        position: { x: position.x, y: position.y },
        size: { width: size.width, height: size.height },
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tab]);

  // Handle return to tab bar
  const handleReturnToTab = useCallback(async () => {
    if (!tab) return;

    console.log('[TabPopoutWindow] Returning tab to main window:', tab.id);

    // Emit event to main window to re-add the tab
    await emit('tab-popout-dragback', { tab });

    // Close this window
    const window = getCurrentWindow();
    await window.close();
  }, [tab]);

  // Window control handlers
  const handleMinimize = useCallback(async () => {
    const window = getCurrentWindow();
    await window.minimize();
  }, []);

  const handleClose = useCallback(async () => {
    const window = getCurrentWindow();
    await window.close();
  }, []);

  // File save handler
  const handleSaveFile = useCallback(async (content: string) => {
    const savePath = tab?.filePath || tab?.editorFilePath;
    if (!savePath) return;

    try {
      await invoke('write_file_content', { path: savePath, content });
      setFileContent(content);
      setHasUnsavedChanges(false);
      console.log('[TabPopoutWindow] File saved successfully');
    } catch (error) {
      console.error('[TabPopoutWindow] Failed to save file:', error);
    }
  }, [tab?.filePath, tab?.editorFilePath]);

  // Handle content change in editor
  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== fileContent);
  }, [fileContent]);

  // Get tab icon based on type
  const getTabIcon = useCallback((tabType: Tab['type']) => {
    switch (tabType) {
      case 'chat':
        return '💬';
      case 'file':
        return '📄';
      case 'agent-terminal':
        return '🦆';
      case 'agent':
        return '🤖';
      case 'browser':
        return '🌐';
      case 'skill':
        return '🔧';
      case 'command':
        return '⚡';
      case 'docs':
        return '📖';
      case 'memory-graph':
        return '🧠';
      case 'second-brain':
        return '🧠';
      case 'kanban':
        return null; // Kanban uses SVG icon, not emoji
      case 'code-editor':
        return '</>';
      default:
        return '📄';
    }
  }, []);

  // Render placeholder for unsupported types
  const renderPlaceholder = useCallback((icon: string, title: string, subtitle: string) => (
    <div className="tab-popout-placeholder">
      <div className="tab-popout-placeholder-icon">{icon}</div>
      <div className="tab-popout-placeholder-title">{title}</div>
      <div className="tab-popout-placeholder-subtitle">{subtitle}</div>
    </div>
  ), []);

  // Render tab content based on type
  const renderTabContent = useCallback(() => {
    if (!tab) return null;

    switch (tab.type) {
      case 'file':
        if (fileLoading) {
          return <LoadingSpinner message="Loading file..." />;
        }
        if (fileError) {
          return (
            <ErrorDisplay
              error={fileError}
              onRetry={tab.filePath ? () => loadFileContent(tab.filePath!) : undefined}
            />
          );
        }
        return (
          <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
            <CodeEditor
              content={editedContent || fileContent}
              filename={tab.filePath || null}
              readOnly={false}
              onChange={handleContentChange}
              onSave={handleSaveFile}
            />
          </Suspense>
        );

      case 'docs':
        return (
          <Suspense fallback={<LoadingSpinner message="Loading documentation..." />}>
            <DocsViewer initialPath={tab.docsPath} />
          </Suspense>
        );

      case 'memory-graph':
        return renderPlaceholder('Brain', 'Memory Graph', 'Open in Obsidian');

      case 'browser':
        return renderPlaceholder('🌐', 'Browser', tab.url || 'No URL');

      case 'skill':
        if (tab.skillName && tab.skillScope) {
          return (
            <Suspense fallback={<LoadingSpinner message="Loading skill..." />}>
              <SkillViewer
                skillName={tab.skillName}
                skillScope={tab.skillScope}
              />
            </Suspense>
          );
        }
        return renderPlaceholder('🔧', 'Skill', 'Missing skill information');

      case 'command':
        // Command tabs are no longer created - clicking a command uses handleUseCommand instead
        return renderPlaceholder('⚡', 'Command', 'This tab type is deprecated');

      case 'agent':
        if (tab.agentName && tab.agentScope) {
          return (
            <Suspense fallback={<LoadingSpinner message="Loading agent..." />}>
              <AgentViewer
                agentName={tab.agentName}
                agentScope={tab.agentScope}
              />
            </Suspense>
          );
        }
        return renderPlaceholder('🤖', 'Agent', 'Missing agent information');

      case 'agent-terminal':
        return renderPlaceholder('🦆', 'Agent Terminal', 'Terminal cannot be popped out separately');

      case 'chat':
        return renderPlaceholder('💬', 'Chat', 'Chat cannot be popped out');

      case 'kanban':
        return (
          <Suspense fallback={<LoadingSpinner message="Loading Kanban board..." />}>
            <KanbanPopoutView />
          </Suspense>
        );

      case 'code-editor':
        if (fileLoading) {
          return <LoadingSpinner message="Loading file..." />;
        }
        if (fileError) {
          return (
            <ErrorDisplay
              error={fileError}
              onRetry={tab.editorFilePath ? () => loadFileContent(tab.editorFilePath!) : undefined}
            />
          );
        }
        return (
          <Suspense fallback={<LoadingSpinner message="Loading editor..." />}>
            <CodeEditor
              content={editedContent || fileContent}
              filename={tab.editorFilePath || null}
              readOnly={false}
              onChange={handleContentChange}
              onSave={handleSaveFile}
            />
          </Suspense>
        );

      default:
        return renderPlaceholder('📄', 'Unknown Tab Type', tab.type);
    }
  }, [tab, fileLoading, fileError, editedContent, fileContent, handleContentChange, handleSaveFile, loadFileContent, renderPlaceholder]);

  if (!tab) {
    return (
      <div className="tab-popout-window tab-popout-loading">
        <div className="tab-popout-loading-text">Loading tab...</div>
      </div>
    );
  }

  return (
    <div className="tab-popout-window">
      {/* Custom Titlebar - Draggable (macOS traffic lights are native) */}
      {/* Hide titlebar for kanban - it has its own header with drag region */}
      {tab.type !== 'kanban' && (
        <div
          className={`tab-popout-titlebar ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleTitlebarMouseDown}
          onMouseUp={handleTitlebarMouseUp}
        >
          <div className="tab-popout-title">
            <span className="tab-popout-icon">{getTabIcon(tab.type)}</span>
            <span className="tab-popout-label">
              {tab.label}
              {hasUnsavedChanges && <span className="tab-popout-unsaved">*</span>}
            </span>
            {/* Show full file path for file tabs */}
            {tab.type === 'file' && tab.filePath && (
              <span className="tab-popout-filepath">{tab.filePath}</span>
            )}
          </div>
          {/* Return to tab button */}
          <button
            type="button"
            className="tab-popout-return-btn"
            onClick={handleReturnToTab}
            title="Return to tab bar"
            aria-label="Return to tab bar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3H10C11.1046 3 12 3.89543 12 5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M14 10L12 8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 3V12C3 12.5523 3.44772 13 4 13H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="tab-popout-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default TabPopoutWindowApp;
