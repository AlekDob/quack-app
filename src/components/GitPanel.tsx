import { useMemo } from 'react'
import CodeEditor from './CodeEditor'

import type { GitCommitEntry, GitStatusEntry, GitStatusSummary } from '../types'

type DiffView = 'worktree' | 'staged'

interface GitPanelProps {
  summary: GitStatusSummary | null
  loading: boolean
  error: string | null
  history: GitCommitEntry[]
  historyLoading: boolean
  historyError: string | null
  selected: GitStatusEntry | null
  diffContent: string
  diffLoading: boolean
  diffError: string | null
  diffView: DiffView
  onDiffViewChange: (view: DiffView) => void
  onRefresh: () => void
  onSelect: (entry: GitStatusEntry) => void
  onStage: (entry: GitStatusEntry) => void
  onUnstage: (entry: GitStatusEntry) => void
  onStageAll: () => void
  onOpenFile: (path: string) => void
  commitMessage: string
  onCommitMessageChange: (message: string) => void
  onCommit: () => void
  committing: boolean
}

const statusBadgeClass = (kind: 'staged' | 'working') =>
  kind === 'staged' ? 'git-status-badge staged' : 'git-status-badge working'

const TIMELINE_LINE_LEFT = 20
const TIMELINE_LINE_COLOR = 'rgba(232, 125, 62, 0.32)'
const TIMELINE_DOT_COLOR = '#e87d3e'

const GitTimelineItem = ({
  entry,
  lineLeft,
  isLast,
}: {
  entry: GitCommitEntry
  lineLeft: number
  isLast: boolean
}) => {
  const formattedDate = entry.timestamp
    ? new Date(entry.timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: `${lineLeft + 28}px`,
        paddingBottom: isLast ? 0 : '1.2rem',
      }}
    >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${lineLeft}px`,
            top: 0,
            bottom: 0,
            width: '2px',
            background: TIMELINE_LINE_COLOR,
            transform: 'translateX(-50%)',
            zIndex: 0,
          }}
        />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${lineLeft}px`,
          top: '0.25rem',
          width: '14px',
          height: '14px',
          borderRadius: '999px',
          background: TIMELINE_DOT_COLOR,
          border: '3px solid ' + TIMELINE_DOT_COLOR,
          boxShadow: '0 0 0 3px rgba(15, 17, 26, 1)',
          transform: 'translate(-50%, 0)',
          zIndex: 1,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#f1f2f5',
          }}
        >
          {entry.summary}
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            color: '#a8aebd',
          }}
        >
          {entry.author} • {entry.relativeTime}
        </span>
        {formattedDate && (
          <span
            style={{
              fontSize: '0.62rem',
              color: 'rgba(255, 255, 255, 0.35)',
              fontWeight: 400,
              marginTop: '0.2rem',
            }}
          >
            {formattedDate}
          </span>
        )}
      </div>
    </div>
  )
}

