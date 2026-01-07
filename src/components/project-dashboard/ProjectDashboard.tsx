import { useEffect } from 'react';
import { useProjectDashboard } from '../../hooks/useProjectDashboard';
import './ProjectDashboard.css';

interface ProjectDashboardProps {
  projectPath: string;
  projectName: string;
  onOpenKanban?: () => void;
  onOpenGitPanel?: () => void;
  onNewTask?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Project Dashboard Component
 *
 * Displays a comprehensive overview of a project including:
 * - Git status (branch, ahead/behind, dirty state)
 * - Recent commits
 * - Worktrees
 * - Task overview (TODO/In Progress/Done)
 * - Quick actions
 */
export default function ProjectDashboard({
  projectPath,
  projectName,
  onOpenKanban,
  onOpenGitPanel,
  onNewTask,
  onLoadingChange,
}: ProjectDashboardProps) {
  const {
    gitStatus,
    commits,
    worktrees,
    todoCount,
    inProgressCount,
    doneCount,
    isLoading,
    error,
  } = useProjectDashboard(projectPath);

  // Notify parent about loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Don't render loading state here - parent handles fullscreen loader
  if (isLoading) {
    return null;
  }

  if (error) {
    return (
      <div className="project-dashboard-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <h3>Failed to load project</h3>
        <p>{error}</p>
      </div>
    );
  }

  const totalTasks = todoCount + inProgressCount + doneCount;
  const completionPercentage = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="project-dashboard">
      {/* Header */}
      <div className="project-dashboard-header">
        <div className="project-dashboard-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="project-dashboard-header-content">
          <h1 className="project-dashboard-title">{projectName}</h1>
          <p className="project-dashboard-path">{projectPath}</p>
        </div>
        {gitStatus && (
          <div className="project-dashboard-branch-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            {gitStatus.branch}
          </div>
        )}
      </div>

      {/* Grid Layout - 2x2 Cards */}
      <div className="project-dashboard-grid">
        {/* Git Overview Card */}
        <div className="project-dashboard-card">
          <div className="project-dashboard-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <h2>Git Status</h2>
          </div>
          <div className="project-dashboard-card-content">
            {gitStatus ? (
              <>
                <div className="project-dashboard-git-stats">
                  <div className="project-dashboard-stat">
                    <span className="project-dashboard-stat-label">Branch</span>
                    <span className="project-dashboard-stat-value">{gitStatus.branch}</span>
                  </div>
                  <div className="project-dashboard-stat">
                    <span className="project-dashboard-stat-label">Status</span>
                    <span className={`project-dashboard-stat-badge ${gitStatus.dirty ? 'dirty' : 'clean'}`}>
                      {gitStatus.dirty ? 'Dirty' : 'Clean'}
                    </span>
                  </div>
                  {gitStatus.dirty && (
                    <>
                      <div className="project-dashboard-stat">
                        <span className="project-dashboard-stat-label">Staged</span>
                        <span className={`project-dashboard-stat-value ${gitStatus.stagedCount > 0 ? 'project-dashboard-stat-value--staged' : ''}`}>
                          {gitStatus.stagedCount} files
                        </span>
                      </div>
                      <div className="project-dashboard-stat">
                        <span className="project-dashboard-stat-label">Unstaged</span>
                        <span className={`project-dashboard-stat-value ${gitStatus.unstagedCount > 0 ? 'project-dashboard-stat-value--unstaged' : ''}`}>
                          {gitStatus.unstagedCount} files
                        </span>
                      </div>
                      {gitStatus.stagedCount > 0 && (
                        <div className="project-dashboard-stat project-dashboard-stat--highlight">
                          <span className="project-dashboard-stat-label">Ready to Commit</span>
                          <span className="project-dashboard-stat-badge ready">Yes</span>
                        </div>
                      )}
                    </>
                  )}
                  {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <div className="project-dashboard-stat">
                      <span className="project-dashboard-stat-label">Sync</span>
                      <span className="project-dashboard-stat-value">
                        {gitStatus.ahead > 0 && `↑${gitStatus.ahead} `}
                        {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
                      </span>
                    </div>
                  )}
                </div>
                {commits.length > 0 && (
                  <div className="project-dashboard-commits">
                    <h3 className="project-dashboard-commits-title">Recent Commits</h3>
                    <div className="project-dashboard-commits-list">
                      {commits.slice(0, 5).map((commit) => (
                        <div key={commit.hash} className="project-dashboard-commit">
                          <span className="project-dashboard-commit-hash">{commit.hash.slice(0, 7)}</span>
                          <span className="project-dashboard-commit-message">{commit.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="project-dashboard-empty">
                <p>No git repository found</p>
              </div>
            )}
          </div>
        </div>

        {/* Task Overview Card */}
        <div className="project-dashboard-card">
          <div className="project-dashboard-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
            <h2>Tasks</h2>
          </div>
          <div className="project-dashboard-card-content">
            {totalTasks > 0 ? (
              <>
                <div className="project-dashboard-task-counts">
                  <div className="project-dashboard-task-count">
                    <span className="project-dashboard-task-count-value">{todoCount}</span>
                    <span className="project-dashboard-task-count-label">To Do</span>
                  </div>
                  <div className="project-dashboard-task-count">
                    <span className="project-dashboard-task-count-value project-dashboard-task-count-value--progress">
                      {inProgressCount}
                    </span>
                    <span className="project-dashboard-task-count-label">In Progress</span>
                  </div>
                  <div className="project-dashboard-task-count">
                    <span className="project-dashboard-task-count-value project-dashboard-task-count-value--done">
                      {doneCount}
                    </span>
                    <span className="project-dashboard-task-count-label">Done</span>
                  </div>
                </div>
                <div className="project-dashboard-progress">
                  <div className="project-dashboard-progress-header">
                    <span className="project-dashboard-progress-label">Completion</span>
                    <span className="project-dashboard-progress-percentage">{completionPercentage}%</span>
                  </div>
                  <div className="project-dashboard-progress-bar">
                    <div
                      className="project-dashboard-progress-fill"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="project-dashboard-empty">
                <p>No tasks found for this project</p>
              </div>
            )}
          </div>
        </div>

        {/* Worktree Card */}
        <div className="project-dashboard-card">
          <div className="project-dashboard-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 7h-9" />
              <path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" />
              <circle cx="7" cy="7" r="3" />
            </svg>
            <h2>Worktrees</h2>
          </div>
          <div className="project-dashboard-card-content">
            {worktrees.length > 0 ? (
              <div className="project-dashboard-worktrees">
                {worktrees.map((worktree, index) => (
                  <div key={index} className="project-dashboard-worktree">
                    <div className="project-dashboard-worktree-branch">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      {worktree.branch}
                      {worktree.isCurrent && (
                        <span className="project-dashboard-worktree-current">Current</span>
                      )}
                    </div>
                    <div className="project-dashboard-worktree-path">{worktree.path}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="project-dashboard-empty">
                <p>No worktrees configured</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="project-dashboard-card">
          <div className="project-dashboard-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <h2>Quick Actions</h2>
          </div>
          <div className="project-dashboard-card-content">
            <div className="project-dashboard-actions">
              <button
                className="project-dashboard-action-button"
                onClick={onNewTask}
                disabled={!onNewTask}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Task
              </button>
              <button
                className="project-dashboard-action-button"
                onClick={onOpenKanban}
                disabled={!onOpenKanban}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Open Kanban
              </button>
              <button
                className="project-dashboard-action-button"
                onClick={onOpenGitPanel}
                disabled={!onOpenGitPanel}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                Git Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
