/**
 * Editor Store
 *
 * Zustand store managing state for the integrated code editor tab.
 * Handles file open/save, diff mode, and editFile tool resolution.
 *
 * @module editorStore
 */

// Brain: pattern-code-editor-tab
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { EditorMode, PendingEdit, DiffRequest, EditFileResponse, CursorPosition, LineChange } from '../components/editor/editorTypes';
import { parseDiffToLineChanges } from '../components/editor/editorDiff';

interface EditorState {
  // File state
  filePath: string | null;
  content: string;
  originalContent: string;
  mode: EditorMode;
  isDirty: boolean;
  isLoading: boolean;

  // Diff state
  pendingEdit: PendingEdit | null;
  lineChanges: LineChange[];

  // Cursor
  cursorPosition: CursorPosition;

  // Actions
  openFile: (filePath: string, lineChanges?: LineChange[]) => Promise<void>;
  setLineChanges: (changes: LineChange[]) => void;
  updateContent: (content: string) => void;
  save: () => Promise<boolean>;
  openDiff: (request: DiffRequest) => void;
  resolveEdit: (action: 'accept' | 'reject' | 'edit') => Promise<void>;
  setCursorPosition: (pos: CursorPosition) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  filePath: null,
  content: '',
  originalContent: '',
  mode: 'edit' as EditorMode,
  isDirty: false,
  isLoading: false,
  pendingEdit: null,
  lineChanges: [] as LineChange[],
  cursorPosition: { line: 1, column: 1 },
};

export const useEditorStore = create<EditorState>()((set, get) => ({
  ...INITIAL_STATE,

  openFile: async (filePath: string, _lineChanges?: LineChange[]) => {
    set({ isLoading: true });
    try {
      const content = await invoke<string>('read_file_content', { path: filePath });

      // Compute real line changes from git diff (absolute line numbers)
      let resolvedChanges: LineChange[] = [];
      try {
        const diffOutput = await invoke<string>('git_diff', {
          path: filePath,
          staged: false,
          untracked: true,
        });
        if (diffOutput && diffOutput.trim()) {
          resolvedChanges = parseDiffToLineChanges(diffOutput);
        }
      } catch {
        // Git diff unavailable (not a git repo, etc.) — no highlighting
      }

      set({
        filePath,
        content,
        originalContent: content,
        mode: 'edit',
        isDirty: false,
        isLoading: false,
        pendingEdit: null,
        lineChanges: resolvedChanges,
      });
    } catch (error) {
      console.error('[editorStore] Failed to open file:', error);
      set({ isLoading: false });
    }
  },

  setLineChanges: (changes: LineChange[]) => {
    set({ lineChanges: changes });
  },

  updateContent: (content: string) => {
    const { originalContent } = get();
    set({ content, isDirty: content !== originalContent });
  },

  save: async () => {
    const { filePath, content } = get();
    if (!filePath) return false;
    try {
      await invoke('write_file_content', { path: filePath, content });
      set({ originalContent: content, isDirty: false });
      return true;
    } catch (error) {
      console.error('[editorStore] Failed to save:', error);
      return false;
    }
  },

  openDiff: (request: DiffRequest) => {
    set({
      filePath: request.filePath,
      content: request.proposed,
      originalContent: request.original,
      mode: 'diff',
      isDirty: false,
      isLoading: false,
      pendingEdit: {
        filePath: request.filePath,
        originalContent: request.original,
        proposedContent: request.proposed,
        source: request.source,
        sessionKey: request.sessionKey,
        toolUseId: request.toolUseId,
      },
    });
  },

  resolveEdit: async (action: 'accept' | 'reject' | 'edit') => {
    const { pendingEdit } = get();
    if (!pendingEdit) return;

    if (action === 'edit') {
      // Switch to editable mode with proposed content
      set({ mode: 'edit', content: pendingEdit.proposedContent, isDirty: true });
      return;
    }

    if (action === 'accept') {
      try {
        await invoke('write_file_content', {
          path: pendingEdit.filePath,
          content: pendingEdit.proposedContent,
        });
      } catch (error) {
        console.error('[editorStore] Failed to write accepted edit:', error);
      }
    }

    // Emit response to agent if this came from an agent tool call
    if (pendingEdit.source === 'agent' && pendingEdit.sessionKey && pendingEdit.toolUseId) {
      const response: EditFileResponse = {
        action,
        toolUseId: pendingEdit.toolUseId,
        sessionKey: pendingEdit.sessionKey,
      };
      await emit('edit-file-response', response);
    }

    // Return to normal mode
    const newContent = action === 'accept' ? pendingEdit.proposedContent : pendingEdit.originalContent;
    set({
      content: newContent,
      originalContent: newContent,
      mode: 'edit',
      isDirty: false,
      pendingEdit: null,
    });
  },

  setCursorPosition: (pos: CursorPosition) => {
    set({ cursorPosition: pos });
  },

  reset: () => {
    set(INITIAL_STATE);
  },
}));
