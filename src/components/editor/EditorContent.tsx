/**
 * EditorContent
 *
 * Switches between normal edit mode (CodeEditorEngine)
 * and diff mode (CodeMirrorMergeView).
 *
 * @module EditorContent
 */

// Brain: pattern-code-editor-tab
import { lazy, Suspense, useRef, useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import CodeEditorSkeleton from '../skeletons/CodeEditorSkeleton';
import CodeEditorEngine from './CodeEditorEngine';
import type { CodeEditorRef } from './editorTypes';

const CodeMirrorMergeView = lazy(() => import('./CodeMirrorMergeView'));

function EditorContent() {
  const mode = useEditorStore(s => s.mode);
  const filePath = useEditorStore(s => s.filePath);
  const content = useEditorStore(s => s.content);
  const pendingEdit = useEditorStore(s => s.pendingEdit);
  const isLoading = useEditorStore(s => s.isLoading);
  const updateContent = useEditorStore(s => s.updateContent);
  const save = useEditorStore(s => s.save);
  const editorRef = useRef<CodeEditorRef>(null);

  const handleChange = useCallback((value: string) => {
    updateContent(value);
  }, [updateContent]);

  const handleSave = useCallback(() => {
    save();
  }, [save]);

  if (isLoading) {
    return <CodeEditorSkeleton />;
  }

  if (mode === 'diff' && pendingEdit) {
    return (
      <Suspense fallback={<CodeEditorSkeleton />}>
        <CodeMirrorMergeView
          original={pendingEdit.originalContent}
          modified={pendingEdit.proposedContent}
          filePath={pendingEdit.filePath}
        />
      </Suspense>
    );
  }

  return (
    <CodeEditorEngine
      ref={editorRef}
      content={content}
      filename={filePath}
      onChange={handleChange}
      onSave={handleSave}
    />
  );
}

export default EditorContent;
