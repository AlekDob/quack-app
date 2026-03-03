import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DirectoryEntry } from '../types';

const MAX_CACHED_DIRS = 100;

interface FileSystemState {
  // Explorer state
  explorerPath: string;
  explorerTree: Record<string, DirectoryEntry[]>;
  explorerTreeOrder: string[];
  explorerRoot: string | null;
  loadingExplorer: boolean;
  explorerError: string | null;
  expandedDirs: Set<string>;
  selectedFile: string | null;

  // File preview state
  previewFile: string | null;
  previewContent: string | null;
  previewLoading: boolean;

  // Editor selection state (for IDE context injection into agent chats)
  editorSelection: {
    filePath: string;
    language: string;
    selectedText: string;
    startLine: number;
    endLine: number;
  } | null;

  // Actions - Explorer
  setExplorerPath: (path: string) => void;
  setExplorerTree: (tree: Record<string, DirectoryEntry[]>) => void;
  addToExplorerTree: (path: string, entries: DirectoryEntry[]) => void;
  setExplorerRoot: (root: string | null) => void;
  setLoadingExplorer: (loading: boolean) => void;
  setExplorerError: (error: string | null) => void;

  // Actions - Directory expansion
  expandDir: (path: string) => void;
  collapseDir: (path: string) => void;
  toggleDirExpansion: (path: string) => void;
  clearExpandedDirs: () => void;

  // Actions - File selection
  setSelectedFile: (file: string | null) => void;

  // Actions - File preview
  setPreviewFile: (file: string | null) => void;
  setPreviewContent: (content: string | null) => void;
  setPreviewLoading: (loading: boolean) => void;
  clearPreview: () => void;

  // Actions - Editor selection
  setEditorSelection: (selection: FileSystemState['editorSelection']) => void;
  clearEditorSelection: () => void;

  // External IDE context (from WebSocket connection to VS Code, Cursor, etc.)
  externalIdeContext: {
    activeFile: string | null;
    selection: {
      filePath: string;
      language: string;
      text: string;
      startLine: number;
      endLine: number;
      startChar: number;
      endChar: number;
    } | null;
    ideName: string;
  } | null;
  setExternalIdeContext: (ctx: FileSystemState['externalIdeContext']) => void;

  // IDE context injection toggle
  ideContextEnabled: boolean;
  toggleIdeContext: () => void;

  // Selectors
  getDirectoryEntries: (path: string) => DirectoryEntry[] | undefined;
  isDirExpanded: (path: string) => boolean;
  isFileSelected: (path: string) => boolean;
}

export const useFileSystemStore = create<FileSystemState>()(
  devtools((set, get) => ({
    // Initial state
    explorerPath: '',
    explorerTree: {},
    explorerTreeOrder: [],
    explorerRoot: null,
    loadingExplorer: false,
    explorerError: null,
    expandedDirs: new Set(),
    selectedFile: null,
    previewFile: null,
    previewContent: null,
    previewLoading: false,
    editorSelection: null,
    externalIdeContext: null,
    ideContextEnabled: true,

    // Explorer actions
    setExplorerPath: (path) => set({ explorerPath: path }),

    setExplorerTree: (tree) => set({ explorerTree: tree }),

    addToExplorerTree: (path, entries) => set((state) => {
      const newOrder = state.explorerTreeOrder.filter((p) => p !== path);
      newOrder.push(path);

      const newTree = { ...state.explorerTree, [path]: entries };

      if (newOrder.length > MAX_CACHED_DIRS) {
        const evicted = newOrder.shift()!;
        delete newTree[evicted];
      }

      return { explorerTree: newTree, explorerTreeOrder: newOrder };
    }),

    setExplorerRoot: (root) => set({
      explorerRoot: root,
      explorerTreeOrder: [],
      expandedDirs: new Set(),
      selectedFile: null,
    }),

    setLoadingExplorer: (loading) => set({ loadingExplorer: loading }),

    setExplorerError: (error) => set({ explorerError: error }),

    // Directory expansion actions
    expandDir: (path) => set((state) => {
      const newExpanded = new Set(state.expandedDirs);
      newExpanded.add(path);
      return { expandedDirs: newExpanded };
    }),

    collapseDir: (path) => set((state) => {
      const newExpanded = new Set(state.expandedDirs);
      newExpanded.delete(path);
      // Also collapse all subdirectories
      newExpanded.forEach((dir) => {
        if (dir.startsWith(path + '/')) {
          newExpanded.delete(dir);
        }
      });
      return { expandedDirs: newExpanded };
    }),

    toggleDirExpansion: (path) => {
      const state = get();
      if (state.expandedDirs.has(path)) {
        state.collapseDir(path);
      } else {
        state.expandDir(path);
      }
    },

    clearExpandedDirs: () => set({ expandedDirs: new Set() }),

    // File selection actions
    setSelectedFile: (file) => set({ selectedFile: file }),

    // File preview actions
    setPreviewFile: (file) => set({ previewFile: file }),

    setPreviewContent: (content) => set({ previewContent: content }),

    setPreviewLoading: (loading) => set({ previewLoading: loading }),

    clearPreview: () => set({
      previewFile: null,
      previewContent: null,
      previewLoading: false,
    }),

    // Editor selection actions
    setEditorSelection: (selection) => set({ editorSelection: selection }),
    clearEditorSelection: () => set({ editorSelection: null }),

    // External IDE context
    setExternalIdeContext: (ctx) => set({ externalIdeContext: ctx }),

    // IDE context toggle
    toggleIdeContext: () => set((state) => ({ ideContextEnabled: !state.ideContextEnabled })),

    // Selectors
    getDirectoryEntries: (path) => {
      const state = get();
      return state.explorerTree[path];
    },

    isDirExpanded: (path) => {
      const state = get();
      return state.expandedDirs.has(path);
    },

    isFileSelected: (path) => {
      const state = get();
      return state.selectedFile === path;
    },
  }), { name: 'filesystem-store' })
);