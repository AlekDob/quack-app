interface FilePreviewDrawerProps {
  open: boolean
  filename: string | null
  path: string | null
  content: string
  loading: boolean
  error: string | null
  formatting: boolean
  onClose: () => void
  onRefresh: () => void
  onFormat: () => void
}

export default function FilePreviewDrawer({
  open,
  filename,
  path,
  content,
  loading,
  error,
  formatting,
  onClose,
  onRefresh,
  onFormat,
}: FilePreviewDrawerProps) {
  if (!open) {
    return null
  }

  return (
    <div className="preview-drawer" role="dialog" aria-modal="true">
      <div
        className="preview-drawer-backdrop"
        onClick={onClose}
        role="presentation"
      />
      <div className="preview-drawer-panel">
        <header className="preview-toolbar">
          <div className="preview-meta">
            <span className="preview-filename">{filename ?? 'File'}</span>
            {path && <span className="preview-path">{path}</span>}
            {loading && <span className="preview-status">Caricamento…</span>}
            {error && !loading && <span className="preview-error">{error}</span>}
          </div>
          <div className="preview-actions">
            <button
              type="button"
              className="preview-action"
              onClick={onRefresh}
              disabled={loading || formatting}
            >
              Ricarica
            </button>
            <button
              type="button"
              className="preview-action"
              onClick={onFormat}
              disabled={loading || formatting}
            >
              {formatting ? 'Formatto…' : 'Formatta'}
            </button>
            <button type="button" className="preview-close" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </header>
        <div className="preview-content" data-loading={loading}>
          {loading ? (
            <div className="preview-placeholder">Lettura file…</div>
          ) : error ? (
            <div className="preview-placeholder">{error}</div>
          ) : (
            <pre className="preview-code">
              <code>{content}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
