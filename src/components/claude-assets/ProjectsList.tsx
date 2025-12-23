/**
 * ProjectsList - Left sidebar showing available projects
 * Supports drop targets for asset drag & drop
 */

import { useDroppable } from '@dnd-kit/core';
import type { ClaudeProject } from '../../types/claudeAssets';
import './ProjectsList.css';

interface ProjectsListProps {
  projects: ClaudeProject[];
  selectedProjectPath: string | null;
  dropTargetProject: string | null;
  isDragging: boolean;
  onSelectProject: (path: string) => void;
  onDropTargetChange: (path: string | null) => void;
}

// Project item with drop support
function ProjectItem({
  project,
  isSelected,
  isDropTarget,
  isDragging,
  onSelect,
  onDropTargetChange,
}: {
  project: ClaudeProject;
  isSelected: boolean;
  isDropTarget: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDropTargetChange: (isOver: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `project-${project.path}`,
    data: { projectPath: project.path },
  });

  // Update drop target when hovering
  if (isOver !== isDropTarget) {
    onDropTargetChange(isOver);
  }

  return (
    <div
      ref={setNodeRef}
      className={`project-item ${isSelected ? 'selected' : ''} ${isDropTarget ? 'drop-target' : ''} ${isDragging && !isSelected ? 'can-drop' : ''}`}
      onClick={onSelect}
    >
      <div className="project-info">
        <div className="project-name">{project.name}</div>
        <div className="project-branch">
          {project.branch && (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span>{project.branch}</span>
            </>
          )}
        </div>
      </div>
      <div className="project-stats">
        <span className="total-count">{project.assetCounts.total}</span>
      </div>

      {/* Drop indicator */}
      {isDropTarget && (
        <div className="drop-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Drop to copy here</span>
        </div>
      )}
    </div>
  );
}

export default function ProjectsList({
  projects,
  selectedProjectPath,
  dropTargetProject,
  isDragging,
  onSelectProject,
  onDropTargetChange,
}: ProjectsListProps) {
  return (
    <div className="projects-list">
      <div className="projects-header">
        <span className="projects-title">PROJECTS</span>
        <span className="projects-count">{projects.length}</span>
      </div>

      <div className="projects-items">
        {projects.length === 0 ? (
          <div className="projects-empty">
            <p>No projects loaded</p>
            <p className="hint">Projects will appear here based on your active agents</p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectItem
              key={project.path}
              project={project}
              isSelected={selectedProjectPath === project.path}
              isDropTarget={dropTargetProject === project.path}
              isDragging={isDragging}
              onSelect={() => onSelectProject(project.path)}
              onDropTargetChange={(isOver) => {
                if (isOver && project.path !== selectedProjectPath) {
                  onDropTargetChange(project.path);
                } else if (!isOver && dropTargetProject === project.path) {
                  onDropTargetChange(null);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
