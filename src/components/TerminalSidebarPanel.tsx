import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../stores/terminalStore';
import { ProjectTerminalItem } from './ProjectTerminalItem';
import type { ProjectTerminal } from '../types';
import './TerminalSidebarPanel.css';

interface ProjectGroup {
  projectPath: string;
  projectName: string;
  terminals: ProjectTerminal[];
}

interface TerminalSidebarPanelProps {
  projectGroups: ProjectGroup[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function TerminalSidebarPanel({
  projectGroups,
  activeId,
  onSelect,
}: TerminalSidebarPanelProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projectGroups.map(g => g.projectPath))
  );
  const addProjectTerminal = useTerminalStore(state => state.addProjectTerminal);

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

  const handleCreateTerminal = async (projectPath: string) => {
    try {
      const id = await invoke<string>('create_terminal', {
        label: `Terminal ${Date.now()}`,
        color: '#4dd4b3',
        cwd: projectPath,
      });

      const newTerminal: ProjectTerminal = {
        id,
        name: `Terminal ${projectGroups.find(g => g.projectPath === projectPath)?.terminals.length || 0 + 1}`,
        projectPath,
        color: '#4dd4b3',
        cwd: projectPath,
        alive: true,
        status: 'idle',
        createdAt: Date.now(),
      };

      addProjectTerminal(newTerminal);
      onSelect(id);
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  };

  return (
    <div className="terminal-sidebar-panel">
      <div className="terminal-sidebar-header">
        <span>PROJECTS</span>
      </div>

      <div className="terminal-sidebar-projects">
        {projectGroups.length === 0 ? (
          <div className="terminal-sidebar-empty">
            <p>No terminals</p>
          </div>
        ) : (
          projectGroups.map(group => (
            <div key={group.projectPath} className="project-group">
              <div
                className="project-group-header"
                onClick={() => toggleProject(group.projectPath)}
              >
                <span className={`project-group-chevron ${expandedProjects.has(group.projectPath) ? 'expanded' : ''}`}>
                  ›
                </span>
                <span className="project-group-name">{group.projectName}</span>
                <button
                  type="button"
                  className="project-add-terminal"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateTerminal(group.projectPath);
                  }}
                  title="Add terminal"
                >
                  +
                </button>
              </div>

              {expandedProjects.has(group.projectPath) && (
                <div className="project-terminals">
                  {group.terminals.map(terminal => (
                    <ProjectTerminalItem
                      key={terminal.id}
                      terminal={terminal}
                      isActive={terminal.id === activeId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
