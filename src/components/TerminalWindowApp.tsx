import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog, confirm } from '@tauri-apps/plugin-dialog';
import { createPortal } from 'react-dom';
import { TerminalMain, type TerminalMainHandle } from './terminal/TerminalMain';
import { useTerminalStore } from '../stores/terminalStore';
import { useSystemWakeHandler } from '../hooks/useSystemWakeHandler';
import { extractProjectId } from '../utils/projectUtils';
import type { ProjectTerminal, SavedCommand } from '../types';
import type { ProjectInfo, InitialCommand } from '../hooks/useTerminalWindowManager';
import SavedCommandsDrawer from './SavedCommandsDrawer';
import SavedCommandModal from './SavedCommandModal';
import './TerminalWindowApp.css';

const MAX_NAME_LENGTH = 50;
const CONTEXT_MENU_WIDTH = 150;
const CONTEXT_MENU_HEIGHT = 140;

const TERMINAL_COLORS = [
  '#4dd4b3', // Teal (default)
  '#ef4444', // Red
  '#f59e0b', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
];

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  terminalId: string | null;
  projectPath: string | null; // For project context menu
}

/**
 * TerminalWindowApp - Standalone window for managing project terminals
 * Projects come from main window (via URL params) + terminals in Zustand store
 */
export function TerminalWindowApp() {
  // System wake handler - prevents blank screen after macOS standby
  useSystemWakeHandler({ debug: true });

  // Projects passed from main window (agentChats)
  const [urlProjects, setUrlProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Use Zustand store for terminals AND manual projects persistence
  const {
    projectTerminals: terminals,
    activeProjectTerminalId: activeTerminalId,
    addProjectTerminal,
    removeProjectTerminal,
    updateProjectTerminal,
    setActiveProjectTerminalId: setActiveTerminalId,
    getProjectTerminalsByPath,
    // Manual projects (persisted)
    manualProjects,
    addManualProject,
    removeManualProject,
  } = useTerminalStore();

  // Context menu and editing state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    terminalId: null,
    projectPath: null,
  });
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Saved Commands state
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
  const [savedCommandsFilterProject, setSavedCommandsFilterProject] = useState<string | null>(null);
  const [savedCommandModalOpen, setSavedCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(null);

  // Action menu state
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [terminalBarVisible, setTerminalBarVisible] = useState(false);
  const terminalMainRef = useRef<TerminalMainHandle>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Create new terminal for a project
  const handleCreateTerminal = useCallback(async (projectPath: string) => {
    try {
      // Count existing terminals for this project
      const existingCount = getProjectTerminalsByPath(projectPath).length;

      const result = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
        label: `Terminal ${existingCount + 1}`,
        color: '#4dd4b3',
        cwd: projectPath,
      });

      const newTerminal: ProjectTerminal = {
        id: result.id,
        name: result.label,
        projectPath: projectPath,
        color: result.color,
        cwd: result.cwd,
        alive: result.alive,
        status: 'idle',
        createdAt: Date.now(),
      };

      // Add to Zustand store (persisted)
      addProjectTerminal(newTerminal);
      setActiveTerminalId(result.id);
      setSelectedProject(projectPath);

      // Expand project if collapsed
      setExpandedProjects(prev => {
        const next = new Set(prev);
        next.add(projectPath);
        return next;
      });

    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  }, [addProjectTerminal, setActiveTerminalId, getProjectTerminalsByPath]);

  // Wait for terminal to be fully ready before executing command
  const waitForTerminalReady = useCallback((timeout: number = 1000): Promise<void> => {
    return new Promise((resolve) => {
      // Simple timeout - new TerminalMain handles resize automatically
      setTimeout(resolve, timeout);
    });
  }, []);

  // Create terminal with initial command execution
  const handleCreateTerminalWithCommand = useCallback(async (initialCommand: InitialCommand) => {
    try {
      // Count existing terminals for this project
      const existingCount = getProjectTerminalsByPath(initialCommand.projectPath).length;

      const result = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
        label: initialCommand.terminalLabel || `Terminal ${existingCount + 1}`,
        color: '#4dd4b3',
        cwd: initialCommand.projectPath,
      });

      const newTerminal: ProjectTerminal = {
        id: result.id,
        name: result.label,
        projectPath: initialCommand.projectPath,
        color: result.color,
        cwd: result.cwd,
        alive: result.alive,
        status: 'idle',
        createdAt: Date.now(),
      };

      // Add to Zustand store (persisted)
      addProjectTerminal(newTerminal);
      setActiveTerminalId(result.id);
      setSelectedProject(initialCommand.projectPath);

      // Expand project if collapsed
      setExpandedProjects(prev => {
        const next = new Set(prev);
        next.add(initialCommand.projectPath);
        return next;
      });

      // Only execute command if it's not empty
      // (empty command is used to just create a terminal without running anything)
      if (initialCommand.command && initialCommand.command.trim() !== '') {
        // CRITICAL: Wait for terminal to be fully ready BEFORE executing command
        // This fixes the empty lines bug in Claude Code
        console.log(`[TerminalWindowApp] Waiting for terminal to be ready...`);
        await waitForTerminalReady();
        console.log(`[TerminalWindowApp] Terminal ready, executing command: ${initialCommand.command}`);

        // Execute command now that terminal is ready
        try {
          await invoke('write_to_terminal', {
            id: result.id,
            data: `${initialCommand.command}\n`,
          });
        } catch (error) {
          console.error('Failed to execute initial command:', error);
        }
      }

    } catch (error) {
      console.error('Failed to create terminal with command:', error);
    }
  }, [addProjectTerminal, setActiveTerminalId, getProjectTerminalsByPath, waitForTerminalReady]);

  // Close terminal
  const handleCloseTerminal = useCallback(async (terminalId: string) => {
    try {
      await invoke('close_terminal', { id: terminalId });

      // Remove from Zustand store (persisted)
      removeProjectTerminal(terminalId);

      // Select another terminal if closing active one
      if (activeTerminalId === terminalId) {
        const remaining = terminals.filter(t => t.id !== terminalId);
        setActiveTerminalId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (error) {
      console.error('Failed to close terminal:', error);
    }
  }, [activeTerminalId, terminals, removeProjectTerminal, setActiveTerminalId]);

  // Toggle project expansion
  const toggleProject = (projectPath: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  };

  // Update terminal name
  const updateTerminalName = useCallback((terminalId: string, newName: string) => {
    // Update in Zustand store (persisted)
    updateProjectTerminal(terminalId, { name: newName });
  }, [updateProjectTerminal]);

  // Update terminal color
  const updateTerminalColor = useCallback((terminalId: string, newColor: string) => {
    // Update in Zustand store (persisted)
    updateProjectTerminal(terminalId, { color: newColor });
  }, [updateProjectTerminal]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, terminalId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(Math.max(0, e.clientX), window.innerWidth - CONTEXT_MENU_WIDTH);
    const y = Math.min(Math.max(0, e.clientY), window.innerHeight - CONTEXT_MENU_HEIGHT);

    setContextMenu({ visible: true, x, y, terminalId, projectPath: null });
    setShowColorPicker(false);
  }, []);

  // Context menu for projects
  const handleProjectContextMenu = useCallback((e: React.MouseEvent, projectPath: string) => {
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(Math.max(0, e.clientX), window.innerWidth - CONTEXT_MENU_WIDTH);
    const y = Math.min(Math.max(0, e.clientY), window.innerHeight - CONTEXT_MENU_HEIGHT);

    setContextMenu({ visible: true, x, y, terminalId: null, projectPath });
    setShowColorPicker(false);
  }, []);

  // Close context menu - defined before handlers that use it
  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, terminalId: null, projectPath: null });
    setShowColorPicker(false);
  }, []);

  // Remove project (closes all terminals and removes from list)
  const handleRemoveProject = useCallback((projectPath: string) => {
    // Close all terminals for this project
    const projectTerminals = getProjectTerminalsByPath(projectPath);
    projectTerminals.forEach(terminal => {
      invoke('close_terminal', { id: terminal.id }).catch(console.error);
      removeProjectTerminal(terminal.id);
    });

    // Remove from manual projects if it's there
    removeManualProject(projectPath);

    // Also remove from URL projects (local state)
    setUrlProjects(prev => prev.filter(p => p.path !== projectPath));

    closeContextMenu();
  }, [getProjectTerminalsByPath, removeProjectTerminal, removeManualProject, closeContextMenu]);

  // Start editing terminal name
  const startEditing = useCallback((terminalId: string) => {
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      setEditName(terminal.name);
      setEditingTerminalId(terminalId);
      closeContextMenu();
    }
  }, [terminals, closeContextMenu]);

  // Save edited name
  const saveEditedName = useCallback(() => {
    if (!editingTerminalId) return;

    const trimmedName = editName.trim();
    if (trimmedName && trimmedName.length <= MAX_NAME_LENGTH) {
      updateTerminalName(editingTerminalId, trimmedName);
    }
    setEditingTerminalId(null);
    setEditName('');
  }, [editingTerminalId, editName, updateTerminalName]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingTerminalId(null);
    setEditName('');
  }, []);

  // Handle double click to rename
  const handleDoubleClick = useCallback((e: React.MouseEvent, terminalId: string) => {
    e.preventDefault();
    e.stopPropagation();
    startEditing(terminalId);
  }, [startEditing]);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    if (contextMenu.terminalId) {
      updateTerminalColor(contextMenu.terminalId, color);
      closeContextMenu();
    }
  }, [contextMenu.terminalId, updateTerminalColor, closeContextMenu]);

  // Handle key down in edit input
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditedName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  }, [saveEditedName, cancelEditing]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingTerminalId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTerminalId]);

  // Load saved commands on mount
  useEffect(() => {
    invoke<SavedCommand[]>('load_saved_commands')
      .then(setSavedCommands)
      .catch((err) => console.warn('Unable to load saved commands', err));
  }, []);

  const handleLaunchSavedCommand = useCallback(async (command: SavedCommand, immediate: boolean) => {
    // Determine which project to use
    const projectPath = command.cwd || command.projectPath || selectedProject;
    if (!projectPath) return;

    if (immediate) {
      // Launch in a new terminal
      try {
        const existingCount = getProjectTerminalsByPath(projectPath).length;
        const result = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
          label: command.name || `Terminal ${existingCount + 1}`,
          color: command.color || '#4dd4b3',
          cwd: projectPath,
        });
        const newTerminal: ProjectTerminal = {
          id: result.id,
          name: result.label,
          projectPath,
          color: result.color,
          cwd: result.cwd,
          alive: result.alive,
          status: 'idle',
          createdAt: Date.now(),
        };
        addProjectTerminal(newTerminal);
        setActiveTerminalId(result.id);
        // Send the command to the new terminal after a short delay for initialization
        setTimeout(() => {
          invoke('write_to_terminal', { id: result.id, data: command.command + '\n' }).catch(console.error);
        }, 300);
      } catch (err) {
        console.error('Failed to launch saved command', err);
      }
    } else {
      // Send to active terminal
      if (activeTerminalId) {
        invoke('write_to_terminal', { id: activeTerminalId, data: command.command + '\n' }).catch(console.error);
      }
    }
  }, [selectedProject, activeTerminalId, getProjectTerminalsByPath, addProjectTerminal, setActiveTerminalId]);

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenu.visible &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        closeContextMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [contextMenu.visible, closeContextMenu]);

  // Click outside to save edit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        editingTerminalId &&
        editInputRef.current &&
        !editInputRef.current.contains(e.target as Node)
      ) {
        saveEditedName();
      }
    };

    if (editingTerminalId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingTerminalId, saveEditedName]);

  // Close action menu on outside click or Escape
  useEffect(() => {
    if (!actionMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActionMenuOpen(false);
        e.stopPropagation();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [actionMenuOpen]);

  // Reset bar visibility when switching terminals
  useEffect(() => {
    setTerminalBarVisible(false);
  }, [activeTerminalId]);

  // Group terminals by project
  const terminalsByProject = useMemo(() => {
    const groups = new Map<string, ProjectTerminal[]>();

    terminals.forEach(terminal => {
      const existing = groups.get(terminal.projectPath) || [];
      groups.set(terminal.projectPath, [...existing, terminal]);
    });

    return groups;
  }, [terminals]);

  // Combine URL projects, manual projects (persisted), and projects that have terminals
  const allProjects = useMemo((): ProjectInfo[] => {
    const projectMap = new Map<string, ProjectInfo>();

    // First add projects from URL (main window's agentChats)
    urlProjects.forEach(project => {
      projectMap.set(project.path, project);
    });

    // Then add manual projects (persisted in Zustand store)
    manualProjects.forEach(project => {
      if (!projectMap.has(project.path)) {
        projectMap.set(project.path, project);
      }
    });

    // Then add projects that have terminals (in case they weren't in URL or manual)
    terminals.forEach(terminal => {
      if (!projectMap.has(terminal.projectPath)) {
        const projectName = extractProjectId(terminal.projectPath) || 'Unknown';
        projectMap.set(terminal.projectPath, {
          path: terminal.projectPath,
          name: projectName,
        });
      }
    });

    // Sort by project name for consistent ordering
    return Array.from(projectMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [urlProjects, manualProjects, terminals]);

  // Auto-expand projects when terminals are added or manual projects loaded
  useEffect(() => {
    const projectPaths = new Set([
      ...terminals.map(t => t.projectPath),
      ...manualProjects.map(p => p.path),
    ]);
    setExpandedProjects(prev => {
      const next = new Set(prev);
      projectPaths.forEach(path => next.add(path));
      return next;
    });
  }, [terminals, manualProjects]);

  // Verify and cleanup stale terminals on mount
  // Terminals persist in Zustand, but PTY sessions die when app restarts
  useEffect(() => {
    const verifyTerminals = async () => {
      for (const terminal of terminals) {
        try {
          // Try to check if PTY session is still alive
          const status = await invoke<{ alive: boolean }>('get_terminal_status', { id: terminal.id });
          if (!status.alive) {
            console.log(`[TerminalWindowApp] Terminal ${terminal.id} PTY is dead, removing...`);
            removeProjectTerminal(terminal.id);
          }
        } catch {
          // Terminal doesn't exist in backend, remove from store
          console.log(`[TerminalWindowApp] Terminal ${terminal.id} not found in backend, removing...`);
          removeProjectTerminal(terminal.id);
        }
      }
    };

    // Run verification after a short delay to let Rust backend initialize
    const timer = setTimeout(verifyTerminals, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Parse projects and initial command from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectsParam = params.get('projects');
    const initialCommandParam = params.get('initialCommand');

    if (projectsParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(projectsParam)) as ProjectInfo[];
        setUrlProjects(parsed);
        // Expand all projects by default
        setExpandedProjects(new Set(parsed.map(p => p.path)));
        // Select first project
        if (parsed.length > 0) {
          setSelectedProject(parsed[0].path);
        }
      } catch (error) {
        console.error('Failed to parse projects:', error);
      }
    }

    if (initialCommandParam) {
      try {
        const initialCommand = JSON.parse(decodeURIComponent(initialCommandParam)) as InitialCommand;
        // Execute command after a delay to ensure everything is initialized
        setTimeout(() => {
          handleCreateTerminalWithCommand(initialCommand);
        }, 100);
      } catch (error) {
        console.error('Failed to parse initial command:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Listen for projects update from main window (when activeProjects change)
  useEffect(() => {
    const unlistenPromise = listen<ProjectInfo[]>('terminal-window-projects-update', (event) => {
      // Only update if we received projects (don't clear the list with empty array)
      if (event.payload.length > 0) {
        setUrlProjects(event.payload);
        // Expand new projects
        setExpandedProjects(prev => {
          const next = new Set(prev);
          event.payload.forEach(p => next.add(p.path));
          return next;
        });
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  // Listen for execute command events (when window already exists)
  useEffect(() => {
    const unlistenPromise = listen<InitialCommand>('terminal-window-execute-command', (event) => {
      handleCreateTerminalWithCommand(event.payload);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [handleCreateTerminalWithCommand]);

  // Intercept window close and show confirmation dialog
  useEffect(() => {
    const currentWindow = getCurrentWindow();

    const unlistenPromise = currentWindow.onCloseRequested(async (event) => {
      // Only show confirmation if there are active terminals
      if (terminals.length > 0) {
        const confirmed = await confirm(
          'Are you sure you want to close? All terminal sessions will be terminated.',
          {
            title: 'Close Terminals',
            kind: 'warning',
          }
        );

        if (!confirmed) {
          // Prevent the window from closing
          event.preventDefault();
        }
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [terminals.length]);

  // Manually add a project folder (persisted in Zustand store)
  const handleAddProjectFolder = useCallback(async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });

      if (selected && typeof selected === 'string') {
        const projectName = extractProjectId(selected) || 'Unknown';

        // Add to Zustand store (persisted)
        addManualProject({ path: selected, name: projectName });

        // Expand the new project
        setExpandedProjects(prev => {
          const next = new Set(prev);
          next.add(selected);
          return next;
        });

        setSelectedProject(selected);
        console.log('[TerminalWindowApp] Added project folder (persisted):', selected);
      }
    } catch (error) {
      console.error('Failed to add project folder:', error);
    }
  }, [addManualProject]);

  return (
    <div className="terminal-window-app">
      {/* Header with drag region */}
      <div className="terminal-window-header" data-tauri-drag-region>
        <span className="terminal-window-title" data-tauri-drag-region>Terminals</span>
      </div>

      <div className="terminal-window-body">
        {/* Sidebar with projects */}
        <div className="terminal-sidebar">
          <div className="terminal-sidebar-header" data-tauri-drag-region>
            <span className="terminal-sidebar-title" data-tauri-drag-region>TERMINALS</span>
            <button
              type="button"
              className="terminal-add-project-btn"
              onClick={handleAddProjectFolder}
              title="Add project folder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>

          <div className="terminal-sidebar-content">
            {allProjects.length === 0 ? (
              <div className="terminal-sidebar-empty">
                <p>No projects yet</p>
                <p className="terminal-sidebar-hint">Create an agent in the main window to get started</p>
              </div>
            ) : (
              allProjects.map(project => (
                <div key={project.path} className="project-group">
                  <div
                    className={`project-header ${selectedProject === project.path ? 'selected' : ''}`}
                    onClick={() => {
                      toggleProject(project.path);
                      setSelectedProject(project.path);
                    }}
                    onContextMenu={(e) => handleProjectContextMenu(e, project.path)}
                  >
                    <span className={`project-chevron ${expandedProjects.has(project.path) ? 'expanded' : ''}`}>
                      &rsaquo;
                    </span>
                    <span className="project-name">{project.name}</span>
                    <button
                      type="button"
                      className="project-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTerminal(project.path);
                      }}
                      title="New terminal in this project"
                    >
                      +
                    </button>
                  </div>

                  {expandedProjects.has(project.path) && (
                    <div className="project-terminals">
                      {(terminalsByProject.get(project.path) || []).map(terminal => (
                        <div
                          key={terminal.id}
                          className={`terminal-item ${activeTerminalId === terminal.id ? 'active' : ''}`}
                          onClick={() => editingTerminalId !== terminal.id && setActiveTerminalId(terminal.id)}
                          onDoubleClick={(e) => handleDoubleClick(e, terminal.id)}
                          onContextMenu={(e) => handleContextMenu(e, terminal.id)}
                        >
                          <div
                            className="terminal-indicator"
                            style={{ backgroundColor: terminal.color }}
                          />
                          {editingTerminalId === terminal.id ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              className="terminal-name-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              maxLength={MAX_NAME_LENGTH}
                              aria-label="Terminal name"
                            />
                          ) : (
                            <span className="terminal-name">{terminal.name}</span>
                          )}
                          {editingTerminalId !== terminal.id && (
                            <>
                              <button
                                type="button"
                                className="terminal-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(terminal.id);
                                }}
                                title="Rename terminal"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="terminal-close-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseTerminal(terminal.id);
                                }}
                                title="Close terminal"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      {(terminalsByProject.get(project.path) || []).length === 0 && (
                        <div className="project-no-terminals">
                          Click + to add terminal
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main terminal area with floating action menu */}
        <div className="terminal-main-wrapper">
          <TerminalMain
            ref={terminalMainRef}
            terminals={terminals}
            activeTerminalId={activeTerminalId}
            themeName="tokyo-night"
            onBarVisibilityChange={setTerminalBarVisible}
          />

          {/* Floating action menu — hidden when search/filter bar is open */}
          {activeTerminalId && !terminalBarVisible && (
            <div className="terminal-action-menu" ref={actionMenuRef}>
              <button
                type="button"
                className="terminal-action-btn"
                onClick={() => setActionMenuOpen(prev => !prev)}
                title="Actions"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>

              {actionMenuOpen && (
                <div className="terminal-action-dropdown">
                  <button
                    type="button"
                    className="terminal-action-item"
                    onClick={() => { terminalMainRef.current?.find(); setActionMenuOpen(false); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Find</span>
                    <kbd>⌘F</kbd>
                  </button>
                  <button
                    type="button"
                    className="terminal-action-item"
                    onClick={() => { terminalMainRef.current?.filter(); setActionMenuOpen(false); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>Filter</span>
                    <kbd>⌘⇧F</kbd>
                  </button>
                  <button
                    type="button"
                    className="terminal-action-item"
                    onClick={() => { terminalMainRef.current?.clear(); setActionMenuOpen(false); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                    <span>Clear</span>
                    <kbd>⌘K</kbd>
                  </button>
                  <div className="terminal-action-divider" />
                  <button
                    type="button"
                    className="terminal-action-item"
                    onClick={() => {
                      const activeTerminal = terminals.find(t => t.id === activeTerminalId);
                      setSavedCommandsFilterProject(activeTerminal?.projectPath ?? null);
                      setSavedCommandsDrawerOpen(true);
                      setActionMenuOpen(false);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    <span>Commands</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved Commands Drawer + Modal */}
      <SavedCommandsDrawer
        open={savedCommandsDrawerOpen}
        commands={savedCommandsFilterProject
          ? savedCommands.filter(c => c.projectPath === savedCommandsFilterProject || !c.projectPath)
          : savedCommands}
        filterProject={savedCommandsFilterProject}
        onClearFilter={() => setSavedCommandsFilterProject(null)}
        onLaunch={(command, immediate) => handleLaunchSavedCommand(command, immediate)}
        onEdit={(command) => {
          setEditingCommand(command);
          setSavedCommandModalOpen(true);
        }}
        onCreate={() => {
          setEditingCommand(null);
          setSavedCommandModalOpen(true);
        }}
        onDelete={async (command) => {
          await invoke('delete_command', { id: command.id });
          setSavedCommands((prev) => prev.filter((item) => item.id !== command.id));
        }}
        onClose={() => setSavedCommandsDrawerOpen(false)}
      />

      <SavedCommandModal
        open={savedCommandModalOpen}
        command={editingCommand}
        defaultProjectPath={savedCommandsFilterProject}
        onClose={() => {
          setSavedCommandModalOpen(false);
          setEditingCommand(null);
        }}
        onSaved={(command) => {
          setSavedCommands((prev) => {
            const index = prev.findIndex((c) => c.id === command.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = command;
              return updated;
            }
            return [...prev, command];
          });
          setSavedCommandModalOpen(false);
          setEditingCommand(null);
        }}
      />

      {/* Context Menu - rendered via portal */}
      {createPortal(
        contextMenu.visible && (
          <div
            ref={contextMenuRef}
            className="terminal-context-menu"
            role="menu"
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 99999,
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Project context menu */}
            {contextMenu.projectPath && (
              <>
                <div
                  className="terminal-context-menu-item danger"
                  role="menuitem"
                  onClick={() => contextMenu.projectPath && handleRemoveProject(contextMenu.projectPath)}
                >
                  Remove Project
                </div>
              </>
            )}
            {/* Terminal context menu */}
            {contextMenu.terminalId && (
              <>
                <div
                  className="terminal-context-menu-item"
                  role="menuitem"
                  onClick={() => contextMenu.terminalId && startEditing(contextMenu.terminalId)}
                >
                  Rename
                </div>
                <div
                  className="terminal-context-menu-item"
                  role="menuitem"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  Change Color
                </div>
                {showColorPicker && (
                  <div className="terminal-color-picker">
                    {TERMINAL_COLORS.map((color) => {
                      const currentTerminal = terminals.find(t => t.id === contextMenu.terminalId);
                      return (
                        <button
                          key={color}
                          type="button"
                          className={`terminal-color-option ${color === currentTerminal?.color ? 'active' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorChange(color)}
                          title={color}
                          aria-label={`Select color ${color}`}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="terminal-context-menu-divider" />
                <div
                  className="terminal-context-menu-item danger"
                  role="menuitem"
                  onClick={() => {
                    if (contextMenu.terminalId) {
                      handleCloseTerminal(contextMenu.terminalId);
                    }
                    closeContextMenu();
                  }}
                >
                  Close Terminal
                </div>
              </>
            )}
          </div>
        ),
        document.body
      )}
    </div>
  );
}
