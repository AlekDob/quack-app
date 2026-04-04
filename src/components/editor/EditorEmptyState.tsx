/**
 * EditorEmptyState
 *
 * Shown when no file is open in the editor tab.
 *
 * @module EditorEmptyState
 */

const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
const MOD_KEY = isMac ? 'Cmd' : 'Ctrl';

function EditorEmptyState() {
  return (
    <div className="editor-empty-state">
      <div className="editor-empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
      <p className="editor-empty-state-text">
        Nessun file aperto. Apri un file dal chat o usa {MOD_KEY}+P.
      </p>
    </div>
  );
}

export default EditorEmptyState;
