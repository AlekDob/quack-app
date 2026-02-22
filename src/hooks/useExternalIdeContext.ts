import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { isMacOS } from '../utils/platform';
import type { ExternalIdeContext } from '../utils/ideContextBuilder';

const POLL_INTERVAL_MS = 5000;

/**
 * Polls the external IDE (VS Code, Cursor, etc.) for context via the
 * Claude Code extension WebSocket and stores it in fileSystemStore
 * so the ChatInput chip can display it.
 */
export function useExternalIdeContext(workspacePath: string | null) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isMacOS()) {
      useFileSystemStore.getState().setExternalIdeContext(null);
      return;
    }

    if (!workspacePath) {
      useFileSystemStore.getState().setExternalIdeContext(null);
      return;
    }

    const poll = async () => {
      try {
        const ctx = await invoke<ExternalIdeContext | null>(
          'get_ide_context',
          { workspacePath }
        );

        if (ctx) {
          useFileSystemStore.getState().setExternalIdeContext({
            activeFile: ctx.active_file,
            selection: ctx.selection
              ? {
                  filePath: ctx.selection.file_path,
                  language: ctx.selection.language,
                  text: ctx.selection.text,
                  startLine: ctx.selection.start_line,
                  endLine: ctx.selection.end_line,
                  startChar: ctx.selection.start_char,
                  endChar: ctx.selection.end_char,
                }
              : null,
            ideName: ctx.ide_name,
          });
        } else {
          useFileSystemStore.getState().setExternalIdeContext(null);
        }
      } catch {
        // External IDE not available — clear state silently
        useFileSystemStore.getState().setExternalIdeContext(null);
      }
    };

    // Initial fetch
    poll();

    // Poll periodically
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      useFileSystemStore.getState().setExternalIdeContext(null);
    };
  }, [workspacePath]);
}
