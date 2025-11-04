import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import '@xterm/xterm/css/xterm.css';

// Global storage for xterm instances (outside React lifecycle)
const terminalInstances = new Map<string, {
  xterm: XTerm;
  fitAddon: FitAddon;
  unlisten: () => void;
  unlistenExit: () => void;
}>();

interface AgentTerminalTabProps {
  terminalId: string;
  color: string;
  isActive: boolean; // NEW: Tells us if this terminal is currently visible
}

export function AgentTerminalTab({ terminalId, color, isActive }: AgentTerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastFitTimeRef = useRef<number>(0);

  // Initialize terminal ONCE when component first mounts
  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) {
      return;
    }

    const initTerminal = async () => {
      try {
        console.log(`🦆 [AgentTerminalTab] Initializing terminal: ${terminalId}`);

        const instance = terminalInstances.get(terminalId);

        if (!instance) {
          // Create new xterm instance
          console.log(`🦆 [AgentTerminalTab] Creating new xterm instance: ${terminalId}`);
          await createXtermInstance(terminalId, terminalRef.current!, color);
          initializedRef.current = true;
        } else {
          console.log(`🦆 [AgentTerminalTab] Terminal already exists: ${terminalId}, re-attaching to new DOM element`);
          initializedRef.current = true;

          // Re-attach the xterm element to the new container
          // This is necessary because the component was unmounted/remounted during agent switch
          if (terminalRef.current && instance.xterm.element) {
            // Clear the container first
            terminalRef.current.innerHTML = '';
            // Append the existing xterm element (with its canvas and content)
            terminalRef.current.appendChild(instance.xterm.element);
            console.log(`🦆 [AgentTerminalTab] XTerm element re-attached to new container: ${terminalId}`);

            // Fit if active (using double RAF to ensure DOM is ready)
            if (isActive) {
              const rect = terminalRef.current.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    try {
                      instance.fitAddon.fit();
                      const { cols, rows } = instance.xterm;

                      // Sync dimensions with PTY backend
                      invoke('resize_terminal', { id: terminalId, cols, rows }).catch(console.error);

                      console.log(`🦆 [AgentTerminalTab] Re-attached terminal fitted: ${terminalId} - ${cols}x${rows}`);
                    } catch (error) {
                      console.error(`🦆 [AgentTerminalTab] Failed to fit after re-attach:`, error);
                    }
                  });
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`🦆 [AgentTerminalTab] Failed to initialize terminal:`, error);
      }
    };

    initTerminal();
  }, [terminalId, color, isActive]);

  // Handle fitting when terminal becomes active - usando RAF per stabilizzare il layout
  useEffect(() => {
    if (!isActive || !initializedRef.current) {
      return;
    }

    // Use double RAF to ensure opacity transition has completed
    let rafId1: number;
    let rafId2: number;
    const fitTerminal = () => {
      const instance = terminalInstances.get(terminalId);
      if (instance && terminalRef.current) {
        // Check that container has non-zero dimensions
        const rect = terminalRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          try {
            // Clear any cached dimensions to force fresh calculation
            instance.fitAddon.fit();

            const newCols = instance.xterm.cols;
            const newRows = instance.xterm.rows;

            // Sync dimensions with PTY backend
            invoke('resize_terminal', { id: terminalId, cols: newCols, rows: newRows }).catch(console.error);

            // Force refresh the entire viewport to redraw everything
            instance.xterm.refresh(0, instance.xterm.rows - 1);

            console.log(`🦆 [AgentTerminalTab] Terminal fitted on activation: ${terminalId} - Container: ${Math.floor(rect.width)}x${Math.floor(rect.height)}, Terminal: ${newCols} cols x ${newRows} rows`);
          } catch (error) {
            console.error(`🦆 [AgentTerminalTab] Failed to fit terminal:`, error);
          }
        } else {
          console.warn(`🦆 [AgentTerminalTab] Container has zero dimensions, retrying...`);
          // Retry after another frame
          rafId2 = requestAnimationFrame(fitTerminal);
        }
      }
    };

    // Wait for opacity transition, then use double RAF to ensure rendering is complete
    const timer = setTimeout(() => {
      rafId1 = requestAnimationFrame(() => {
        rafId2 = requestAnimationFrame(fitTerminal);
      });
    }, 100); // Increased delay to ensure opacity transition completes

    return () => {
      clearTimeout(timer);
      if (rafId1) cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
    };
  }, [isActive, terminalId]);

  // Handle window resize with debouncing (ONLY for active terminal)
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleWindowResize = () => {
      // Clear any pending resize timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Debounce resize events
      resizeTimeoutRef.current = window.setTimeout(() => {
        const instance = terminalInstances.get(terminalId);
        if (instance && terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect();

          if (rect.width > 0 && rect.height > 0) {
            const now = Date.now();
            const timeSinceLastFit = now - lastFitTimeRef.current;

            // Only fit if at least 300ms have passed since last fit
            if (timeSinceLastFit >= 300) {
              requestAnimationFrame(() => {
                try {
                  instance.fitAddon.fit();
                  const { cols, rows } = instance.xterm;

                  // Sync dimensions with PTY backend
                  invoke('resize_terminal', { id: terminalId, cols, rows }).catch(console.error);

                  lastFitTimeRef.current = Date.now();
                  console.log(`🦆 [AgentTerminalTab] Terminal refitted on window resize: ${terminalId} - Container: ${Math.floor(rect.width)}x${Math.floor(rect.height)}, Terminal: ${cols} cols x ${rows} rows`);
                } catch (error) {
                  console.error('Failed to fit terminal on resize:', error);
                }
              });
            } else {
              console.log(`🦆 [AgentTerminalTab] Skipping fit (too soon): ${terminalId}, ${timeSinceLastFit}ms since last fit`);
            }
          }
        }
      }, 200); // Debounce resize events
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isActive, terminalId]);

  // Helper function to create a new xterm instance
  async function createXtermInstance(termId: string, container: HTMLDivElement, termColor: string) {
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: termColor,
        cursorAccent: '#000000',
        selectionBackground: '#ffffff30',
      },
      allowTransparency: false,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(container);

    // Initial fit using RAF to ensure container has dimensions
    requestAnimationFrame(() => {
      const rect = container.getBoundingClientRect();
      console.log(`🦆 [AgentTerminalTab] Initial container size: ${Math.floor(rect.width)}x${Math.floor(rect.height)}`);
      if (rect.width > 0 && rect.height > 0) {
        try {
          fitAddon.fit();
          const { cols, rows } = xterm;

          // Sync dimensions with PTY backend
          invoke('resize_terminal', { id: termId, cols, rows }).catch(console.error);

          console.log(`🦆 [AgentTerminalTab] Initial fit result: ${cols} cols x ${rows} rows`);
        } catch (error) {
          console.error(`🦆 [AgentTerminalTab] Initial fit failed:`, error);
        }
      }
    });

    // Clear initial % symbol from zsh by writing a carriage return
    // This hides the zsh prompt mark that appears when there's no previous newline
    setTimeout(() => {
      xterm.write('\r');
    }, 50);

    // Handle terminal input
    xterm.onData((data) => {
      invoke('write_to_terminal', { id: termId, data }).catch(console.error);
    });

    // Listen for terminal output with zsh % symbol filtering
    const unlisten = await listen<string>('terminal-data', (event) => {
      const payload = event.payload as any;
      if (payload.id === termId) {
        let data = payload.data;

        // Filter out zsh's % prompt mark that appears when there's no previous newline
        // This symbol is displayed as an inverted % at the beginning of a line
        // Pattern: ESC[7m%ESC[27m (inverted %) followed by optional whitespace and newline
        data = data.replace(/\x1b\[7m%\x1b\[27m\s*[\r\n]*/g, '');

        // Also filter standalone % at start of line followed by newline
        data = data.replace(/^%\s*[\r\n]+/gm, '');

        xterm.write(data);
      }
    });

    // Listen for terminal exit
    const unlistenExit = await listen('terminal-exit', (event) => {
      const payload = event.payload as any;
      if (payload.id === termId) {
        xterm.write('\r\n\r\n[Process completed]\r\n');
      }
    });

    // Store in global storage
    terminalInstances.set(termId, {
      xterm,
      fitAddon,
      unlisten,
      unlistenExit,
    });

    console.log(`🦆 [AgentTerminalTab] XTerm instance created and stored: ${termId}`);
  }

  return (
    <div
      className="agent-terminal-tab"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: isActive ? 1 : 0, // Use opacity instead of visibility
        pointerEvents: isActive ? 'auto' : 'none', // Disable interactions when hidden
        zIndex: isActive ? 1 : -1,
        background: '#1e1e1e',
      }}
    >
      <div
        ref={terminalRef}
        className="agent-terminal-container"
        style={{
          width: '100%',
          height: '100%',
          background: '#1e1e1e',
          position: 'relative',
        }}
      />
    </div>
  );
}

// Export function to completely destroy a terminal (called when closing tab)
export function disposeAgentTerminalTab(terminalId: string) {
  const instance = terminalInstances.get(terminalId);
  if (instance) {
    console.log(`🦆 [AgentTerminalTab] Disposing terminal completely: ${terminalId}`);
    // Cleanup listeners
    instance.unlisten();
    instance.unlistenExit();
    // Dispose xterm instance
    instance.xterm.dispose();
    // Remove from global storage
    terminalInstances.delete(terminalId);
    // Close backend PTY
    invoke('close_terminal', { id: terminalId }).catch(console.error);
  }
}
