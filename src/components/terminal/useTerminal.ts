/**
 * useTerminal Hook
 *
 * Composable hook for managing a single XTerm.js instance
 * Handles initialization, resize, cleanup, theme, search, filter, and clear
 *
 * IMPORTANT: This hook is designed to work WITHOUT React StrictMode
 * for the terminal window, because XTerm.js doesn't handle double-mount well.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
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
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** XTerm instance (null until initialized) */
  terminal: XTerm | null;
  /** Manually trigger resize */
  resize: () => void;
  /** Write data to terminal */
  write: (data: string) => void;
  /** Clear terminal scrollback and screen */
  clear: () => void;
  /** Search addon for find operations */
  searchAddon: SearchAddon | null;
  /** Whether filter mode is active */
  isFiltering: boolean;
  /** Activate filter mode with a search term */
  startFilter: (term: string) => void;
  /** Update filter term while filtering */
  updateFilter: (term: string) => void;
  /** Deactivate filter mode and restore content */
  stopFilter: () => void;
  /** Number of lines matching the current filter */
  filterMatchCount: number;
}

/**
 * Hook to manage a single XTerm instance
 */
export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const { terminalId, theme, cursorColor, onData, onExit } = options;

  // Refs for XTerm instance and addons
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const serializeAddonRef = useRef<SerializeAddon | null>(null);

  // Refs for cleanup functions
  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if component is mounted to prevent async operations after unmount
  const isMountedRef = useRef(true);

  // Track if terminal is initialized to prevent double initialization
  const isInitializedRef = useRef(false);

  // Refs for throttled write with requestAnimationFrame
  const writeBufferRef = useRef<string[]>([]);
  const rafScheduledRef = useRef(false);

  // Filter state
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterMatchCount, setFilterMatchCount] = useState(0);
  const filterTermRef = useRef<string>('');
  const savedBufferRef = useRef<string | null>(null);
  const incomingDuringFilterRef = useRef<string[]>([]);

  /**
   * Flush buffered writes to terminal (called via requestAnimationFrame)
   */
  const flushWrites = useCallback(() => {
    if (writeBufferRef.current.length > 0 && xtermRef.current && isMountedRef.current) {
      const chunk = writeBufferRef.current.join('');
      writeBufferRef.current = [];

      // If filtering, capture raw data and only show matching lines
      if (filterTermRef.current) {
        incomingDuringFilterRef.current.push(chunk);
        const lines = chunk.split(/\r?\n/);
        const term = filterTermRef.current.toLowerCase();
        const matching = lines.filter(l => l.toLowerCase().includes(term));
        if (matching.length > 0) {
          xtermRef.current.write(matching.join('\r\n') + '\r\n');
          setFilterMatchCount(prev => prev + matching.length);
        }
      } else {
        xtermRef.current.write(chunk);
      }
    }
    rafScheduledRef.current = false;
  }, []);

  /**
   * Throttled write using requestAnimationFrame
   * Batches multiple writes into a single render frame
   */
  const throttledWrite = useCallback(
    (data: string) => {
      writeBufferRef.current.push(data);
      if (!rafScheduledRef.current) {
        rafScheduledRef.current = true;
        requestAnimationFrame(flushWrites);
      }
    },
    [flushWrites]
  );

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
      scrollback: 1000,
      convertEol: true,
      fastScrollModifier: 'shift',
      allowProposedApi: true,
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    const serializeAddon = new SerializeAddon();

    // Load addons BEFORE opening terminal
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(serializeAddon);

    // Open terminal in container
    xterm.open(container);

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    serializeAddonRef.current = serializeAddon;

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
        if (event.payload.id === terminalId && isMountedRef.current) {
          // Use throttledWrite instead of direct write for better performance
          throttledWrite(event.payload.data);
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

      // Clear RAF for throttled writes
      if (rafScheduledRef.current) {
        rafScheduledRef.current = false;
        writeBufferRef.current = [];
      }

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
      searchAddonRef.current = null;
      serializeAddonRef.current = null;
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

  /**
   * Clear terminal scrollback and visible content
   */
  const clear = useCallback(() => {
    if (xtermRef.current && isMountedRef.current) {
      xtermRef.current.clear();
    }
  }, []);

  /**
   * Start filter mode - shows only lines matching the term
   */
  const startFilter = useCallback((term: string) => {
    const xterm = xtermRef.current;
    const serializeAddon = serializeAddonRef.current;
    if (!xterm || !serializeAddon || !isMountedRef.current) return;

    // Save current buffer content (serialized with ANSI sequences for full restoration)
    const savedBuffer = serializeAddon.serialize();
    savedBufferRef.current = savedBuffer;
    incomingDuringFilterRef.current = [];
    filterTermRef.current = term;
    setIsFiltering(true);

    // Filter lines from serialized buffer (preserves ANSI colors, consistent with updateFilter)
    const allLines = savedBuffer.split(/\r?\n/);
    const lowerTerm = term.toLowerCase();
    const matching = allLines.filter(l => l.toLowerCase().includes(lowerTerm));

    setFilterMatchCount(matching.length);

    // Clear terminal and write only matching lines
    xterm.reset();
    if (matching.length > 0) {
      xterm.write(matching.join('\r\n') + '\r\n');
    }
  }, []);

  /**
   * Update filter term while already filtering
   */
  const updateFilter = useCallback((term: string) => {
    const xterm = xtermRef.current;
    const savedBuffer = savedBufferRef.current;
    if (!xterm || savedBuffer === null || !isMountedRef.current) return;

    filterTermRef.current = term;

    if (!term) {
      // Empty term - restore everything
      xterm.reset();
      xterm.write(savedBuffer);
      for (const chunk of incomingDuringFilterRef.current) {
        xterm.write(chunk);
      }
      setFilterMatchCount(0);
      return;
    }

    // Re-parse original buffer lines from the serialized content
    // The serialized content is plain text with ANSI sequences
    const originalLines = savedBuffer.split(/\r?\n/);
    // Also include lines from incoming data during filter
    const incomingLines = incomingDuringFilterRef.current.flatMap(c => c.split(/\r?\n/));
    const allLines = [...originalLines, ...incomingLines];

    const lowerTerm = term.toLowerCase();
    const matching = allLines.filter(l => l.toLowerCase().includes(lowerTerm));

    setFilterMatchCount(matching.length);

    xterm.reset();
    if (matching.length > 0) {
      xterm.write(matching.join('\r\n') + '\r\n');
    }
  }, []);

  /**
   * Stop filter mode and restore full content
   */
  const stopFilter = useCallback(() => {
    const xterm = xtermRef.current;
    const savedBuffer = savedBufferRef.current;
    if (!xterm || !isMountedRef.current) return;

    filterTermRef.current = '';
    setIsFiltering(false);
    setFilterMatchCount(0);

    if (savedBuffer !== null) {
      // Restore original content + anything that came in during filtering
      xterm.reset();
      xterm.write(savedBuffer);
      for (const chunk of incomingDuringFilterRef.current) {
        xterm.write(chunk);
      }
    }

    savedBufferRef.current = null;
    incomingDuringFilterRef.current = [];
  }, []);

  return {
    containerRef,
    terminal: xtermRef.current,
    resize,
    write,
    clear,
    searchAddon: searchAddonRef.current,
    isFiltering,
    startFilter,
    updateFilter,
    stopFilter,
    filterMatchCount,
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
