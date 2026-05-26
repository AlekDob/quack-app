import type { GitStatusEntry } from '../types'
import InlineDiffView from './InlineDiffView'
import { useFileAttributionStore, type AttributionEntry } from '../stores/fileAttributionStore'
import { getAvatarUrl, getDuckdroidUrl } from '../utils/agentAvatars'
import './DiffDrawer.css'

type DiffView = 'worktree' | 'staged'

interface DiffDrawerProps {
  selected: GitStatusEntry | null
  diffContent: string
  diffLoading: boolean
  diffError: string | null
  diffView: DiffView
  rootPath?: string | null
  onDiffViewChange: (view: DiffView) => void
  onStage: (entry: GitStatusEntry) => void
  onUnstage: (entry: GitStatusEntry) => void
  onClose: () => void
}

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

function AttributionComments({ entries }: { entries: AttributionEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="diff-drawer-attribution">
      <div className="diff-drawer-attribution-title">
        Modified by {entries.length} agent session{entries.length !== 1 ? 's' : ''}
      </div>
      <div className="diff-drawer-attribution-list">
        {entries.map(e => (
          <div key={e.sessionId} className="diff-drawer-attribution-row">
            <img
              className="diff-drawer-attribution-avatar"
              src={e.agentAvatar ? getAvatarUrl(e.agentAvatar) : getDuckdroidUrl()}
              alt={e.agentName}
              loading="lazy"
            />
            <div className="diff-drawer-attribution-meta">
              <div className="diff-drawer-attribution-name">{e.agentName}</div>
              <div className="diff-drawer-attribution-detail">
                {e.editCount} edit{e.editCount !== 1 ? 's' : ''} · {formatRelativeTime(e.lastTs)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiffDrawer({
  selected,
  diffContent,
  diffLoading,
  diffError,
  diffView,
  rootPath,
  onDiffViewChange,
  onStage,
  onUnstage,
  onClose,
}: DiffDrawerProps) {
  const byPath = useFileAttributionStore(s => s.byPath)
  if (!selected) return null

  const absPath = rootPath && !selected.path.startsWith('/')
    ? `${rootPath.replace(/\/$/, '')}/${selected.path}`
    : selected.path
  const attributionMap = byPath.get(absPath)
  const attributions: AttributionEntry[] = attributionMap
    ? Array.from(attributionMap.values()).sort((a, b) => b.lastTs - a.lastTs)
    : []

  // Extract actual file path from diff content if available (more reliable than selected.path)
  const getFilePathFromDiff = () => {
    if (!diffContent) return selected.path;

    // Look for "diff --git a/path b/path" or "+++ b/path"
    const diffMatch = diffContent.match(/\+\+\+ b\/(.+?)(?:\n|$)/);
    if (diffMatch && diffMatch[1]) {
      return diffMatch[1];
    }

    return selected.path;
  };

  const displayPath = getFilePathFromDiff();

  return (
    <>
      {/* Backdrop */}
      <div className="diff-drawer-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="diff-drawer">
        {/* Header */}
        <div className="diff-drawer-header">
          <div className="diff-drawer-header-left">
            <span className="diff-drawer-filename">{displayPath}</span>
            {selected.original_path && (
              <span className="diff-drawer-rename">from {selected.original_path}</span>
            )}
          </div>
          <button
            type="button"
            className="diff-drawer-close"
            onClick={onClose}
            title="Close diff viewer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="diff-drawer-toolbar">
          {selected.staged_status && selected.unstaged_status && (
            <div className="diff-drawer-toggle">
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
          <div className="diff-drawer-actions">
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

        {/* Content */}
        <div className="diff-drawer-content">
          <AttributionComments entries={attributions} />
          <InlineDiffView
            diffContent={diffContent}
            loading={diffLoading}
            error={diffError}
          />
        </div>
      </div>
    </>
  )
}

export default DiffDrawer
