import { useMemo } from 'react'

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
  commitMessage: string
  onCommitMessageChange: (message: string) => void
  onCommit: () => void
  committing: boolean
}

const statusBadgeClass = (kind: 'staged' | 'working') =>
  kind === 'staged' ? 'git-status-badge staged' : 'git-status-badge working'

const TIMELINE_LINE_LEFT = 18
const TIMELINE_CONNECTOR_COLOR = 'rgba(232, 125, 62, 0.32)'
const DOT_SIZE = 14
const DOT_TOP_OFFSET = 4 // circa 0.25rem per allinearsi con il layout esistente
const DOT_CENTER = DOT_TOP_OFFSET + DOT_SIZE / 2

const GitTimelineItem = ({
  entry,
  lineLeft,
  isFirst,
  isLast,
}: {
  entry: GitCommitEntry
  lineLeft: number
  isFirst: boolean
  isLast: boolean
}) => (
  <div
    style={{
      position: 'relative',
      paddingLeft: `${lineLeft + 28}px`,
      paddingBottom: isLast ? 0 : '1.2rem',
    }}
  >
    {!isFirst && (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${lineLeft}px`,
          top: 0,
          width: '2px',
          height: `${DOT_CENTER}px`,
          background: TIMELINE_CONNECTOR_COLOR,
          transform: 'translateX(-50%)',
        }}
      />
    )}
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: `${lineLeft}px`,
        top: `${DOT_TOP_OFFSET}px`,
        width: `${DOT_SIZE}px`,
        height: `${DOT_SIZE}px`,
        borderRadius: '999px',
        background: '#e87d3e',
        border: '3px solid #e87d3e',
        boxShadow: '0 0 0 3px rgba(15, 17, 26, 1)',
        transform: 'translate(-50%, 0)',
        zIndex: 1,
      }}
    />
    {!isLast && (
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `${lineLeft}px`,
          top: `${DOT_CENTER}px`,
          bottom: 0,
          width: '2px',
          background: TIMELINE_CONNECTOR_COLOR,
          transform: 'translateX(-50%)',
        }}
      />
    )}
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
    </div>
  </div>
)

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
        <button type="button" className="git-refresh" onClick={onRefresh} disabled={loading}>
          Aggiorna
        </button>
      </header>

      {error ? (
        <div className="git-panel-error">{error}</div>
      ) : (
        <div className="git-panel-body">
          <aside className="git-status-column">
            <section className="git-status-section">
              <h3>In staging</h3>
              <div className="git-status-list">
                {loading ? (
                  <div className="git-empty">Caricamento…</div>
                ) : groupedEntries.staged.length === 0 ? (
                  <div className="git-empty">Nessun file in staging</div>
                ) : (
                  groupedEntries.staged.map((entry) => (
                    <button
                      key={`staged-${entry.path}`}
                      type="button"
                      className={`git-status-item ${
                        selected?.path === entry.path ? 'selected' : ''
                      }`}
                      onClick={() => onSelect(entry)}
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
              <h3>Modifiche locali</h3>
              <div className="git-status-list">
                {loading ? (
                  <div className="git-empty">Caricamento…</div>
                ) : groupedEntries.unstaged.length === 0 ? (
                  <div className="git-empty">Working tree pulito</div>
                ) : (
                  groupedEntries.unstaged.map((entry) => (
                    <button
                      key={`unstaged-${entry.path}`}
                      type="button"
                      className={`git-status-item ${
                        selected?.path === entry.path ? 'selected' : ''
                      }`}
                      onClick={() => onSelect(entry)}
                    >
                      <span className="git-status-path">{entry.path}</span>
                      <span className={statusBadgeClass('working')}>
                        {entry.unstaged_status ?? 'Modificato'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section className="git-main-column">
            <div className="git-history-section">
              <header className="git-history-header">
                <h3>Timeline</h3>
                {historyLoading && <span className="git-history-status">Aggiornamento…</span>}
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
                {historyLoading ? (
                  <div className="git-empty">Caricamento commit…</div>
                ) : history.length === 0 ? (
                  <div className="git-empty">Nessun commit recente</div>
                ) : (
                  history.map((entry, index) => (
                    <GitTimelineItem
                      key={entry.hash}
                      entry={entry}
                      lineLeft={TIMELINE_LINE_LEFT}
                      isFirst={index === 0}
                      isLast={index === history.length - 1}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="git-diff-column">
            {selected ? (
              <div className="git-diff-wrapper">
                <div className="git-diff-toolbar">
                  <div className="git-diff-meta">
                    <span className="git-diff-filename">{selected.path}</span>
                    {selected.original_path && (
                      <span className="git-diff-rename">da {selected.original_path}</span>
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
                          Stagia
                        </button>
                      )}
                      {selected.staged_status && (
                        <button type="button" onClick={() => onUnstage(selected)}>
                          Rimuovi dallo staging
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="git-diff-content">
                  {diffLoading ? (
                    <div className="git-empty">Calcolo diff…</div>
                  ) : diffError ? (
                    <div className="git-panel-error">{diffError}</div>
                  ) : (
                    <pre className="git-diff-code">
                      <code>{diffContent}</code>
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="git-empty git-diff-placeholder">
                Seleziona un file per vedere il diff
              </div>
            )}

            <div className="git-commit-box">
              <h3>Commit</h3>
              <textarea
                className="git-commit-message"
                placeholder="Messaggio di commit"
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
              />
              <button
                type="button"
                className="git-commit-button"
                onClick={onCommit}
                disabled={committing || commitMessage.trim().length === 0}
              >
                {committing ? 'Commit…' : 'Esegui commit'}
              </button>
            </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
