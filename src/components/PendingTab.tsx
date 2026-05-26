import { useState } from 'react'
import FileRow from './FileRow'
import type { DiffState, FileStatus, GitStatusEntry } from '../types'
import './ChangesPanel.css'

export interface PendingTabProps {
  rootPath: string | null
  unstagedEntries: GitStatusEntry[]
  stagedEntries: GitStatusEntry[]
  expandedFiles: Set<string>
  diffCache: Map<string, DiffState>
  onToggleGitFile: (entry: GitStatusEntry, staged: boolean) => void
  onStageRel: (relativePath: string) => void
  onUnstageRel: (relativePath: string) => void
  onDiscardGitEntry: (entry: GitStatusEntry) => void
  onAcceptAll: () => void
  onOpenCommitModal: () => void
  onOpenInEditor?: (filePath: string) => void
  onOpenDiff?: (filePath: string, status: FileStatus) => void
}

const toFileStatus = (entry: GitStatusEntry, staged: boolean): FileStatus => {
  const code = staged ? entry.staged_status : entry.unstaged_status
  if (entry.is_untracked || code === 'A') return 'created'
  if (code === 'D') return 'deleted'
  return 'modified'
}

const toAbsolute = (rootPath: string | null, relPath: string): string =>
  rootPath ? `${rootPath}/${relPath}` : relPath

interface SectionProps {
  title: string
  entries: GitStatusEntry[]
  staged: boolean
  rootPath: string | null
  expandedFiles: Set<string>
  diffCache: Map<string, DiffState>
  onToggleGitFile: (entry: GitStatusEntry, staged: boolean) => void
  onStageRel: (relativePath: string) => void
  onUnstageRel: (relativePath: string) => void
  onDiscardGitEntry: (entry: GitStatusEntry) => void
  onOpenInEditor?: (filePath: string) => void
  onOpenDiff?: (filePath: string, status: FileStatus) => void
  emptyLabel: string
}

function Section({
  title, entries, staged, rootPath, expandedFiles, diffCache,
  onToggleGitFile, onStageRel, onUnstageRel, onDiscardGitEntry,
  onOpenInEditor, onOpenDiff, emptyLabel,
}: SectionProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="changes-panel-section">
      <button
        type="button"
        className="changes-panel-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="changes-panel-section-chevron"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ›
        </span>
        <span className="changes-panel-section-title">
          {title} ({entries.length})
        </span>
      </button>
      {expanded && (
        entries.length === 0 ? (
          <div className="changes-panel-empty changes-panel-section-empty">{emptyLabel}</div>
        ) : (
          <div className="changes-panel-list">
            {entries.map((entry) => {
              const key = entry.path
              return (
                <FileRow
                  key={`${staged ? 's' : 'u'}:${key}`}
                  filePath={toAbsolute(rootPath, entry.path)}
                  status={toFileStatus(entry, staged)}
                  isExpanded={expandedFiles.has(key)}
                  isStaged={staged}
                  isCommitted={false}
                  diff={diffCache.get(key)}
                  onToggle={() => onToggleGitFile(entry, staged)}
                  onStage={staged ? undefined : () => onStageRel(entry.path)}
                  onUnstage={staged ? () => onUnstageRel(entry.path) : undefined}
                  onDiscard={staged ? undefined : () => onDiscardGitEntry(entry)}
                  onOpenInEditor={onOpenInEditor}
                  onOpenDiff={onOpenDiff}
                />
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

export default function PendingTab({
  rootPath,
  unstagedEntries,
  stagedEntries,
  expandedFiles,
  diffCache,
  onToggleGitFile,
  onStageRel,
  onUnstageRel,
  onDiscardGitEntry,
  onAcceptAll,
  onOpenCommitModal,
  onOpenInEditor,
  onOpenDiff,
}: PendingTabProps) {
  const total = unstagedEntries.length + stagedEntries.length

  return (
    <>
      {total > 0 && (
        <div className="changes-panel-header">
          <span className="changes-panel-summary">
            {total} file{total !== 1 ? 's' : ''}
          </span>
          <div className="changes-panel-global-actions">
            {unstagedEntries.length > 0 && (
              <button
                type="button"
                className="changes-btn changes-btn-accept-all"
                onClick={onAcceptAll}
                title="Stage all changes"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="changes-btn-commit-text"
              onClick={onOpenCommitModal}
              title="Commit changes"
            >
              Commit
            </button>
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="changes-panel-empty">No pending changes</div>
      ) : (
        <div className="changes-panel-sections">
          <Section
            title="Unstaged"
            entries={unstagedEntries}
            staged={false}
            rootPath={rootPath}
            expandedFiles={expandedFiles}
            diffCache={diffCache}
            onToggleGitFile={onToggleGitFile}
            onStageRel={onStageRel}
            onUnstageRel={onUnstageRel}
            onDiscardGitEntry={onDiscardGitEntry}
            onOpenInEditor={onOpenInEditor}
            onOpenDiff={onOpenDiff}
            emptyLabel="No unstaged changes"
          />
          <Section
            title="Staged"
            entries={stagedEntries}
            staged={true}
            rootPath={rootPath}
            expandedFiles={expandedFiles}
            diffCache={diffCache}
            onToggleGitFile={onToggleGitFile}
            onStageRel={onStageRel}
            onUnstageRel={onUnstageRel}
            onDiscardGitEntry={onDiscardGitEntry}
            onOpenInEditor={onOpenInEditor}
            onOpenDiff={onOpenDiff}
            emptyLabel="No staged changes"
          />
        </div>
      )}
    </>
  )
}
