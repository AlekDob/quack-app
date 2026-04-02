/**
 * CodeEditorTabView
 *
 * Thin wrapper that renders CodeEditorView inside a tab.
 * Passes editorFilePath so the view syncs with the correct file.
 *
 * @module CodeEditorTabView
 */

// Brain: pattern-code-editor-tab
import { memo, lazy, Suspense, useEffect } from 'react';
import type { Tab } from '../components/TabBar';
import CodeEditorSkeleton from '../components/skeletons/CodeEditorSkeleton';

const CodeEditorView = lazy(() => import('../components/editor/CodeEditorView'));

interface CodeEditorTabViewProps {
  tab: Tab;
  isActive: boolean;
}

function CodeEditorTabView({ tab, isActive }: CodeEditorTabViewProps) {
  // Sync editor store when switching between code-editor tabs
  useEffect(() => {
    if (isActive && tab.editorFilePath) {
      import('../stores/editorStore').then(({ useEditorStore }) => {
        const store = useEditorStore.getState();
        if (store.filePath !== tab.editorFilePath) {
          store.openFile(tab.editorFilePath!);
        }
      });
    }
  }, [isActive, tab.editorFilePath]);

  if (!isActive || tab.type !== 'code-editor') {
    return null;
  }

  return (
    <div className="code-editor-tab-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={<CodeEditorSkeleton />}>
        <CodeEditorView />
      </Suspense>
    </div>
  );
}

export default memo(CodeEditorTabView);
