/**
 * AddKanbanTaskModal Component
 *
 * Modal for creating a new Kanban task.
 * Allows selecting project, branch, agent, and setting title/prompt.
 *
 * Flow:
 * 1. Select Project (grouped repositories from active terminals)
 * 2. Select Branch (git branches for selected project)
 * 3. Select Agent (active terminals in that project)
 * 4. Enter Title and Prompt
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { TerminalInfo, KanbanAssignedAgent } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';

interface AddKanbanTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    prompt: string,
    projectPath: string,
    projectName: string,
    branch: string | undefined,
    agent: KanbanAssignedAgent | undefined
  ) => void;
  terminals: TerminalInfo[];
}

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

// Helper to extract repository name from path
function getRepoDisplayName(path: string): string {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('-worktree-')) {
    return lastPart.split('-worktree-')[0];
  }
  return lastPart;
}

// Group terminals by repository path
interface ProjectGroup {
  path: string;
  name: string;
  terminals: TerminalInfo[];
  branches: string[];
}

export default function AddKanbanTaskModal({
  isOpen,
  onClose,
  onSubmit,
  terminals,
}: AddKanbanTaskModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Avatar URL cache for custom avatars
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  // Group terminals by repository
  const projectGroups = useMemo(() => {
    const groups: Map<string, ProjectGroup> = new Map();

    terminals.forEach((terminal) => {
      // Get base path (without worktree suffix)
      let basePath = terminal.cwd;
      if (terminal.worktreePath) {
        // If using worktree, use the original repo path
        basePath = terminal.cwd.replace(/-worktree-.*$/, '');
      }

      // Extract repo name
      const repoName = getRepoDisplayName(basePath);

      if (!groups.has(basePath)) {
        groups.set(basePath, {
          path: basePath,
          name: repoName,
          terminals: [],
          branches: [],
        });
      }

      const group = groups.get(basePath)!;
      group.terminals.push(terminal);

      // Collect unique branches
      if (terminal.branch && !group.branches.includes(terminal.branch)) {
        group.branches.push(terminal.branch);
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [terminals]);

  // Get current project group
  const currentProject = useMemo(() => {
    return projectGroups.find((g) => g.path === selectedProjectPath);
  }, [projectGroups, selectedProjectPath]);

  // Get terminals for selected project and branch
  const filteredTerminals = useMemo(() => {
    if (!currentProject) return [];
    if (!selectedBranch) return currentProject.terminals;
    return currentProject.terminals.filter(
      (t) => t.branch === selectedBranch || (!t.branch && selectedBranch === 'main')
    );
  }, [currentProject, selectedBranch]);

  // Load custom avatar URLs
  useEffect(() => {
    async function loadAvatarUrls() {
      const newUrls: Record<string, string> = {};

      for (const terminal of terminals) {
        if (terminal.avatar && isCustomAvatar(terminal.avatar)) {
          if (!avatarUrls[terminal.avatar]) {
            try {
              const url = await getCustomAvatarUrl(terminal.avatar);
              newUrls[terminal.avatar] = url;
            } catch (err) {
              console.error('Failed to load custom avatar:', err);
            }
          }
        }
      }

      if (Object.keys(newUrls).length > 0) {
        setAvatarUrls((prev) => ({ ...prev, ...newUrls }));
      }
    }

    if (isOpen && terminals.length > 0) {
      loadAvatarUrls();
    }
  }, [isOpen, terminals]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPrompt('');
      setSelectedProjectPath('');
      setSelectedBranch('');
      setSelectedAgentId('');
    }
  }, [isOpen]);

  // Auto-select first project if only one exists
  useEffect(() => {
    if (isOpen && projectGroups.length === 1 && !selectedProjectPath) {
      setSelectedProjectPath(projectGroups[0].path);
    }
  }, [isOpen, projectGroups, selectedProjectPath]);

  // Auto-select branch when project changes
  useEffect(() => {
    if (currentProject && currentProject.branches.length > 0) {
      // Try to select 'main' or first branch
      const defaultBranch = currentProject.branches.includes('main')
        ? 'main'
        : currentProject.branches[0];
      setSelectedBranch(defaultBranch);
    } else {
      setSelectedBranch('');
    }
    setSelectedAgentId('');
  }, [selectedProjectPath, currentProject]);

  // Get avatar URL for a terminal
  const getTerminalAvatarUrl = useCallback(
    (terminal: TerminalInfo): string => {
      if (!terminal.avatar) {
        return getAvatarUrl('duck15.jpeg');
      }
      if (isCustomAvatar(terminal.avatar)) {
        return avatarUrls[terminal.avatar] || getAvatarUrl('duck15.jpeg');
      }
      return getAvatarUrl(terminal.avatar);
    },
    [avatarUrls]
  );

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();

    if (!trimmedTitle || !trimmedPrompt || !selectedProjectPath) return;

    const projectName = currentProject?.name || getRepoDisplayName(selectedProjectPath);

    // Find selected agent
    let assignedAgent: KanbanAssignedAgent | undefined;
    if (selectedAgentId) {
      const terminal = terminals.find((t) => t.id === selectedAgentId);
      if (terminal) {
        assignedAgent = {
          id: terminal.id,
          name: terminal.label,
          color: terminal.color,
          avatar: terminal.avatar,
          projectPath: terminal.cwd,
          projectName,
          branch: terminal.branch,
          useWorktree: terminal.useWorktree,
          worktreePath: terminal.worktreePath,
          workingOn: terminal.workingOn,
          personality: terminal.personality as Record<string, unknown>,
        };
      }
    }

    onSubmit(
      trimmedTitle,
      trimmedPrompt,
      selectedProjectPath,
      projectName,
      selectedBranch || undefined,
      assignedAgent
    );
  }, [
    title,
    prompt,
    selectedProjectPath,
    selectedBranch,
    selectedAgentId,
    currentProject,
    terminals,
    onSubmit,
  ]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && e.metaKey && title.trim() && prompt.trim() && selectedProjectPath) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [title, prompt, selectedProjectPath, handleSubmit, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const isValid = title.trim() && prompt.trim() && selectedProjectPath;

  return (
    <div
      className="kanban-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="kanban-modal kanban-modal-large" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="kanban-modal-header">
          <h2>Create New Task</h2>
          <button className="kanban-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="kanban-modal-content">
          {/* Project Selection */}
          <div className="kanban-form-field">
            <label htmlFor="task-project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Project
            </label>
            {projectGroups.length === 0 ? (
              <div className="kanban-form-empty">
                No active projects. Create an agent first.
              </div>
            ) : (
              <select
                id="task-project"
                value={selectedProjectPath}
                onChange={(e) => setSelectedProjectPath(e.target.value)}
              >
                <option value="">Select a project...</option>
                {projectGroups.map((group) => (
                  <option key={group.path} value={group.path}>
                    {group.name} ({group.terminals.length} agent{group.terminals.length !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Branch Selection */}
          {currentProject && currentProject.branches.length > 0 && (
            <div className="kanban-form-field">
              <label htmlFor="task-branch">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                Branch
              </label>
              <select
                id="task-branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">All branches</option>
                {currentProject.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Agent Selection */}
          {currentProject && (
            <div className="kanban-form-field">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Assign Agent (optional)
              </label>
              <div className="kanban-agent-grid">
                {/* No agent option */}
                <button
                  type="button"
                  className={`kanban-agent-card ${!selectedAgentId ? 'selected' : ''}`}
                  onClick={() => setSelectedAgentId('')}
                >
                  <div className="kanban-agent-avatar-placeholder" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                  </div>
                  <span className="kanban-agent-name">No agent</span>
                </button>

                {/* Agent cards */}
                {filteredTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    type="button"
                    className={`kanban-agent-card ${selectedAgentId === terminal.id ? 'selected' : ''}`}
                    onClick={() => setSelectedAgentId(terminal.id)}
                    style={{ '--agent-color': terminal.color } as React.CSSProperties}
                  >
                    <img
                      src={getTerminalAvatarUrl(terminal)}
                      alt={terminal.label}
                      className="kanban-agent-avatar"
                    />
                    <div className="kanban-agent-info">
                      <span className="kanban-agent-name">{terminal.label}</span>
                      {terminal.branch && (
                        <span className="kanban-agent-branch">{terminal.branch}</span>
                      )}
                    </div>
                    <div
                      className="kanban-agent-color-dot"
                      style={{ background: terminal.color }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title field */}
          <div className="kanban-form-field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review authentication flow"
              autoFocus={!!selectedProjectPath}
            />
          </div>

          {/* Prompt field */}
          <div className="kanban-form-field">
            <label htmlFor="task-prompt">Prompt</label>
            <textarea
              id="task-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the full prompt for the AI agent..."
            />
          </div>

          {/* Task Preview */}
          {title && selectedProjectPath && (
            <div className="kanban-task-preview">
              <div className="kanban-task-preview-header">
                <span className="kanban-task-preview-title">{title}</span>
                {selectedAgentId && (() => {
                  const terminal = terminals.find((t) => t.id === selectedAgentId);
                  return terminal ? (
                    <div className="kanban-task-preview-agent">
                      <img
                        src={getTerminalAvatarUrl(terminal)}
                        alt={terminal.label}
                        style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                      />
                      <span>{terminal.label}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="kanban-task-preview-meta">
                <span>{currentProject?.name || 'Unknown'}</span>
                {selectedBranch && <span> / {selectedBranch}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="kanban-modal-footer">
          <button className="kanban-modal-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="kanban-modal-button primary"
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
