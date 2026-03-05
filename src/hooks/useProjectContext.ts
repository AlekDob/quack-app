import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Bookmark {
  id: string;
  title: string;
  url: string;
}

const SAVE_DEBOUNCE_MS = 500;

export function useProjectContext(rootPath: string) {
  const [notes, setNotes] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesRef = useRef<string | null>(null);

  const contextPath = `${rootPath}/.quack/context.md`;
  const bookmarksPath = `${rootPath}/.quack/bookmarks.json`;

  const ensureQuackDir = useCallback(async () => {
    try {
      await invoke('create_directory', { path: `${rootPath}/.quack` });
    } catch {
      // Directory likely already exists
    }
  }, [rootPath]);

  const loadNotes = useCallback(async () => {
    try {
      const exists = await invoke<boolean>('path_exists', { path: contextPath });
      if (exists) {
        const content = await invoke<string>('read_file_content', { path: contextPath });
        setNotes(content);
      }
    } catch (err) {
      console.error('[useProjectContext] Failed to load notes:', err);
    }
  }, [contextPath]);

  const loadBookmarks = useCallback(async () => {
    try {
      const exists = await invoke<boolean>('path_exists', { path: bookmarksPath });
      if (exists) {
        const content = await invoke<string>('read_file_content', { path: bookmarksPath });
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
        }
      }
    } catch (err) {
      console.error('[useProjectContext] Failed to load bookmarks:', err);
    }
  }, [bookmarksPath]);

  const loadContext = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    await ensureQuackDir();
    await Promise.all([loadNotes(), loadBookmarks()]);
    setLoading(false);
  }, [rootPath, ensureQuackDir, loadNotes, loadBookmarks]);

  // Load on mount / rootPath change
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const flushSave = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      await invoke('write_file_content', { path: contextPath, content });
      setSaveStatus('saved');
      pendingNotesRef.current = null;
    } catch (err) {
      console.error('[useProjectContext] Failed to save notes:', err);
      setSaveStatus('idle');
    }
  }, [contextPath]);

  const saveNotes = useCallback((content: string) => {
    pendingNotesRef.current = content;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      flushSave(content);
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (pendingNotesRef.current !== null) {
        invoke('write_file_content', {
          path: contextPath,
          content: pendingNotesRef.current,
        }).catch(() => {});
      }
    };
  }, [contextPath]);

  const updateNotes = useCallback((content: string) => {
    setNotes(content);
    saveNotes(content);
  }, [saveNotes]);

  const persistBookmarks = useCallback(async (updated: Bookmark[]) => {
    try {
      await ensureQuackDir();
      await invoke('write_file_content', {
        path: bookmarksPath,
        content: JSON.stringify(updated, null, 2),
      });
    } catch (err) {
      console.error('[useProjectContext] Failed to save bookmarks:', err);
    }
  }, [bookmarksPath, ensureQuackDir]);

  const addBookmark = useCallback(async (title: string, url: string) => {
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      title: title.trim(),
      url: url.trim(),
    };
    const updated = [...bookmarks, bookmark];
    setBookmarks(updated);
    await persistBookmarks(updated);
  }, [bookmarks, persistBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    await persistBookmarks(updated);
  }, [bookmarks, persistBookmarks]);

  const openBookmarkUrl = useCallback(async (url: string) => {
    try {
      await invoke('open_external_url', { url });
    } catch (err) {
      console.error('[useProjectContext] Failed to open URL:', err);
    }
  }, []);

  return {
    notes,
    bookmarks,
    loading,
    saveStatus,
    updateNotes,
    addBookmark,
    removeBookmark,
    openBookmarkUrl,
    loadContext,
  };
}
