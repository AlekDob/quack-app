import type { DirectoryEntry } from '../types'

interface FileExplorerProps {
  path: string
  entries: DirectoryEntry[]
  loading: boolean
  error: string | null
  onNavigate: (path: string) => void
  onNavigateUp: () => void
  onRefresh: () => void
  onOpenFile: (entry: DirectoryEntry) => void
}

export default function FileExplorer({
  path,
  entries,
  loading,
  error,
  onNavigate,
  onNavigateUp,
  onRefresh,
  onOpenFile,
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
            <button
              key={entry.path}
              type="button"
              className={`file-row ${entry.is_dir ? 'directory' : 'file'}`}
              onClick={() => {
                if (entry.is_dir) {
                  onNavigate(entry.path)
                } else {
                  onOpenFile(entry)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  if (entry.is_dir) {
                    onNavigate(entry.path)
                  } else {
                    onOpenFile(entry)
                  }
                }
              }}
            >
              <span className="file-icon" aria-hidden="true">
                {entry.is_dir ? '📁' : entry.is_symlink ? '🔗' : '📄'}
              </span>
              <span className="name">{entry.name}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  )
}
