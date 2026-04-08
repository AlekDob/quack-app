/**
 * CodeEditorView
 *
 * Main orchestrator for the integrated code editor tab.
 * Composes EditorHeader + EditorContent + EditorOutlinePanel + EditorStatusBar.
 * Shows EditorEmptyState when no file is open.
 *
 * @module CodeEditorView
 */

// Brain: pattern-code-editor-tab
import { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { getLanguageFromFilename } from '../../utils/languageDetection';
import EditorEmptyState from './EditorEmptyState';
import EditorHeader from './EditorHeader';
import EditorContent from './EditorContent';
import EditorOutlinePanel from './EditorOutlinePanel';
import EditorStatusBar from './EditorStatusBar';
import type { EditorSelectionInfo } from './editorTypes';
import './CodeEditorView.css';

function CodeEditorView() {
  const filePath = useEditorStore(s => s.filePath);
  const isLoading = useEditorStore(s => s.isLoading);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isMarkdown = filePath ? /\.(md|markdown)$/i.test(filePath) : false;

  // Reset preview when file changes
  useEffect(() => {
    setPreviewOpen(false);
  }, [filePath]);

  const handleSelectionChange = useCallback((sel: EditorSelectionInfo | null) => {
    if (!sel || !filePath) {
      useFileSystemStore.getState().clearEditorSelection();
      return;
    }
    useFileSystemStore.getState().setEditorSelection({
      filePath,
      language: getLanguageFromFilename(filePath),
      selectedText: sel.selectedText,
      startLine: sel.startLine,
      endLine: sel.endLine,
    });
  }, [filePath]);

  const handleNavigateToLine = useCallback((_line: number) => {
    // TODO: wire to CodeEditorEngine imperative ref for scroll-to-line
  }, []);

  if (!filePath && !isLoading) {
    return <EditorEmptyState />;
  }

  return (
    <div className="code-editor-view">
      <EditorHeader
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen(o => !o)}
        isMarkdown={isMarkdown}
        previewOpen={previewOpen}
        onTogglePreview={() => setPreviewOpen(p => !p)}
      />
      <div className="editor-body">
        <EditorContent onSelectionChange={handleSelectionChange} previewOpen={previewOpen} />
        {outlineOpen && !previewOpen && (
          <EditorOutlinePanel onNavigateToLine={handleNavigateToLine} />
        )}
      </div>
      <EditorStatusBar />
    </div>
  );
}

export default CodeEditorView;