export default function GitPanel({
  summary,
  loading,
  error,
  history,
  historyLoading,
  historyError,
  selected,
  diffContent,
  diffLoading,
  diffError,
  diffView,
  onDiffViewChange,
  onRefresh,
  onSelect,
  onStage,
  onUnstage,
  onStageAll,
  onOpenFile,
  commitMessage,
  onCommitMessageChange,
  onCommit,
  committing,
}: GitPanelProps) {
  const groupedEntries = useMemo(() => {
    const entries = summary?.entries ?? []
    const staged: GitStatusEntry[] = []
    const unstaged: GitStatusEntry[] = []
    for (const entry of entries) {
      if (entry.staged_status) {
        staged.push(entry)
      }
      if (entry.unstaged_status || entry.is_untracked) {
        unstaged.push(entry)
      }
    }
    return { staged, unstaged }
  }, [summary])

  return (
    <div className="git-panel">
      <header className="git-panel-header">
        <div className="git-branch-meta">
          <span className="git-branch-label">{summary?.branch ?? '—'}</span>
          {summary?.upstream && <span className="git-upstream">↦ {summary.upstream}</span>}
          {(summary?.ahead ?? 0) > 0 && (
            <span className="git-ahead">↑ {summary?.ahead}</span>
          )}
          {(summary?.behind ?? 0) > 0 && (
            <span className="git-behind">↓ {summary?.behind}</span>
          )}
        </div>
        <div className="git-panel-actions">
          <button
            type="button"
            className="git-stage-all-button"
            onClick={onStageAll}
            disabled={loading || groupedEntries.unstaged.length === 0}
          >
            Stage All
          </button>
          <button type="button" className="git-refresh" onClick={onRefresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="git-panel-error">{error}</div>
      ) : (
        <div className="git-panel-body">
          <aside className="git-status-column">
            <section className="git-status-section">
              <h3>Staging</h3>
              <div className="git-status-list">
                {loading ? (
                  <div className="git-empty">Loading…</div>
                ) : groupedEntries.staged.length === 0 ? (
                  <div className="git-empty">No files in staging</div>
                ) : (
                  groupedEntries.staged.map((entry) => (
                    <button
                      key={`staged-${entry.path}`}
                      type="button"
                      className={`git-status-item ${
            selected?.path === entry.path ? 'selected' : ''
                      }`}
                      onClick={() => onSelect(entry)}
                      onDoubleClick={() => onOpenFile(entry.path)}
                    >
                      <span className="git-status-path">{entry.path}</span>
                      <span className={statusBadgeClass('staged')}>
                        {entry.staged_status ?? 'Staged'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
            <section className="git-status-section">
              <h3>Changes</h3>
              <div className="git-status-list">
                {loading ? (
                  <div className="git-empty">Loading…</div>
                ) : groupedEntries.unstaged.length === 0 ? (
                  <div className="git-empty">Working tree clean</div>
                ) : (
                  groupedEntries.unstaged.map((entry) => (
                    <button
                      key={`unstaged-${entry.path}`}
                      type="button"
                      className={`git-status-item ${
                        selected?.path === entry.path ? 'selected' : ''
                      }`}
                      onClick={() => onSelect(entry)}
                      onDoubleClick={() => onOpenFile(entry.path)}
                    >
                      <span className="git-status-path">{entry.path}</span>
                      <span className={statusBadgeClass('working')}>
                        {entry.unstaged_status ?? 'Modified'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section className="git-main-column">
            <div className="git-diff-column">
            {selected ? (
              <div className="git-diff-wrapper">
                <div className="git-diff-toolbar">
                  <div className="git-diff-meta">
                    <span className="git-diff-filename">{selected.path}</span>
                    {selected.original_path && (
                      <span className="git-diff-rename">from {selected.original_path}</span>
                    )}
                  </div>
                  <div className="git-diff-actions">
                    {selected.staged_status && selected.unstaged_status && (
                      <div className="git-diff-toggle">
                        <button
                          type="button"
                          className={diffView === 'worktree' ? 'active' : ''}
                          onClick={() => onDiffViewChange('worktree')}
                        >
                          Working tree
                        </button>
                        <button
                          type="button"
                          className={diffView === 'staged' ? 'active' : ''}
                          onClick={() => onDiffViewChange('staged')}
                        >
                          Staging
                        </button>
                      </div>
                    )}
                    <div className="git-diff-buttons">
                      {(selected.unstaged_status || selected.is_untracked) && (
                        <button type="button" onClick={() => onStage(selected)}>
                          Stage
                        </button>
                      )}
                      {selected.staged_status && (
                        <button type="button" onClick={() => onUnstage(selected)}>
                          Unstage
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="git-diff-content">
                  {diffLoading ? (
                    <div className="git-empty">Computing diff…</div>
                  ) : diffError ? (
                    <div className="git-panel-error">{diffError}</div>
                  ) : (
                    <div className="git-diff-editor">
                      <CodeEditor
                        content={diffContent}
                        filename={`${selected.path}.diff`}
                        language="diff"
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="git-empty git-diff-placeholder">
                Select a file to see the diff
              </div>
            )}
            </div>

            <div className="git-history-timeline">
              <header className="git-history-header">
                <h3>Timeline</h3>
                {historyLoading && <span className="git-history-status">Updating…</span>}
                {historyError && !historyLoading && (
                  <span className="git-history-error">{historyError}</span>
                )}
              </header>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.5rem 0.8rem 1rem 0',
                  minHeight: 0,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: `${TIMELINE_LINE_LEFT}px`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'rgba(232, 125, 62, 0.3)',
                    pointerEvents: 'none',
                  }}
                />
                {historyLoading ? (
                  <div className="git-empty">Loading commits…</div>
                ) : history.length === 0 ? (
                  <div className="git-empty">No recent commits</div>
                ) : (
                  history.map((entry, index) => (
                    <GitTimelineItem
                      key={entry.hash}
                      entry={entry}
                      lineLeft={TIMELINE_LINE_LEFT}
                      isLast={index === history.length - 1}
                    />
                  ))
                )}
              </div>

              <div className="git-commit-box">
                <h3>Commit</h3>
                <textarea
                  className="git-commit-message"
                  placeholder="Commit message"
                  value={commitMessage}
                  onChange={(event) => onCommitMessageChange(event.target.value)}
                />
                <button
                  type="button"
                  className="git-commit-button"
                  onClick={onCommit}
                  disabled={committing || commitMessage.trim().length === 0}
                >
                  {committing ? 'Committing…' : 'Commit'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
