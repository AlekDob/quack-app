import { useEffect, useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TerminalMain } from './terminal/TerminalMain';
import type { ProjectTerminal } from '../types';
import type { ProjectInfo, InitialCommand } from '../hooks/useTerminalWindowManager';
import './TerminalWindowApp.css';

/**
 * TerminalWindowApp - Standalone window for managing project terminals
 * Receives projects list via URL params from main window
 */
export function TerminalWindowApp() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [terminals, setTerminals] = useState<ProjectTerminal[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Create new terminal for a project
  const handleCreateTerminal = useCallback(async (projectPath: string) => {
    try {
      const result = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
        label: `Terminal ${terminals.length + 1}`,
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

      setTerminals(prev => [...prev, newTerminal]);
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
  }, [terminals.length]);

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
      const result = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
        label: initialCommand.terminalLabel || `Terminal ${terminals.length + 1}`,
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

      setTerminals(prev => [...prev, newTerminal]);
      setActiveTerminalId(result.id);
      setSelectedProject(initialCommand.projectPath);

      // Expand project if collapsed
      setExpandedProjects(prev => {
        const next = new Set(prev);
        next.add(initialCommand.projectPath);
        return next;
      });

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

    } catch (error) {
      console.error('Failed to create terminal with command:', error);
    }
  }, [terminals.length, waitForTerminalReady]);

  // Close terminal
  const handleCloseTerminal = useCallback(async (terminalId: string) => {
    try {
      await invoke('close_terminal', { id: terminalId });
      setTerminals(prev => prev.filter(t => t.id !== terminalId));

      // Select another terminal if closing active one
      if (activeTerminalId === terminalId) {
        const remaining = terminals.filter(t => t.id !== terminalId);
        setActiveTerminalId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (error) {
      console.error('Failed to close terminal:', error);
    }
  }, [activeTerminalId, terminals]);

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

  // Group terminals by project
  const terminalsByProject = useMemo(() => {
    const groups = new Map<string, ProjectTerminal[]>();

    terminals.forEach(terminal => {
      const existing = groups.get(terminal.projectPath) || [];
      groups.set(terminal.projectPath, [...existing, terminal]);
    });

    return groups;
  }, [terminals]);

  // Parse projects from URL params on mount and handle initial command
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectsParam = params.get('projects');
    const initialCommandParam = params.get('initialCommand');

    if (projectsParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(projectsParam)) as ProjectInfo[];
        setProjects(parsed);
        // Expand all projects by default
        setExpandedProjects(new Set(parsed.map(p => p.path)));
        // Select first project
        if (parsed.length > 0) {
          setSelectedProject(parsed[0].path);
        }

        // Handle initial command if provided
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
      } catch (error) {
        console.error('Failed to parse projects:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - handleCreateTerminalWithCommand is stable

  // Listen for projects update from main window
  useEffect(() => {
    const unlistenPromise = listen<ProjectInfo[]>('terminal-window-projects-update', (event) => {
      setProjects(event.payload);
      setExpandedProjects(new Set(event.payload.map(p => p.path)));
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

  return (
    <div className="terminal-window-app">
      {/* Header with drag region */}
      <div className="terminal-window-header" data-tauri-drag-region>
        <span className="terminal-window-title" data-tauri-drag-region>Terminals</span>
      </div>

      <div className="terminal-window-body">
        {/* Sidebar with projects */}
        <div className="terminal-sidebar">
          <div className="terminal-sidebar-header">
            <span>PROJECTS</span>
          </div>

          <div className="terminal-sidebar-content">
            {projects.length === 0 ? (
              <div className="terminal-sidebar-empty">
                <p>No projects open</p>
              </div>
            ) : (
              projects.map(project => (
                <div key={project.path} className="project-group">
                  <div
                    className={`project-header ${selectedProject === project.path ? 'selected' : ''}`}
                    onClick={() => {
                      toggleProject(project.path);
                      setSelectedProject(project.path);
                    }}
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
                          onClick={() => setActiveTerminalId(terminal.id)}
                        >
                          <div
                            className="terminal-indicator"
                            style={{ backgroundColor: terminal.color }}
                          />
                          <span className="terminal-name">{terminal.name}</span>
                          <button
                            type="button"
                            className="terminal-close-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseTerminal(terminal.id);
                            }}
                            title="Close terminal"
                          >
                            x
                          </button>
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

        {/* Main terminal area */}
        <TerminalMain
          terminals={terminals}
          activeTerminalId={activeTerminalId}
          themeName="tokyo-night"
        />
      </div>
    </div>
  );
}
