/**
 * CodeEditorView
 *
 * Main orchestrator for the integrated code editor tab.
 * Composes EditorHeader + EditorContent + EditorStatusBar.
 * Shows EditorEmptyState when no file is open.
 *
 * @module CodeEditorView
 */

// Brain: pattern-code-editor-tab
import { useEditorStore } from '../../stores/editorStore';
import EditorEmptyState from './EditorEmptyState';
import EditorHeader from './EditorHeader';
import EditorContent from './EditorContent';
import EditorStatusBar from './EditorStatusBar';
import './CodeEditorView.css';

function CodeEditorView() {
  const filePath = useEditorStore(s => s.filePath);
  const isLoading = useEditorStore(s => s.isLoading);

  if (!filePath && !isLoading) {
    return <EditorEmptyState />;
  }

  return (
    <div className="code-editor-view">
      <EditorHeader />
      <EditorContent />
      <EditorStatusBar />
    </div>
  );
}

export default CodeEditorView;
