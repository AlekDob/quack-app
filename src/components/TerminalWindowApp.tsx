import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import TerminalView from './TerminalView';
import type { TerminalInfo, ProjectTerminal } from '../types';
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
  const terminalMainRef = useRef<HTMLDivElement>(null);

  // Trigger XTerm.js resize which will sync with PTY
  const triggerResize = useCallback(() => {
    window.dispatchEvent(new Event('resize'));
  }, []);

  // Create new terminal for a project
  const handleCreateTerminal = useCallback(async (projectPath: string) => {
    try {
      const result = await invoke<TerminalInfo>('create_terminal', {
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

      // TerminalView's ResizeObserver will handle the resize automatically
      // Just trigger one resize after a short delay to ensure DOM is ready
      setTimeout(triggerResize, 100);

    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  }, [terminals.length, triggerResize]);

  // Wait for terminal to be fully ready before executing command
  // Uses a simple but effective approach: wait for container dimensions + multiple resize triggers
  const waitForTerminalReady = useCallback((timeout: number = 3000): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const waitAndResize = () => {
        // Timeout safety
        if (Date.now() - startTime > timeout) {
          console.log(`[TerminalWindowApp] Terminal ready timeout after ${timeout}ms`);
          resolve();
          return;
        }

        const container = terminalMainRef.current;
        if (!container) {
          setTimeout(waitAndResize, 100);
          return;
        }

        const rect = container.getBoundingClientRect();

        // Wait until container has valid dimensions
        if (rect.width > 100 && rect.height > 100) {
          console.log(`[TerminalWindowApp] Container ready: ${rect.width}x${rect.height}`);

          // Trigger a final resize event and wait for it to propagate
          triggerResize();

          // Give XTerm time to process the resize
          setTimeout(() => {
            triggerResize();
            setTimeout(resolve, 200);
          }, 300);
          return;
        }

        setTimeout(waitAndResize, 100);
      };

      // Start waiting after initial delay for DOM to settle
      setTimeout(waitAndResize, 300);
    });
  }, [triggerResize]);

  // Create terminal with initial command execution
  const handleCreateTerminalWithCommand = useCallback(async (initialCommand: InitialCommand) => {
    try {
      const result = await invoke<TerminalInfo>('create_terminal', {
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

  // Get terminal info for TerminalView
  const terminalInfos: TerminalInfo[] = terminals.map(t => ({
    id: t.id,
    label: t.name,
    color: t.color,
    cwd: t.cwd,
    alive: t.alive,
    status: t.status,
  }));

  // Force terminal resize after container has actual dimensions
  // This fixes XTerm rendering issues where dimensions aren't calculated correctly
  useEffect(() => {
    if (!activeTerminalId || !terminalMainRef.current) return;

    const container = terminalMainRef.current;
    let observer: ResizeObserver | null = null;
    let hasValidDimensions = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Check if container has valid dimensions
    const checkAndResize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (!hasValidDimensions) {
          hasValidDimensions = true;
          // Container now has dimensions - trigger resize
          window.dispatchEvent(new Event('resize'));
        }
      }
    };

    // Use ResizeObserver to detect when container gets real dimensions
    observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        checkAndResize();
      }
    });
    observer.observe(container);

    // Also check immediately and with delays as fallback
    checkAndResize();

    // Progressive delays to ensure DOM is fully settled
    [100, 250, 500, 1000].forEach(delay => {
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, delay);
      timers.push(timer);
    });

    return () => {
      observer?.disconnect();
      timers.forEach(t => clearTimeout(t));
    };
  }, [activeTerminalId]);

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
        <div className="terminal-main" ref={terminalMainRef}>
          {terminals.length === 0 ? (
            <div className="terminal-empty">
              <div className="terminal-empty-icon">&gt;_</div>
              <p>No terminals yet</p>
              <p className="terminal-empty-hint">
                Select a project and click + to create a terminal
              </p>
            </div>
          ) : (
            <TerminalView
              activeId={activeTerminalId}
              terminals={terminalInfos}
              onUserInput={() => {}}
              onOutput={() => {}}
              onUpdateRecentCommands={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
