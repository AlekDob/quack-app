/**
 * useTerminal Hook
 *
 * Composable hook for managing a single XTerm.js instance
 * Handles initialization, resize, cleanup, and theme application
 *
 * IMPORTANT: This hook is designed to work WITHOUT React StrictMode
 * for the terminal window, because XTerm.js doesn't handle double-mounting well.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { ITheme } from '@xterm/xterm';

export interface UseTerminalOptions {
  /** Terminal ID from backend */
  terminalId: string;
  /** XTerm theme */
  theme: ITheme;
  /** Custom cursor color (overrides theme) */
  cursorColor?: string;
  /** Callback when terminal receives data */
  onData?: (data: string) => void;
  /** Callback when terminal exits */
  onExit?: () => void;
}

export interface UseTerminalReturn {
  /** Ref to attach to terminal container div */
  containerRef: React.RefObject<HTMLDivElement>;
  /** XTerm instance (null until initialized) */
  terminal: XTerm | null;
  /** Manually trigger resize */
  resize: () => void;
  /** Write data to terminal */
  write: (data: string) => void;
}

/**
 * Hook to manage a single XTerm instance
 *
 * Usage:
 * ```tsx
 * const { containerRef, terminal, resize } = useTerminal({
 *   terminalId: 'term-123',
 *   theme: TERMINAL_THEMES.dracula.colors,
 * });
 *
 * return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
 * ```
 */
export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const { terminalId, theme, cursorColor, onData, onExit } = options;

  // Refs for XTerm instance and addons
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Refs for cleanup functions
  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if component is mounted to prevent async operations after unmount
  const isMountedRef = useRef(true);

  // Track if terminal is initialized to prevent double initialization
  const isInitializedRef = useRef(false);

  /**
   * Initialize XTerm instance - runs ONCE on mount
   */
  useEffect(() => {
    // Prevent double initialization
    if (isInitializedRef.current) {
      console.log(`[useTerminal] Already initialized: ${terminalId}`);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      console.error(`[useTerminal] Container not found for: ${terminalId}`);
      return;
    }

    console.log(`[useTerminal] Initializing terminal: ${terminalId}`);
    isInitializedRef.current = true;
    isMountedRef.current = true;

    // Create XTerm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        ...theme,
        cursor: cursorColor || theme.cursor,
      },
      allowTransparency: false,
      scrollback: 10000,
      convertEol: true,
      fastScrollModifier: 'shift',
      allowProposedApi: true,
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    // Load addons BEFORE opening terminal
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal in container
    xterm.open(container);

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle user input - send to backend
    const dataDisposable = xterm.onData((data) => {
      if (!isMountedRef.current) return;
      invoke('write_to_terminal', { id: terminalId, data }).catch(console.error);
      onData?.(data);
    });

    // Setup backend event listeners (async)
    const setupListeners = async () => {
      if (!isMountedRef.current) return;

      // Listen for terminal output from backend
      const unlistenData = await listen<{ id: string; data: string }>('terminal-data', (event) => {
        if (event.payload.id === terminalId && xtermRef.current && isMountedRef.current) {
          xtermRef.current.write(event.payload.data);
        }
      });
      unlistenDataRef.current = unlistenData;

      // Listen for terminal exit
      const unlistenExit = await listen<{ id: string; code: number }>('terminal-exit', (event) => {
        if (event.payload.id === terminalId && isMountedRef.current) {
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\r\n[Process completed]\r\n');
          }
          onExit?.();
        }
      });
      unlistenExitRef.current = unlistenExit;
    };

    setupListeners();

    // Setup ResizeObserver for automatic resize
    const handleResize = () => {
      // Clear previous timer
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      // Debounce resize by 150ms
      resizeTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current || !fitAddonRef.current || !xtermRef.current) return;

        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          try {
            fitAddonRef.current.fit();
            syncDimensionsWithBackend(terminalId, xtermRef.current);
          } catch (error) {
            // Ignore errors during resize (renderer might not be ready)
            console.warn(`[useTerminal] Resize error:`, error);
          }
        }
      }, 150);
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    resizeObserverRef.current = observer;

    // Initial fit after a delay to ensure renderer is ready
    const initialFitTimer = setTimeout(() => {
      if (!isMountedRef.current || !fitAddonRef.current || !xtermRef.current) return;

      try {
        fitAddonRef.current.fit();
        syncDimensionsWithBackend(terminalId, xtermRef.current);
      } catch (error) {
        console.warn(`[useTerminal] Initial fit error:`, error);
      }
    }, 200);

    // Cleanup function
    return () => {
      console.log(`[useTerminal] Cleaning up terminal: ${terminalId}`);
      isMountedRef.current = false;

      // Clear timers
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      clearTimeout(initialFitTimer);

      // Disconnect ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Remove event listeners
      if (unlistenDataRef.current) {
        unlistenDataRef.current();
        unlistenDataRef.current = null;
      }
      if (unlistenExitRef.current) {
        unlistenExitRef.current();
        unlistenExitRef.current = null;
      }

      // Dispose XTerm data handler
      dataDisposable.dispose();

      // Dispose XTerm instance
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }

      // Clear refs
      fitAddonRef.current = null;
      isInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]); // Only re-run if terminalId changes

  /**
   * Update theme when it changes (without re-creating terminal)
   */
  useEffect(() => {
    if (xtermRef.current && isMountedRef.current) {
      xtermRef.current.options.theme = {
        ...theme,
        cursor: cursorColor || theme.cursor,
      };
    }
  }, [theme, cursorColor]);

  /**
   * Manual resize trigger
   */
  const resize = useCallback(() => {
    if (fitAddonRef.current && xtermRef.current && isMountedRef.current) {
      try {
        fitAddonRef.current.fit();
        syncDimensionsWithBackend(terminalId, xtermRef.current);
      } catch (error) {
        console.warn(`[useTerminal] Manual resize error:`, error);
      }
    }
  }, [terminalId]);

  /**
   * Write data to terminal
   */
  const write = useCallback((data: string) => {
    if (xtermRef.current && isMountedRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  return {
    containerRef,
    terminal: xtermRef.current,
    resize,
    write,
  };
}

/**
 * Sync XTerm dimensions with PTY backend
 * Called after every fit operation
 */
function syncDimensionsWithBackend(terminalId: string, xterm: XTerm) {
  const { cols, rows } = xterm;

  // Ignore invalid or default dimensions
  if (cols <= 0 || rows <= 0 || isNaN(cols) || isNaN(rows)) {
    return;
  }

  // Send resize command to backend
  invoke('resize_terminal', {
    id: terminalId,
    cols,
    rows,
  }).catch((error) => {
    console.error(`[useTerminal] Failed to sync dimensions:`, error);
  });

  console.log(`[useTerminal] Synced dimensions: ${terminalId} → ${cols}x${rows}`);
}
