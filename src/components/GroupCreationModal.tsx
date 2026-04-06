import { useState, useCallback, useEffect } from 'react';
import type { ProjectGroupMember } from '../types';
import { useGroupStore } from '../stores/groupStore';
import './GroupCreationModal.css';

const DEFAULT_PROJECT_COLORS = [
  '#FF6B35', // Orange (Quack primary) — fallback hex; accent uses var(--accent-color) at runtime
  '#4DA6FF', // Blue
  '#9B59B6', // Purple
  '#2ECC71', // Green
  '#E74C3C', // Red
  '#F39C12', // Yellow
  '#1ABC9C', // Teal
  '#E84393', // Pink
];

interface GroupCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjects: Array<{ path: string; name: string; color?: string }>;
}

export default function GroupCreationModal({
  isOpen,
  onClose,
  activeProjects,
}: GroupCreationModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Map<string, string>>(new Map());
  const [groupColor, setGroupColor] = useState<string>(DEFAULT_PROJECT_COLORS[0]);
  const [groupNotes, setGroupNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createGroup = useGroupStore((s) => s.createGroup);

  useEffect(() => {
    if (isOpen) {
      setGroupName('');
      setSelectedProjects(new Map());
      setGroupColor(DEFAULT_PROJECT_COLORS[0]);
      setGroupNotes('');
      setValidationError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const toggleProject = useCallback((projectPath: string) => {
    setSelectedProjects((prev) => {
      const next = new Map(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.set(projectPath, '');
      }
      if (next.size >= 2) setValidationError('');
      return next;
    });
  }, []);

  const updateRole = useCallback((projectPath: string, role: string) => {
    setSelectedProjects((prev) => {
      const next = new Map(prev);
      next.set(projectPath, role);
      return next;
    });
  }, []);

  const validateSelection = useCallback(() => {
    if (selectedProjects.size < 2) {
      setValidationError('Select at least 2 projects');
      return false;
    }
    return true;
  }, [selectedProjects]);

  const buildProjectMembers = useCallback(() => {
    return Array.from(selectedProjects.entries()).map(
      ([path, role]) => ({
        path,
        role: role.trim() || 'member',
      }),
    );
  }, [selectedProjects]);

  const handleSubmit = useCallback(async () => {
    if (!validateSelection() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const name = groupName.trim() || `Group ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const projects = buildProjectMembers();

      await createGroup(name, projects, groupColor, groupNotes.trim() || undefined);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateSelection, groupName, buildProjectMembers, groupColor, groupNotes, createGroup, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !e.shiftKey && selectedProjects.size >= 2 && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  }, [onClose, handleSubmit, selectedProjects, isSubmitting]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="group-creation-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="group-creation-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="group-creation-modal-header">
          <h2>Create Project Group</h2>
          <button className="group-creation-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="group-creation-modal-content">
          {/* Group Name */}
          <div className="group-creation-form-field">
            <label htmlFor="group-name">
              Group Name <span className="group-creation-optional">(optional)</span>
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Quack Ecosystem"
              autoFocus
            />
          </div>

          {/* Project Selection */}
          <div className="group-creation-form-field">
            <label>Select Projects (min 2)</label>
            <div className="group-creation-project-list">
              {activeProjects.map((project) => {
                const isSelected = selectedProjects.has(project.path);
                const role = selectedProjects.get(project.path) || '';

                return (
                  <div key={project.path} className="group-creation-project-item">
                    <div
                      className={`group-creation-project-checkbox ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleProject(project.path)}
                      style={{
                        borderColor: isSelected ? (project.color || DEFAULT_PROJECT_COLORS[0]) : 'rgba(255,255,255,0.2)',
                        backgroundColor: isSelected ? (project.color || DEFAULT_PROJECT_COLORS[0]) : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>

                    <div className="group-creation-project-info">
                      <div
                        className="group-creation-project-color"
                        style={{ backgroundColor: project.color || DEFAULT_PROJECT_COLORS[0] }}
                      />
                      <div className="group-creation-project-details">
                        <span className="group-creation-project-name">{project.name}</span>
                        <span className="group-creation-project-path">{project.path}</span>
                      </div>
                    </div>

                    {isSelected && (
                      <input
                        type="text"
                        className="group-creation-role-input"
                        value={role}
                        onChange={(e) => updateRole(project.path, e.target.value)}
                        placeholder="role"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {validationError && (
              <div className="group-creation-error">{validationError}</div>
            )}
          </div>

          {/* Color Picker */}
          <div className="group-creation-form-field">
            <label>Group Color</label>
            <div className="group-creation-color-picker">
              {DEFAULT_PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  className={`group-creation-color-option ${groupColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setGroupColor(color)}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="group-creation-form-field">
            <label htmlFor="group-notes">
              Cross-Project Notes <span className="group-creation-optional">(optional)</span>
            </label>
            <textarea
              id="group-notes"
              value={groupNotes}
              onChange={(e) => setGroupNotes(e.target.value)}
              placeholder="Integration points, shared dependencies, etc."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="group-creation-modal-footer">
          <button className="group-creation-button secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="group-creation-button primary"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedProjects.size < 2}
          >
            {isSubmitting ? (
              <>
                <div className="group-creation-spinner" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
