/**
 * useCodeEditorTab
 *
 * Singleton hook for the integrated code editor tab.
 * Follows the same pattern as useKanbanTab and useAutomationTab.
 *
 * @module useCodeEditorTab
 */

// Brain: pattern-code-editor-tab
import { useCallback } from 'react';
import type { Tab } from '../components/TabBar';

interface UseCodeEditorTabReturn {
  openCodeEditorTab: (filePath?: string) => Tab;
  isCodeEditorTab: (tab: Tab) => boolean;
}

/** Extract filename from a full path */
function extractFilename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || 'Editor';
}

/**
 * Hook to manage the Code Editor tab (singleton).
 * Only one editor tab exists at a time.
 */
export function useCodeEditorTab(): UseCodeEditorTabReturn {
  const openCodeEditorTab = useCallback((filePath?: string): Tab => {
    const label = filePath ? extractFilename(filePath) : 'Editor';
    return {
      id: 'code-editor',
      label,
      type: 'code-editor',
      closable: true,
      editorFilePath: filePath,
    };
  }, []);

  const isCodeEditorTab = useCallback((tab: Tab): boolean => {
    return tab.type === 'code-editor';
  }, []);

  return { openCodeEditorTab, isCodeEditorTab };
}
