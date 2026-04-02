/**
 * useCodeEditorTab Tests
 *
 * Unit tests for the code editor per-file tab hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCodeEditorTab, codeEditorTabId } from '../hooks/useCodeEditorTab';

describe('useCodeEditorTab', () => {
  it('should return openCodeEditorTab and isCodeEditorTab', () => {
    const { result } = renderHook(() => useCodeEditorTab());
    expect(result.current.openCodeEditorTab).toBeInstanceOf(Function);
    expect(result.current.isCodeEditorTab).toBeInstanceOf(Function);
  });

  describe('codeEditorTabId', () => {
    it('should generate consistent ID for a file path', () => {
      const id = codeEditorTabId('/test/file.ts');
      expect(id).toBe('code-editor-/test/file.ts');
    });
  });

  describe('openCodeEditorTab', () => {
    it('should create tab with per-file id when filePath provided', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab('/test/file.ts');

      expect(tab.id).toBe('code-editor-/test/file.ts');
      expect(tab.type).toBe('code-editor');
      expect(tab.closable).toBe(true);
    });

    it('should create tab with unique id when no filePath', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab();

      expect(tab.id).toMatch(/^code-editor-new-\d+$/);
      expect(tab.type).toBe('code-editor');
    });

    it('should use "Editor" as default label', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab();
      expect(tab.label).toBe('Editor');
    });

    it('should extract filename for label when filePath provided', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab('/Users/test/project/src/App.tsx');
      expect(tab.label).toBe('App.tsx');
    });

    it('should set editorFilePath on the tab', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab('/test/file.rs');
      expect(tab.editorFilePath).toBe('/test/file.rs');
    });

    it('should create different IDs for different files', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab1 = result.current.openCodeEditorTab('/a.ts');
      const tab2 = result.current.openCodeEditorTab('/b.ts');
      expect(tab1.id).not.toBe(tab2.id);
    });

    it('should create same ID for same file path', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab1 = result.current.openCodeEditorTab('/a.ts');
      const tab2 = result.current.openCodeEditorTab('/a.ts');
      expect(tab1.id).toBe(tab2.id);
    });
  });

  describe('isCodeEditorTab', () => {
    it('should return true for code-editor type', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const tab = result.current.openCodeEditorTab();
      expect(result.current.isCodeEditorTab(tab)).toBe(true);
    });

    it('should return false for other tab types', () => {
      const { result } = renderHook(() => useCodeEditorTab());
      const chatTab = { id: 'chat', label: 'Chat', type: 'chat' as const, closable: false };
      expect(result.current.isCodeEditorTab(chatTab)).toBe(false);
    });
  });
});
