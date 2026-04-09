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
import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useShortcutsStore } from '../../stores/shortcutsStore';
import { getLanguageFromFilename } from '../../utils/languageDetection';
import EditorEmptyState from './EditorEmptyState';
import EditorHeader from './EditorHeader';
import EditorContent from './EditorContent';
import EditorOutlinePanel from './EditorOutlinePanel';
import EditorStatusBar from './EditorStatusBar';
import { outlineSupportedLanguages } from './editorLanguages';
import type { CodeEditorRef, EditorSelectionInfo } from './editorTypes';
import './CodeEditorView.css';

/** Build key string from KeyboardEvent matching shortcutsStore format */
function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push('Meta');
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  if (!['Meta', 'Control', 'Alt', 'Shift', 'Dead'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join('+');
}

function CodeEditorView() {
  const filePath = useEditorStore(s => s.filePath);
  const isLoading = useEditorStore(s => s.isLoading);
  const editorContentRef = useRef<CodeEditorRef>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isMarkdown = filePath ? /\.(md|mdx|markdown)$/i.test(filePath) : false;
  const isMermaid = filePath ? /\.mmd$/i.test(filePath) : false;
  const isHtml = filePath ? /\.html?$/i.test(filePath) : false;
  const hasPreview = isMarkdown || isMermaid || isHtml;
  const detectedLang = filePath ? getLanguageFromFilename(filePath) : '';
  const outlineAvailable = outlineSupportedLanguages.has(detectedLang);
  const save = useEditorStore(s => s.save);
  const isDirty = useEditorStore(s => s.isDirty);
  const shortcuts = useShortcutsStore(s => s.shortcuts);

  // Auto-open preview for Brain documentation files
  useEffect(() => {
    if (filePath && hasPreview && /[/\\]documentation[/\\]/.test(filePath)) {
      setPreviewOpen(true);
    }
  }, [filePath, hasPreview]);

  // Keyboard shortcuts: toggle preview (Cmd+Shift+P) + save (Cmd+S) in preview mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const previewKeys = shortcuts.toggleEditorPreview?.currentKeys || '';
      const saveKeys = shortcuts.editorSave?.currentKeys || '';
      const pressed = buildKeyString(e);

      if (pressed === previewKeys && hasPreview) {
        e.preventDefault();
        setPreviewOpen(p => !p);
        return;
      }

      // Save when in preview mode (CM handles it in edit mode)
      if (pressed === saveKeys && previewOpen && isDirty) {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, hasPreview, previewOpen, isDirty, save]);

  // Consume pending navigation line from store (set by symbol chip click)
  const pendingLine = useEditorStore(s => s.pendingNavigationLine);
  useEffect(() => {
    if (!pendingLine || isLoading) return;
    // Delay one frame to ensure CodeMirror EditorView is mounted after file load
    requestAnimationFrame(() => {
      editorContentRef.current?.navigateToLine(pendingLine);
      useEditorStore.getState().setPendingNavigationLine(null);
    });
  }, [pendingLine, isLoading]);

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

  const handleNavigateToLine = useCallback((line: number) => {
    editorContentRef.current?.navigateToLine(line);
  }, []);

  if (!filePath && !isLoading) {
    return <EditorEmptyState />;
  }

  return (
    <div className="code-editor-view">
      <EditorHeader
        outlineOpen={outlineOpen}
        onToggleOutline={() => setOutlineOpen(o => !o)}
        isMarkdown={hasPreview}
        previewOpen={previewOpen && hasPreview}
        onTogglePreview={() => setPreviewOpen(p => !p)}
        outlineAvailable={outlineAvailable}
      />
      <div className="editor-body">
        <EditorContent ref={editorContentRef} onSelectionChange={handleSelectionChange} previewOpen={previewOpen && hasPreview} isMermaid={isMermaid} isHtml={isHtml} />
        {outlineOpen && outlineAvailable && !(previewOpen && hasPreview) && (
          <EditorOutlinePanel onNavigateToLine={handleNavigateToLine} />
        )}
      </div>
      <EditorStatusBar />
    </div>
  );
}

export default CodeEditorView;
