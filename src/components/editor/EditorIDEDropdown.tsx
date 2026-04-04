/**
 * EditorIDEDropdown
 *
 * Split button with dropdown to open current file in an IDE.
 * Shows only IDEs (no terminals), with preferred IDE as main action.
 *
 * @module EditorIDEDropdown
 */

// Brain: pattern-code-editor-tab
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useIDEStore, IDE_REGISTRY, type InstalledApp } from '../../stores/ideStore';
import { getFileManagerName } from '../../utils/platform';

interface EditorIDEDropdownProps {
  filePath: string;
}

function EditorIDEDropdown({ filePath }: EditorIDEDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const preferredIDE = useIDEStore(s => s.preferredIDE);
  const installedApps = useIDEStore(s => s.installedApps);
  const openFileInIDE = useIDEStore(s => s.openFileInIDE);
  const setPreferredIDE = useIDEStore(s => s.setPreferredIDE);

  // Memoize IDE-only list to avoid new array reference on every render
  const installedIDEApps = useMemo(
    () => installedApps.filter((a: InstalledApp) => a.category === 'ide'),
    [installedApps]
  );

  // Load apps once on first mount only
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const { installedApps: apps, loadInstalledApps } = useIDEStore.getState();
    if (apps.length === 0) {
      loadInstalledApps();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const fileManagerName = useMemo(() => getFileManagerName(), []);

  const handleRevealInFinder = useCallback(async () => {
    try {
      await invoke('reveal_in_finder', { path: filePath });
    } catch (error) {
      console.error('[EditorIDEDropdown] Failed to reveal file:', error);
    }
    setIsOpen(false);
  }, [filePath]);

  const handleOpenInIDE = useCallback(async (ideId?: string) => {
    const targetIDE = ideId || preferredIDE;
    if (!targetIDE) return;

    // If clicking a different IDE, set it as preferred
    if (ideId && ideId !== preferredIDE) {
      await setPreferredIDE(ideId);
    }

    try {
      await openFileInIDE(filePath);
    } catch (error) {
      console.error('[EditorIDEDropdown] Failed to open file:', error);
    }
    setIsOpen(false);
  }, [filePath, preferredIDE, openFileInIDE, setPreferredIDE]);

  // Get preferred IDE display name
  const preferredApp = installedIDEApps.find(a => a.id === preferredIDE);
  const preferredName = preferredApp?.name || IDE_REGISTRY[preferredIDE || '']?.name || 'IDE';
  const shortName = preferredName.length > 12 ? preferredName.slice(0, 10) + '…' : preferredName;

  // Sort IDEs: preferred first
  const sortedIDEs = [...installedIDEApps].sort((a, b) => {
    if (a.id === preferredIDE) return -1;
    if (b.id === preferredIDE) return 1;
    return 0;
  });

  if (!preferredIDE && installedIDEApps.length === 0) {
    return null; // No IDE available, don't render
  }

  return (
    <div className="editor-ide-dropdown" ref={containerRef}>
      {/* Main button — open in preferred IDE */}
      <button
        type="button"
        className="editor-btn editor-btn-ide"
        onClick={() => handleOpenInIDE()}
        disabled={!preferredIDE}
        title={`Apri in ${preferredName}`}
      >
        {shortName}
      </button>
      {/* Chevron — toggle dropdown */}
      {installedIDEApps.length > 0 && (
        <button
          type="button"
          className="editor-btn editor-btn-ide-chevron"
          onClick={() => setIsOpen(!isOpen)}
          title="Scegli IDE"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points={isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      )}
      {/* Dropdown menu */}
      {isOpen && (
        <div className="editor-ide-dropdown-menu">
          {sortedIDEs.map(app => (
            <button
              key={app.id}
              type="button"
              className={`editor-ide-dropdown-item ${app.id === preferredIDE ? 'active' : ''}`}
              onClick={() => handleOpenInIDE(app.id)}
            >
              {app.icon_base64 ? (
                <img src={`data:image/png;base64,${app.icon_base64}`} width={14} height={14} alt="" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M7 8l3 3-3 3" />
                </svg>
              )}
              <span>{app.name}</span>
              {app.id === preferredIDE && <span className="editor-ide-check">✓</span>}
            </button>
          ))}
          <div className="editor-ide-dropdown-separator" />
          <button
            type="button"
            className="editor-ide-dropdown-item"
            onClick={handleRevealInFinder}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Mostra in {fileManagerName}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default EditorIDEDropdown;
