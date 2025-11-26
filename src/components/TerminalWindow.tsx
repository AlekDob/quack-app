import { useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { useTerminalStore } from '../stores/terminalStore';
import { useUIStore } from '../stores/uiStore';
import { TerminalSidebarPanel } from './TerminalSidebarPanel';
import { TerminalMain } from './terminal/TerminalMain';
import type { ProjectTerminal } from '../types';
import './TerminalWindow.css';

interface TerminalWindowProps {
  visible: boolean;
}

export function TerminalWindow({ visible }: TerminalWindowProps) {
  const projectTerminals = useTerminalStore(state => state.projectTerminals);
  const activeId = useTerminalStore(state => state.activeProjectTerminalId);
  const setActiveId = useTerminalStore(state => state.setActiveProjectTerminalId);
  const addProjectTerminal = useTerminalStore(state => state.addProjectTerminal);

  // Group terminals by project path
  const projectGroups = useMemo(() => {
    const groups = new Map<string, typeof projectTerminals>();

    projectTerminals.forEach(terminal => {
      const existing = groups.get(terminal.projectPath) || [];
      groups.set(terminal.projectPath, [...existing, terminal]);
    });

    return Array.from(groups.entries()).map(([path, terminals]) => ({
      projectPath: path,
      projectName: path.split('/').pop() || path,
      terminals: terminals.sort((a, b) => a.createdAt - b.createdAt),
    }));
  }, [projectTerminals]);

  // Auto-select first terminal if none selected
  useEffect(() => {
    if (!activeId && projectTerminals.length > 0) {
      setActiveId(projectTerminals[0].id);
    }
  }, [activeId, projectTerminals, setActiveId]);

  const closeWindow = useUIStore(state => state.closeWindow);

  const handleCreateTerminal = async () => {
    try {
      // Get current working directory using Tauri path API
      const cwd = await homeDir();

      const id = await invoke<string>('create_terminal', {
        label: `Terminal ${Date.now()}`,
        color: '#4dd4b3',
        cwd,
      });

      const newTerminal: ProjectTerminal = {
        id,
        name: `Terminal ${projectTerminals.length + 1}`,
        projectPath: cwd,
        color: '#4dd4b3',
        cwd,
        alive: true,
        status: 'idle',
        createdAt: Date.now(),
      };

      addProjectTerminal(newTerminal);
      setActiveId(id);
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  };

  if (!visible) {
    return null;
  }

  const handleClose = () => {
    closeWindow('showTerminalWindow');
  };

  return (
    <div className="terminal-window-overlay" onClick={handleClose}>
      <div className="terminal-window" onClick={(e) => e.stopPropagation()}>
        <div className="terminal-window-header" data-tauri-drag-region>
          <span className="terminal-window-title" data-tauri-drag-region>Terminals</span>
          <div className="terminal-window-header-actions">
            <button
              type="button"
              className="terminal-window-new-btn"
              onClick={handleCreateTerminal}
              title="New Terminal"
            >
              +
            </button>
            <button
              type="button"
              className="terminal-window-close-btn"
              onClick={handleClose}
              title="Close"
            >
              x
            </button>
          </div>
        </div>

        <div className="terminal-window-content">
          <TerminalSidebarPanel
            projectGroups={projectGroups}
            activeId={activeId}
            onSelect={setActiveId}
          />

          <div className="terminal-window-main">
            <TerminalMain
              terminals={projectTerminals}
              activeTerminalId={activeId}
              themeName="tokyo-night"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
