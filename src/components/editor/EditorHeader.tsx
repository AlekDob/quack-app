/**
 * EditorHeader
 *
 * Top bar: file path breadcrumb, mode indicator, action buttons.
 *
 * @module EditorHeader
 */

import { useEditorStore } from '../../stores/editorStore';

/** Extract path segments for breadcrumb display */
function buildBreadcrumb(filePath: string): string[] {
  const parts = filePath.split('/');
  // Show last 3 segments max
  return parts.length > 3 ? ['...', ...parts.slice(-3)] : parts;
}

function EditorHeader() {
  const filePath = useEditorStore(s => s.filePath);
  const mode = useEditorStore(s => s.mode);
  const isDirty = useEditorStore(s => s.isDirty);
  const pendingEdit = useEditorStore(s => s.pendingEdit);
  const save = useEditorStore(s => s.save);
  const resolveEdit = useEditorStore(s => s.resolveEdit);

  if (!filePath) return null;

  const breadcrumb = buildBreadcrumb(filePath);
  const isEditMode = mode === 'edit';
  const isDiffMode = mode === 'diff';

  return (
    <div className="editor-header">
      <div className="editor-header-left">
        {/* Breadcrumb */}
        <div className="editor-breadcrumb">
          {breadcrumb.map((segment, i) => (
            <span key={i} className="editor-breadcrumb-segment">
              {i > 0 && <span className="editor-breadcrumb-separator">/</span>}
              {segment}
            </span>
          ))}
        </div>
        {/* Dirty indicator */}
        {isDirty && <span className="editor-dirty-dot" title="Non salvato" />}
        {/* Mode badge */}
        <span className={`editor-mode-badge ${isDiffMode ? 'diff' : ''}`}>
          {isDiffMode ? 'Revisione modifiche' : 'Modifica'}
        </span>
      </div>
      <div className="editor-header-right">
        {isEditMode && (
          <button
            type="button"
            className="editor-btn editor-btn-save"
            onClick={() => save()}
            disabled={!isDirty}
          >
            Salva
          </button>
        )}
        {isDiffMode && pendingEdit && (
          <>
            <button
              type="button"
              className="editor-btn editor-btn-accept"
              onClick={() => resolveEdit('accept')}
            >
              Accetta
            </button>
            <button
              type="button"
              className="editor-btn editor-btn-reject"
              onClick={() => resolveEdit('reject')}
            >
              Rifiuta
            </button>
            <button
              type="button"
              className="editor-btn editor-btn-edit"
              onClick={() => resolveEdit('edit')}
            >
              Modifica
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default EditorHeader;
