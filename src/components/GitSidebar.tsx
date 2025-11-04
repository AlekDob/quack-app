import { useState, useMemo } from 'react'
import type { GitBranch, TerminalInfo } from '../types'
import { getAgentAvatar } from '../utils/agentAvatars'
import './GitSidebar.css'

interface GitSidebarProps {
  branches: GitBranch[]
  currentBranch: string
  terminals: TerminalInfo[]
  onBranchSwitch?: (branchName: string) => void
  unstagedCount: number
  onMerge?: (sourceBranch: string, targetBranch: string) => Promise<void>
}

type SectionState = {
  branches: boolean
  remotes: boolean
  tags: boolean
  stashes: boolean
}

type BranchFolder = {
  [key: string]: GitBranch[]
}

function GitSidebar({
  branches,
  terminals,
  onBranchSwitch,
  unstagedCount,
  onMerge,
}: GitSidebarProps) {
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<SectionState>({
    branches: false,
    remotes: false,
    tags: true,
    stashes: true,
  })
  const [branchFolders, setBranchFolders] = useState<{ [key: string]: boolean }>({})
  const [draggingBranch, setDraggingBranch] = useState<string | null>(null)
  const [dragOverBranch, setDragOverBranch] = useState<string | null>(null)

  // Group branches by folder (agent/, feature/, etc.)
  const groupedBranches = useMemo(() => {
    const folders: BranchFolder = {}
    const root: GitBranch[] = []

    branches.forEach((branch) => {
      const parts = branch.name.split('/')
      if (parts.length > 1) {
        const folderName = parts[0]
        if (!folders[folderName]) {
          folders[folderName] = []
        }
        folders[folderName].push(branch)
      } else {
        root.push(branch)
      }
    })

    return { folders, root }
  }, [branches])

  // Group remote branches
  const remoteBranches = useMemo(() => {
    const remotes: { [key: string]: GitBranch[] } = {}
    branches.forEach((branch) => {
      if (branch.hasRemote && branch.upstream) {
        const parts = branch.upstream.split('/')
        if (parts.length > 1) {
          const remoteName = parts[0]
          if (!remotes[remoteName]) {
            remotes[remoteName] = []
          }
          remotes[remoteName].push(branch)
        }
      }
    })
    return remotes
  }, [branches])

  const toggleSection = (section: keyof SectionState) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleFolder = (folderName: string) => {
    setBranchFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }))
  }

  const handleBranchClick = async (branchName: string) => {
    if (onBranchSwitch) {
      await onBranchSwitch(branchName)
    }
  }

  const getAgentForBranch = (branchName: string) => {
    return terminals.find((t) => t.branch === branchName)
  }

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, branchName: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('branch', branchName)
    setDraggingBranch(branchName)
  }

  const handleDragOver = (e: React.DragEvent, targetBranch: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverBranch(targetBranch)
  }

  const handleDragLeave = () => {
    setDragOverBranch(null)
  }

  const handleDragEnd = () => {
    setDraggingBranch(null)
    setDragOverBranch(null)
  }

  const handleDrop = async (e: React.DragEvent, targetBranch: string) => {
    e.preventDefault()
    const sourceBranch = e.dataTransfer.getData('branch')

    // Reset drag state
    setDraggingBranch(null)
    setDragOverBranch(null)

    // Cannot merge into itself
    if (sourceBranch === targetBranch) {
      return
    }

    // Check for unstaged files
    if (unstagedCount > 0) {
      alert(`You have ${unstagedCount} unstaged change${unstagedCount > 1 ? 's' : ''}. Please stage or stash them before merging.`)
      return
    }

    // Show confirmation
    const confirmed = window.confirm(`Merge '${sourceBranch}' into '${targetBranch}'?`)
    if (!confirmed) {
      return
    }

    // Perform merge
    if (onMerge) {
      try {
        await onMerge(sourceBranch, targetBranch)
      } catch (error) {
        console.error('Merge failed:', error)
      }
    }
  }

  const handleMerge = async (branchName: string) => {
    // Get current branch from branches prop
    const currentBranch = branches.find(b => b.isCurrent)
    if (!currentBranch) {
      alert('No current branch found')
      return
    }

    // Cannot merge into itself
    if (branchName === currentBranch.name) {
      return
    }

    // Check for unstaged files (same as drag & drop)
    if (unstagedCount > 0) {
      alert(`You have ${unstagedCount} unstaged change${unstagedCount > 1 ? 's' : ''}. Please stage or stash them before merging.`)
      return
    }

    // Show confirmation (same as drag & drop)
    const confirmed = window.confirm(`Merge '${branchName}' into '${currentBranch.name}'?`)
    if (!confirmed) {
      return
    }

    // Execute merge using the same onMerge handler
    if (onMerge) {
      try {
        await onMerge(branchName, currentBranch.name)
      } catch (error) {
        console.error('Merge failed:', error)
      }
    }
  }

  return (
    <aside className="git-sidebar">
      {/* Filter Input */}
      <div className="git-sidebar-filter">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="git-sidebar-filter-input"
        />
      </div>

      {/* Branches Section */}
      <section className="git-sidebar-section">
        <button
          type="button"
          className="git-sidebar-section-header"
          onClick={() => toggleSection('branches')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: collapsed.branches ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Branches</span>
        </button>

        {!collapsed.branches && (
          <div className="git-sidebar-section-content">
            {/* Root branches */}
            {groupedBranches.root.map((branch) => {
              const agent = getAgentForBranch(branch.name)
              const isDragging = draggingBranch === branch.name
              const isDragOver = dragOverBranch === branch.name
              return (
                <div
                  key={branch.name}
                  className={`git-sidebar-branch-wrapper ${isDragOver ? 'drag-over' : ''}`}
                >
                  <button
                    type="button"
                    className={`git-sidebar-branch-item ${
                      branch.isCurrent ? 'current' : ''
                    } ${isDragging ? 'dragging' : ''}`}
                    onClick={() => handleBranchClick(branch.name)}
                    draggable={!branch.isCurrent}
                    onDragStart={(e) => handleDragStart(e, branch.name)}
                    onDragOver={(e) => handleDragOver(e, branch.name)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, branch.name)}
                  >
                    {branch.isCurrent ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" fill="none"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                    )}
                    <span className="git-sidebar-branch-name">{branch.name}</span>
                    {branch.behind && branch.behind > 0 && (
                      <span className="git-sidebar-branch-behind">{branch.behind}↓</span>
                    )}
                    {agent && (
                      <img
                        src={getAgentAvatar(agent.label, agent.avatar)}
                        alt={agent.label}
                        className="git-sidebar-branch-avatar"
                      />
                    )}
                  </button>
                  {!branch.isCurrent && (
                    <button
                      type="button"
                      className="git-sidebar-branch-merge"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMerge(branch.name)
                      }}
                      title={`Merge ${branch.name} into current branch`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M6 21V9a9 9 0 0 0 9 9" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}

            {/* Folders */}
            {Object.keys(groupedBranches.folders)
              .sort()
              .map((folderName) => (
                  <div key={folderName} className="git-sidebar-folder">
                    <button
                      type="button"
                      className="git-sidebar-folder-header"
                      onClick={() => toggleFolder(folderName)}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: branchFolders[folderName]
                            ? 'rotate(0deg)'
                            : 'rotate(90deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
                      </svg>
                      <span title={folderName}>{folderName}</span>
                    </button>

                    {!branchFolders[folderName] && (
                      <div className="git-sidebar-folder-content">
                        {groupedBranches.folders[folderName].map((branch) => {
                        const agent = getAgentForBranch(branch.name)
                        const displayName = branch.name.split('/').slice(1).join('/')
                        const isDragging = draggingBranch === branch.name
                        const isDragOver = dragOverBranch === branch.name
                        return (
                          <div
                            key={branch.name}
                            className={`git-sidebar-branch-wrapper ${isDragOver ? 'drag-over' : ''}`}
                          >
                            <button
                              type="button"
                              className={`git-sidebar-branch-item nested ${
                                branch.isCurrent ? 'current' : ''
                              } ${isDragging ? 'dragging' : ''}`}
                              onClick={() => handleBranchClick(branch.name)}
                              draggable={!branch.isCurrent}
                              onDragStart={(e) => handleDragStart(e, branch.name)}
                              onDragOver={(e) => handleDragOver(e, branch.name)}
                              onDragLeave={handleDragLeave}
                              onDragEnd={handleDragEnd}
                              onDrop={(e) => handleDrop(e, branch.name)}
                            >
                              {branch.isCurrent ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" fill="none"/>
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="6" y1="3" x2="6" y2="15" />
                                  <circle cx="18" cy="6" r="3" />
                                  <circle cx="6" cy="18" r="3" />
                                  <path d="M18 9a9 9 0 0 1-9 9" />
                                </svg>
                              )}
                              <span className="git-sidebar-branch-name">{displayName}</span>
                              {branch.behind && branch.behind > 0 && (
                                <span className="git-sidebar-branch-behind">{branch.behind}↓</span>
                              )}
                              {agent && (
                                <img
                                  src={getAgentAvatar(agent.label, agent.avatar)}
                                  alt={agent.label}
                                  className="git-sidebar-branch-avatar"
                                />
                              )}
                            </button>
                            {!branch.isCurrent && (
                              <button
                                type="button"
                                className="git-sidebar-branch-merge"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMerge(branch.name)
                                }}
                                title={`Merge ${branch.name} into current branch`}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="18" cy="18" r="3" />
                                  <circle cx="6" cy="6" r="3" />
                                  <path d="M6 21V9a9 9 0 0 0 9 9" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Remotes Section */}
      {Object.keys(remoteBranches).length > 0 && (
        <section className="git-sidebar-section">
          <button
            type="button"
            className="git-sidebar-section-header"
            onClick={() => toggleSection('remotes')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: collapsed.remotes ? 'rotate(0deg)' : 'rotate(90deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>Remotes</span>
          </button>

          {!collapsed.remotes && (
            <div className="git-sidebar-section-content">
              {Object.keys(remoteBranches)
                .sort()
                .map((remoteName) => (
                  <div key={remoteName} className="git-sidebar-folder">
                    <div className="git-sidebar-folder-header static">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" />
                      </svg>
                      <span>{remoteName}</span>
                    </div>
                    <div className="git-sidebar-folder-content">
                      {remoteBranches[remoteName].map((branch) => (
                        <div key={branch.name} className="git-sidebar-branch-item nested readonly">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="6" y1="3" x2="6" y2="15" />
                            <circle cx="18" cy="6" r="3" />
                            <circle cx="6" cy="18" r="3" />
                            <path d="M18 9a9 9 0 0 1-9 9" />
                          </svg>
                          <span className="git-sidebar-branch-name">
                            {branch.upstream?.split('/').slice(1).join('/') || branch.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Tags Section */}
      <section className="git-sidebar-section">
        <button
          type="button"
          className="git-sidebar-section-header"
          onClick={() => toggleSection('tags')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: collapsed.tags ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Tags</span>
        </button>
        {!collapsed.tags && (
          <div className="git-sidebar-section-content">
            <div className="git-empty">No tags</div>
          </div>
        )}
      </section>

      {/* Stashes Section */}
      <section className="git-sidebar-section">
        <button
          type="button"
          className="git-sidebar-section-header"
          onClick={() => toggleSection('stashes')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: collapsed.stashes ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>Stashes</span>
        </button>
        {!collapsed.stashes && (
          <div className="git-sidebar-section-content">
            <div className="git-empty">No stashes</div>
          </div>
        )}
      </section>
    </aside>
  )
}

export default GitSidebar
