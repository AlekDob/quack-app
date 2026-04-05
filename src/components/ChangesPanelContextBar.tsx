import './ChangesPanel.css'

interface ChangesPanelContextBarProps {
  branch?: string | null
  isWorktree?: boolean
  projectName?: string | null
}

export default function ChangesPanelContextBar({
  branch,
  isWorktree,
  projectName,
}: ChangesPanelContextBarProps) {
  if (!branch && !projectName) return null

  return (
    <div className="changes-context-bar">
      {projectName && (
        <span className="changes-project-name" title={projectName}>{projectName}</span>
      )}
      {branch && (
        <>
          <svg className="changes-branch-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span className="changes-branch-name" title={branch}>{branch}</span>
        </>
      )}
      {isWorktree && <span className="changes-worktree-badge">worktree</span>}
    </div>
  )
}
