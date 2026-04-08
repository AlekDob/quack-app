/**
 * EditorHeader
 *
 * Top bar: file path breadcrumb, mode indicator, action buttons.
 *
 * @module EditorHeader
 */

// Brain: pattern-code-editor-tab
import { useEditorStore } from '../../stores/editorStore';
import EditorIDEDropdown from './EditorIDEDropdown';

// Brain: gotcha-windows-path-separators
/** Extract path segments for breadcrumb display (cross-platform) */
function buildBreadcrumb(filePath: string): string[] {
  const parts = filePath.split(/[\\/]/);
  return parts.length > 3 ? ['...', ...parts.slice(-3)] : parts;
}

interface EditorHeaderProps {
  outlineOpen?: boolean;
  onToggleOutline?: () => void;
  isMarkdown?: boolean;
  previewOpen?: boolean;
  onTogglePreview?: () => void;
}

function EditorHeader({ outlineOpen, onToggleOutline, isMarkdown, previewOpen, onTogglePreview }: EditorHeaderProps) {
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
        <div className="editor-breadcrumb">
          {breadcrumb.map((segment, i) => (
            <span key={i} className="editor-breadcrumb-segment">
              {i > 0 && <span className="editor-breadcrumb-separator">/</span>}
              {segment}
            </span>
          ))}
        </div>
        {isDirty && <span className="editor-dirty-dot" title="Non salvato" />}
        <span className={`editor-mode-badge ${isDiffMode ? 'diff' : previewOpen ? 'preview' : ''}`}>
          {isDiffMode ? 'Revisione modifiche' : previewOpen ? 'Anteprima' : 'Modifica'}
        </span>
      </div>
      <div className="editor-header-right">
        {isEditMode && (
          <>
            {isMarkdown && (
              <button
                type="button"
                className={`editor-btn editor-btn-preview${previewOpen ? ' active' : ''}`}
                onClick={onTogglePreview}
                title="Toggle Markdown preview"
              >
                Preview
              </button>
            )}
            <button
              type="button"
              className={`editor-btn editor-btn-outline${outlineOpen ? ' active' : ''}`}
              onClick={onToggleOutline}
              title="Toggle Outline panel — shows file structure (functions, classes, variables)"
            >
              Outline
            </button>
            <button
              type="button"
              className="editor-btn editor-btn-save"
              onClick={() => save()}
              disabled={!isDirty}
            >
              Salva
            </button>
            <EditorIDEDropdown filePath={filePath} />
          </>
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
