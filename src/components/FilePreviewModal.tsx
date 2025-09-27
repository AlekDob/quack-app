interface FilePreviewModalProps {
  open: boolean
  filename: string | null
  content: string
  loading: boolean
  error: string | null
  onClose: () => void
}

export default function FilePreviewModal({
  open,
  filename,
  content,
  loading,
  error,
  onClose,
}: FilePreviewModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="preview-backdrop" role="dialog" aria-modal="true">
      <div className="preview-panel">
        <header className="preview-toolbar">
          <div className="preview-meta">
            <span className="preview-filename">{filename ?? 'File'}</span>
            {loading && <span className="preview-status">Caricamento…</span>}
            {error && !loading && <span className="preview-error">{error}</span>}
          </div>
          <button type="button" className="preview-close" onClick={onClose}>
            Chiudi
          </button>
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
