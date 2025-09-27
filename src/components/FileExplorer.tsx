import type { DirectoryEntry } from '../types'

interface FileExplorerProps {
  path: string
  entries: DirectoryEntry[]
  loading: boolean
  error: string | null
  onNavigate: (path: string) => void
  onNavigateUp: () => void
  onRefresh: () => void
}

export default function FileExplorer({
  path,
  entries,
  loading,
  error,
  onNavigate,
  onNavigateUp,
  onRefresh,
}: FileExplorerProps) {
  return (
    <aside className="file-explorer">
      <div className="explorer-header">
        <h2 className="explorer-title">Esplora file</h2>
        <span className="explorer-path">{path}</span>
        {error && <span className="explorer-error">{error}</span>}
        <div className="explorer-actions">
          <button
            type="button"
            className="explorer-button"
            onClick={onNavigateUp}
            disabled={loading}
          >
            Su
          </button>
          <button
            type="button"
            className="explorer-button"
            onClick={onRefresh}
            disabled={loading}
          >
            Aggiorna
          </button>
        </div>
      </div>

      <div className={`explorer-content ${loading ? 'loading' : ''}`}>
        {entries.length === 0 && !loading ? (
          <div className="empty-state">Cartella vuota</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              className={`file-row ${entry.is_dir ? 'directory' : ''}`}
              onClick={() => {
                if (entry.is_dir) {
                  onNavigate(entry.path)
                }
              }}
              role={entry.is_dir ? 'button' : undefined}
              tabIndex={entry.is_dir ? 0 : undefined}
              onKeyDown={(event) => {
                if (entry.is_dir && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onNavigate(entry.path)
                }
              }}
            >
              <span className="name">{entry.name}</span>
              {entry.is_dir && <span className="badge">Cartella</span>}
              {!entry.is_dir && entry.is_symlink && <span className="badge">Link</span>}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
