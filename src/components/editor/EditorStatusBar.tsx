/**
 * EditorStatusBar
 *
 * Bottom bar: cursor position, language, encoding, save status.
 *
 * @module EditorStatusBar
 */

import { useEditorStore } from '../../stores/editorStore';
import { getLanguageFromFilename } from '../../utils/languageDetection';

function EditorStatusBar() {
  const filePath = useEditorStore(s => s.filePath);
  const isDirty = useEditorStore(s => s.isDirty);
  const cursorPosition = useEditorStore(s => s.cursorPosition);

  if (!filePath) return null;

  const language = getLanguageFromFilename(filePath) || 'plaintext';

  return (
    <div className="editor-status-bar">
      <span className="editor-status-item">
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </span>
      <span className="editor-status-item editor-status-lang">
        {language}
      </span>
      <span className="editor-status-item">
        UTF-8
      </span>
      <span className={`editor-status-item ${isDirty ? 'editor-status-unsaved' : ''}`}>
        {isDirty ? 'Non salvato' : 'Salvato'}
      </span>
    </div>
  );
}

export default EditorStatusBar;
