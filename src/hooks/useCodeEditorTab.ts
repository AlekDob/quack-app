/**
 * useCodeEditorTab
 *
 * Per-file hook for the integrated code editor tab.
 * Each opened file gets its own tab with a unique ID.
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

/** Generate a unique tab ID for a file path */
export function codeEditorTabId(filePath: string): string {
  return `code-editor-${filePath}`;
}

/**
 * Hook to manage Code Editor tabs (one per file).
 * Each file gets its own tab with a unique ID.
 */
export function useCodeEditorTab(): UseCodeEditorTabReturn {
  const openCodeEditorTab = useCallback((filePath?: string): Tab => {
    const label = filePath ? extractFilename(filePath) : 'Editor';
    return {
      id: filePath ? codeEditorTabId(filePath) : `code-editor-new-${Date.now()}`,
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
