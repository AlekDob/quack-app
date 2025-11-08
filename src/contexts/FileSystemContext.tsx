import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import type { DirectoryEntry, DirectoryListing } from '../types';

interface FileSystemContextValue {
  // File explorer state
  explorerPath: string;
  explorerTree: Map<string, DirectoryEntry[]>;
  explorerRoot: string | null;
  loadingExplorer: boolean;
  explorerError: string | null;
  refreshExplorerTrigger: number;

  // Preview state
  previewFile: {
    path: string;
    name: string;
  } | null;
  previewContent: string;
  previewImageData: string | null;
  previewError: string | null;
  loadingPreview: boolean;
  previewHasUnsavedChanges: boolean;

  // Actions
  setExplorerPath: (path: string) => void;
  setExplorerRoot: (root: string | null) => void;
  loadDirectory: (path: string) => Promise<void>;
  refreshExplorer: () => void;
  loadFilePreview: (path: string, name: string) => Promise<void>;
  clearPreview: () => void;
  setPreviewContent: (content: string) => void;
  setPreviewHasUnsavedChanges: (hasChanges: boolean) => void;
  saveFile: (path: string, content: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;

  // Utilities
  getDirectoryContents: (path: string) => DirectoryEntry[] | undefined;
  isPathLoaded: (path: string) => boolean;
  formatFileSize: (bytes: number) => string;
}

const FileSystemContext = createContext<FileSystemContextValue | null>(null);

export const FileSystemProvider = ({ children }: { children: React.ReactNode }) => {
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerTree, setExplorerTree] = useState<Map<string, DirectoryEntry[]>>(new Map());
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [refreshExplorerTrigger, setRefreshExplorerTrigger] = useState(0);

  const [previewFile, setPreviewFile] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewImageData, setPreviewImageData] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHasUnsavedChanges, setPreviewHasUnsavedChanges] = useState(false);

  // Load directory contents
  const loadDirectory = useCallback(async (path: string) => {
    if (!path || loadingExplorer) return;

    setLoadingExplorer(true);
    setExplorerError(null);

    try {
      const listing = await invoke<DirectoryListing>('list_directory', { path });

      setExplorerTree(prev => {
        const newTree = new Map(prev);
        newTree.set(path, listing.entries);
        return newTree;
      });

      setExplorerPath(path);

      // Set root if not already set
      if (!explorerRoot) {
        setExplorerRoot(path);
      }
    } catch (error) {
      console.error('Failed to load directory:', error);
      setExplorerError(String(error));
      toast.error(`Failed to load directory: ${error}`);
    } finally {
      setLoadingExplorer(false);
    }
  }, [loadingExplorer, explorerRoot]);

  // Preview a file
  const loadFilePreview = useCallback(async (path: string, name: string) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewImageData(null);
    setPreviewHasUnsavedChanges(false);

    try {
      // Check if it's an image file
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
      const isImage = imageExtensions.some(ext => name.toLowerCase().endsWith(ext));

      if (isImage) {
        // For images, read as base64
        const base64 = await invoke<string>('read_file_base64', { path });
        setPreviewImageData(base64);
        setPreviewContent('');
      } else {
        // For text files, read as string
        const content = await invoke<string>('read_file_content', { path });
        setPreviewContent(content);
        setPreviewImageData(null);
      }

      setPreviewFile({ path, name });
    } catch (error) {
      console.error('Failed to preview file:', error);
      setPreviewError(String(error));
      toast.error(`Failed to preview file: ${error}`);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  // Clear preview
  const clearPreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewContent('');
    setPreviewImageData(null);
    setPreviewError(null);
    setPreviewHasUnsavedChanges(false);
  }, []);

  // Save file
  const saveFile = useCallback(async (path: string, content: string) => {
    try {
      await invoke('write_file', { path, content });
      setPreviewHasUnsavedChanges(false);
      toast.success('File saved successfully');
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(`Failed to save file: ${error}`);
      throw error;
    }
  }, []);

  // Select directory using dialog
  const selectDirectory = useCallback(async (): Promise<string | null> => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: explorerPath || undefined,
      });

      if (selected && typeof selected === 'string') {
        return selected;
      }
      return null;
    } catch (error) {
      console.error('Failed to select directory:', error);
      toast.error(`Failed to select directory: ${error}`);
      return null;
    }
  }, [explorerPath]);

  // Refresh explorer
  const refreshExplorer = useCallback(() => {
    setRefreshExplorerTrigger(prev => prev + 1);
  }, []);

  // Get directory contents from cache
  const getDirectoryContents = useCallback((path: string): DirectoryEntry[] | undefined => {
    return explorerTree.get(path);
  }, [explorerTree]);

  // Check if path is loaded
  const isPathLoaded = useCallback((path: string): boolean => {
    return explorerTree.has(path);
  }, [explorerTree]);

  // Format file size utility
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }, []);

  // Auto-refresh on trigger change
  useEffect(() => {
    if (refreshExplorerTrigger > 0 && explorerPath) {
      loadDirectory(explorerPath);
    }
  }, [refreshExplorerTrigger, explorerPath, loadDirectory]);

  // Load initial directory if set
  useEffect(() => {
    if (explorerPath && !isPathLoaded(explorerPath)) {
      loadDirectory(explorerPath);
    }
  }, [explorerPath, isPathLoaded, loadDirectory]);

  const value: FileSystemContextValue = {
    explorerPath,
    explorerTree,
    explorerRoot,
    loadingExplorer,
    explorerError,
    refreshExplorerTrigger,
    previewFile,
    previewContent,
    previewImageData,
    previewError,
    loadingPreview,
    previewHasUnsavedChanges,
    setExplorerPath,
    setExplorerRoot,
    loadDirectory,
    refreshExplorer,
    loadFilePreview,
    clearPreview,
    setPreviewContent,
    setPreviewHasUnsavedChanges,
    saveFile,
    selectDirectory,
    getDirectoryContents,
    isPathLoaded,
    formatFileSize,
  };

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
};

export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within FileSystemProvider');
  }
  return context;
};