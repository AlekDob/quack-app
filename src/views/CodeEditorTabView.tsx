/**
 * CodeEditorTabView
 *
 * Thin wrapper that renders CodeEditorView inside a tab.
 * Follows the same pattern as KanbanTabView and AutomationTabView.
 *
 * @module CodeEditorTabView
 */

// Brain: pattern-code-editor-tab
import { memo, lazy, Suspense } from 'react';
import type { Tab } from '../components/TabBar';
import CodeEditorSkeleton from '../components/skeletons/CodeEditorSkeleton';

const CodeEditorView = lazy(() => import('../components/editor/CodeEditorView'));

interface CodeEditorTabViewProps {
  tab: Tab;
  isActive: boolean;
}

function CodeEditorTabView({ tab, isActive }: CodeEditorTabViewProps) {
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
