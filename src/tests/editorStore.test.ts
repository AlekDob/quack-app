/**
 * editorStore Tests
 *
 * Unit tests for the editor Zustand store.
 * Tests file open/save, diff mode, editFile resolution, and dirty detection.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { useEditorStore } from '../stores/editorStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);
const mockEmit = vi.mocked(emit);

describe('editorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
  });

  describe('openFile', () => {
    it('should load file content and set edit mode', async () => {
      mockInvoke.mockResolvedValueOnce('const x = 1;');

      await useEditorStore.getState().openFile('/test/file.ts');

      const state = useEditorStore.getState();
      expect(state.filePath).toBe('/test/file.ts');
      expect(state.content).toBe('const x = 1;');
      expect(state.originalContent).toBe('const x = 1;');
      expect(state.mode).toBe('edit');
      expect(state.isDirty).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('read_file_content', { path: '/test/file.ts' });
    });

    it('should handle read errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('File not found'));

      await useEditorStore.getState().openFile('/bad/path.ts');

      const state = useEditorStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.filePath).toBeNull();
    });
  });

  describe('updateContent', () => {
    it('should set isDirty when content differs from original', async () => {
      mockInvoke.mockResolvedValueOnce('original');
      await useEditorStore.getState().openFile('/test.ts');

      useEditorStore.getState().updateContent('modified');

      expect(useEditorStore.getState().isDirty).toBe(true);
      expect(useEditorStore.getState().content).toBe('modified');
    });

    it('should clear isDirty when content matches original', async () => {
      mockInvoke.mockResolvedValueOnce('original');
      await useEditorStore.getState().openFile('/test.ts');

      useEditorStore.getState().updateContent('modified');
      expect(useEditorStore.getState().isDirty).toBe(true);

      useEditorStore.getState().updateContent('original');
      expect(useEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe('save', () => {
    it('should write file and reset isDirty', async () => {
      mockInvoke.mockResolvedValueOnce('original');
      await useEditorStore.getState().openFile('/test.ts');

      useEditorStore.getState().updateContent('modified');
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useEditorStore.getState().save();

      expect(result).toBe(true);
      expect(useEditorStore.getState().isDirty).toBe(false);
      expect(mockInvoke).toHaveBeenCalledWith('write_file_content', {
        path: '/test.ts',
        content: 'modified',
      });
    });

    it('should return false when no file is open', async () => {
      const result = await useEditorStore.getState().save();
      expect(result).toBe(false);
    });
  });

  describe('openDiff', () => {
    it('should set diff mode with pending edit', () => {
      useEditorStore.getState().openDiff({
        filePath: '/test.ts',
        original: 'old content',
        proposed: 'new content',
        source: 'agent',
        sessionKey: 'sess-1',
        toolUseId: 'tool-1',
      });

      const state = useEditorStore.getState();
      expect(state.mode).toBe('diff');
      expect(state.filePath).toBe('/test.ts');
      expect(state.pendingEdit).not.toBeNull();
      expect(state.pendingEdit?.originalContent).toBe('old content');
      expect(state.pendingEdit?.proposedContent).toBe('new content');
      expect(state.pendingEdit?.source).toBe('agent');
    });
  });

  describe('resolveEdit', () => {
    beforeEach(() => {
      useEditorStore.getState().openDiff({
        filePath: '/test.ts',
        original: 'old',
        proposed: 'new',
        source: 'agent',
        sessionKey: 'sess-1',
        toolUseId: 'tool-1',
      });
    });

    it('should write file and emit response on accept', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      mockEmit.mockResolvedValueOnce(undefined);

      await useEditorStore.getState().resolveEdit('accept');

      expect(mockInvoke).toHaveBeenCalledWith('write_file_content', {
        path: '/test.ts',
        content: 'new',
      });
      expect(mockEmit).toHaveBeenCalledWith('edit-file-response', {
        action: 'accept',
        toolUseId: 'tool-1',
        sessionKey: 'sess-1',
      });
      expect(useEditorStore.getState().mode).toBe('edit');
      expect(useEditorStore.getState().pendingEdit).toBeNull();
      expect(useEditorStore.getState().content).toBe('new');
    });

    it('should emit rejection without writing on reject', async () => {
      mockEmit.mockResolvedValueOnce(undefined);

      await useEditorStore.getState().resolveEdit('reject');

      expect(mockInvoke).not.toHaveBeenCalledWith('write_file_content', expect.anything());
      expect(mockEmit).toHaveBeenCalledWith('edit-file-response', {
        action: 'reject',
        toolUseId: 'tool-1',
        sessionKey: 'sess-1',
      });
      expect(useEditorStore.getState().mode).toBe('edit');
      expect(useEditorStore.getState().content).toBe('old');
    });

    it('should switch to editable mode on edit action', async () => {
      await useEditorStore.getState().resolveEdit('edit');

      const state = useEditorStore.getState();
      expect(state.mode).toBe('edit');
      expect(state.content).toBe('new');
      expect(state.isDirty).toBe(true);
      // pendingEdit still exists for potential re-resolution
    });

    it('should not emit response for changes-panel source', async () => {
      useEditorStore.getState().reset();
      useEditorStore.getState().openDiff({
        filePath: '/test.ts',
        original: 'old',
        proposed: 'new',
        source: 'changes-panel',
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useEditorStore.getState().resolveEdit('accept');

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      mockInvoke.mockResolvedValueOnce('content');
      await useEditorStore.getState().openFile('/test.ts');

      useEditorStore.getState().reset();

      const state = useEditorStore.getState();
      expect(state.filePath).toBeNull();
      expect(state.content).toBe('');
      expect(state.mode).toBe('edit');
      expect(state.isDirty).toBe(false);
      expect(state.pendingEdit).toBeNull();
    });
  });
});
