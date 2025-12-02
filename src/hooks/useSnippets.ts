import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Snippet, SnippetFormData } from '../types';

/**
 * Available dynamic variables for snippets
 */
export const SNIPPET_VARIABLES = [
  { key: '{date}', label: 'Current Date', example: '2025-01-15' },
  { key: '{time}', label: 'Current Time', example: '14:30' },
  { key: '{datetime}', label: 'Date & Time', example: '2025-01-15 14:30' },
  { key: '{clipboard}', label: 'Clipboard Content', example: '(paste from clipboard)' },
  { key: '{cursor}', label: 'Cursor Position', example: '(cursor here)' },
  { key: '{project}', label: 'Project Name', example: 'quack-app' },
  { key: '{branch}', label: 'Git Branch', example: 'feature/snippets' },
  { key: '{username}', label: 'Username', example: 'alekdob' },
] as const;

interface UseSnippetsReturn {
  snippets: Snippet[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  createSnippet: (data: SnippetFormData) => Promise<Snippet>;
  updateSnippet: (id: string, data: Partial<SnippetFormData>) => Promise<Snippet>;
  deleteSnippet: (id: string) => Promise<void>;

  // Search and lookup
  searchSnippets: (query: string) => Promise<Snippet[]>;
  getSnippetByTag: (tag: string) => Promise<Snippet | null>;

  // Import/Export
  importSnippets: (json: string) => Promise<number>;
  exportSnippets: () => Promise<string>;

  // Variable expansion
  expandVariables: (content: string, context?: ExpandContext) => Promise<string>;

  // Tag detection
  detectTag: (text: string, cursorPos: number) => DetectedTag | null;

  // Refresh
  refresh: () => Promise<void>;
}

interface ExpandContext {
  projectName?: string;
  gitBranch?: string;
  currentFile?: string;
  selection?: string;
}

interface DetectedTag {
  tag: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Hook for managing prompt snippets with dynamic variable support
 */
export function useSnippets(): UseSnippetsReturn {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load snippets on mount
  const loadSnippets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<Snippet[]>('list_snippets');
      setSnippets(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[useSnippets] Failed to load snippets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  // Create a new snippet
  const createSnippet = useCallback(async (data: SnippetFormData): Promise<Snippet> => {
    const snippet = await invoke<Snippet>('create_snippet', {
      name: data.name.trim(),
      content: data.content,
      tag: data.tag.trim().toLowerCase(),
    });

    setSnippets(prev => [...prev, snippet]);
    return snippet;
  }, []);

  // Update an existing snippet
  const updateSnippet = useCallback(async (
    id: string,
    data: Partial<SnippetFormData>
  ): Promise<Snippet> => {
    const snippet = await invoke<Snippet>('update_snippet', {
      id,
      name: data.name?.trim() || null,
      content: data.content || null,
      tag: data.tag?.trim().toLowerCase() || null,
    });

    setSnippets(prev => prev.map(s => s.id === id ? snippet : s));
    return snippet;
  }, []);

  // Delete a snippet
  const deleteSnippet = useCallback(async (id: string): Promise<void> => {
    await invoke('delete_snippet', { id });
    setSnippets(prev => prev.filter(s => s.id !== id));
  }, []);

  // Search snippets
  const searchSnippets = useCallback(async (query: string): Promise<Snippet[]> => {
    return invoke<Snippet[]>('search_snippets', { query });
  }, []);

  // Get snippet by tag
  const getSnippetByTag = useCallback(async (tag: string): Promise<Snippet | null> => {
    const result = await invoke<Snippet | null>('get_snippet_by_tag', { tag: tag.toLowerCase() });
    return result;
  }, []);

  // Import snippets from JSON
  const importSnippets = useCallback(async (json: string): Promise<number> => {
    const count = await invoke<number>('import_snippets', { json });
    await loadSnippets(); // Refresh list
    return count;
  }, [loadSnippets]);

  // Export snippets as JSON
  const exportSnippets = useCallback(async (): Promise<string> => {
    return invoke<string>('export_snippets');
  }, []);

  // Expand dynamic variables in content
  const expandVariables = useCallback(async (
    content: string,
    context?: ExpandContext
  ): Promise<string> => {
    let result = content;
    const now = new Date();

    // {date} - Current date
    result = result.replace(/{date}/gi, now.toISOString().split('T')[0]);

    // {time} - Current time
    result = result.replace(/{time}/gi,
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );

    // {datetime} - Date and time
    result = result.replace(/{datetime}/gi,
      `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
    );

    // {username} - System username
    if (result.includes('{username}')) {
      try {
        const username = await invoke<string>('get_current_username');
        result = result.replace(/{username}/gi, username);
      } catch {
        result = result.replace(/{username}/gi, 'user');
      }
    }

    // {clipboard} - Clipboard content (using web API)
    if (result.includes('{clipboard}')) {
      try {
        const clipboardText = await navigator.clipboard.readText();
        result = result.replace(/{clipboard}/gi, clipboardText || '');
      } catch {
        result = result.replace(/{clipboard}/gi, '');
      }
    }

    // Context-based variables
    if (context?.projectName) {
      result = result.replace(/{project}/gi, context.projectName);
    }

    if (context?.gitBranch) {
      result = result.replace(/{branch}/gi, context.gitBranch);
    }

    if (context?.currentFile) {
      result = result.replace(/{file}/gi, context.currentFile);
    }

    if (context?.selection) {
      result = result.replace(/{selection}/gi, context.selection);
    }

    // {cursor} - Remove marker, it's handled by the input component
    // Don't replace here, let the caller handle cursor positioning

    return result;
  }, []);

  // Detect if there's a tag at/before cursor position
  const detectTag = useCallback((text: string, cursorPos: number): DetectedTag | null => {
    if (!text || cursorPos <= 0) return null;

    // Look backwards from cursor to find potential tag
    // Tags are alphanumeric (no spaces)
    const textBeforeCursor = text.substring(0, cursorPos);

    // Find the start of the current word
    let wordStart = cursorPos;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = textBeforeCursor[i];
      if (/[\s\n]/.test(char)) {
        wordStart = i + 1;
        break;
      }
      if (i === 0) {
        wordStart = 0;
      }
    }

    const potentialTag = textBeforeCursor.substring(wordStart, cursorPos);

    // Check if this tag matches any snippet (case-insensitive)
    const matchingSnippet = snippets.find(
      s => s.tag.toLowerCase() === potentialTag.toLowerCase()
    );

    if (matchingSnippet && potentialTag.length > 0) {
      return {
        tag: potentialTag,
        startIndex: wordStart,
        endIndex: cursorPos,
      };
    }

    return null;
  }, [snippets]);

  return {
    snippets,
    loading,
    error,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    searchSnippets,
    getSnippetByTag,
    importSnippets,
    exportSnippets,
    expandVariables,
    detectTag,
    refresh: loadSnippets,
  };
}

/**
 * Get cursor position from expanded content
 * Returns the index where {cursor} was, or -1 if not found
 */
export function getCursorPosition(content: string): number {
  const cursorIndex = content.indexOf('{cursor}');
  return cursorIndex;
}

/**
 * Remove cursor marker from content
 */
export function removeCursorMarker(content: string): string {
  return content.replace(/{cursor}/gi, '');
}
