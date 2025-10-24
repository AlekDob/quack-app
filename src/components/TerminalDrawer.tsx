import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import '@xterm/xterm/css/xterm.css';
import TerminalToolBar from './TerminalToolBar';

// Global storage for xterm instances (outside React lifecycle)
// Key: terminalId, Value: xterm instance + cleanup functions
const terminalInstances = new Map<string, {
  xterm: XTerm;
  fitAddon: FitAddon;
  unlisten: () => void;
  unlistenExit: () => void;
}>();

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  terminalName: string;
  cwd: string;
  color: string;
  existingTerminalId?: string;
  onTerminalCreated?: (terminalId: string) => void;
  // TerminalToolBar props
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
}

export function TerminalDrawer({
  isOpen,
  onClose,
  terminalName,
  cwd,
  color,
  existingTerminalId,
  onTerminalCreated,
  onToggleSavedCommands,
  savedCommandsOpen,
}: TerminalDrawerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const currentTerminalIdRef = useRef<string | null>(existingTerminalId || null);

  // Initialize terminal ONLY ONCE when component first mounts
  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) {
      return;
    }

    const initTerminal = async () => {
      try {
        let terminalId: string;

        // Check if we have an existing terminal ID
        if (existingTerminalId && terminalInstances.has(existingTerminalId)) {
          // Terminal instance already exists in global storage
          terminalId = existingTerminalId;
          console.log('🦆 Reusing existing terminal instance:', terminalId);

          const instance = terminalInstances.get(terminalId)!;
          instance.xterm.open(terminalRef.current!);
          instance.fitAddon.fit();
        } else if (existingTerminalId) {
          // Backend terminal exists but no xterm instance yet
          terminalId = existingTerminalId;
          console.log('🦆 Creating xterm UI for existing backend terminal:', terminalId);

          await createXtermInstance(terminalId, terminalRef.current!);
        } else {
          // Create completely new terminal (backend + xterm)
          const terminalInfo = await invoke<{ id: string; label: string; color: string; cwd: string; alive: boolean }>('create_terminal', {
            label: terminalName,
            color,
            cwd,
          });

          terminalId = terminalInfo.id;
          console.log('🦆 Created new terminal:', terminalId);

          // Notify parent of the new terminal ID
          if (onTerminalCreated) {
            onTerminalCreated(terminalId);
          }

          await createXtermInstance(terminalId, terminalRef.current!);
        }

        currentTerminalIdRef.current = terminalId;
        initializedRef.current = true;

        // Handle window resize
        const handleResize = () => {
          const instance = terminalInstances.get(terminalId);
          if (instance) {
            instance.fitAddon.fit();
          }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup ONLY when component unmounts completely
        return () => {
          window.removeEventListener('resize', handleResize);
          // DON'T dispose xterm - it stays alive in global storage
        };
      } catch (error) {
        console.error('🦆 Failed to initialize terminal:', error);
      }
    };

    initTerminal();
  }, []); // Empty deps - run ONLY once on mount

  // Helper function to create a new xterm instance
  async function createXtermInstance(terminalId: string, container: HTMLDivElement) {
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: color,
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
    fitAddon.fit();

    // Handle terminal input
    xterm.onData((data) => {
      invoke('write_to_terminal', { id: terminalId, data }).catch(console.error);
    });

    // Listen for terminal output
    const unlisten = await listen<string>('terminal-data', (event) => {
      const payload = event.payload as any;
      if (payload.id === terminalId) {
        xterm.write(payload.data);
      }
    });

    // Listen for terminal exit
    const unlistenExit = await listen('terminal-exit', (event) => {
      const payload = event.payload as any;
      if (payload.id === terminalId) {
        xterm.write('\r\n\r\n[Process completed]\r\n');
      }
    });

    // Store in global storage
    terminalInstances.set(terminalId, {
      xterm,
      fitAddon,
      unlisten,
      unlistenExit,
    });
  }

  // Handle drawer close - just hide, don't destroy
  const handleClose = () => {
    onClose();
  };

  // Refit terminal when drawer opens (after animation completes)
  useEffect(() => {
    if (isOpen && currentTerminalIdRef.current) {
      // Wait for drawer animation to complete (300ms) + small buffer
      const timer = setTimeout(() => {
        const instance = terminalInstances.get(currentTerminalIdRef.current!);
        if (instance) {
          try {
            instance.fitAddon.fit();
            console.log('🦆 Terminal refitted after drawer open');
          } catch (error) {
            console.error('🦆 Failed to refit terminal:', error);
          }
        }
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div className={`terminal-drawer ${isOpen ? 'open' : ''}`}>
      {/* Backdrop */}
      <div className="terminal-drawer-backdrop" onClick={handleClose} />

      {/* Panel */}
      <div className="terminal-drawer-panel" style={{ width: '85vw' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <div>
              <h3 className="text-white font-medium">{terminalName}</h3>
              <p className="text-white/50 text-xs font-mono mt-0.5">{cwd}</p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all group"
            title="Close (ESC)"
          >
            <svg
              className="w-5 h-5 text-white/70 group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Terminal */}
        <div className="flex-1 bg-[#1e1e1e] overflow-hidden">
          <div ref={terminalRef} className="w-full h-full" style={{ padding: '8px' }} />
        </div>

        {/* Footer with TerminalToolBar */}
        <div className="border-t border-white/10 bg-[#181a21] flex justify-start">
          <TerminalToolBar
            onExecuteCommand={async (command, label) => {
              // Execute command in THIS drawer's terminal - simulating user typing
              const terminalId = currentTerminalIdRef.current;
              console.log(`🦆 Executing command in terminal ${terminalId}:`, command);

              if (!terminalId) {
                console.error('❌ No terminal ID available');
                return;
              }

              const instance = terminalInstances.get(terminalId);
              if (!instance) {
                console.error('❌ Terminal instance not found:', terminalId);
                return;
              }

              try {
                // ULTIMATE FIX: Simulate REAL user input by triggering xterm's textarea
                // This will automatically trigger onData handler which sends to PTY
                const textarea = instance.xterm.textarea;

                if (textarea) {
                  console.log('🦆 Simulating keyboard input via textarea...');

                  // Focus the textarea first
                  textarea.focus();
                  instance.xterm.focus();

                  // Method 1: Try simulating paste event (most reliable)
                  const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: new DataTransfer(),
                    bubbles: true,
                    cancelable: true
                  });

                  // Add text to clipboard data
                  try {
                    // @ts-ignore - clipboardData might be readonly
                    pasteEvent.clipboardData?.setData('text/plain', command + '\n');
                    textarea.dispatchEvent(pasteEvent);
                    console.log('✅ Paste event dispatched');
                  } catch (pasteError) {
                    console.warn('⚠️ Paste approach failed, trying character simulation...');

                    // Method 2: Fallback - simulate typing each character
                    for (const char of command) {
                      const keyEvent = new KeyboardEvent('keydown', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        bubbles: true,
                        cancelable: true
                      });
                      textarea.dispatchEvent(keyEvent);

                      // Also dispatch keypress for compatibility
                      const pressEvent = new KeyboardEvent('keypress', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        bubbles: true,
                        cancelable: true
                      });
                      textarea.dispatchEvent(pressEvent);

                      // Small delay to simulate real typing
                      await new Promise(resolve => setTimeout(resolve, 1));
                    }

                    // Simulate ENTER key
                    const enterEvent = new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      bubbles: true,
                      cancelable: true
                    });
                    textarea.dispatchEvent(enterEvent);
                    console.log('✅ Character simulation completed');
                  }

                  console.log(`✅ Command simulated: ${label} -> ${command}`);
                } else {
                  console.error('❌ Textarea not found on xterm instance');
                  // Fallback to old method if textarea not accessible
                  instance.xterm.write(command + '\r\n');
                  await invoke("write_to_terminal", {
                    id: terminalId,
                    data: command + '\r',
                  });
                }
              } catch (error) {
                console.error(`❌ Error executing command:`, error);
              }
            }}
            onToggleSavedCommands={onToggleSavedCommands}
            savedCommandsOpen={savedCommandsOpen}
          />
        </div>
      </div>
    </div>
  );
}

// Export function to completely destroy a terminal (called when removing from list)
export function disposeTerminal(terminalId: string) {
  const instance = terminalInstances.get(terminalId);
  if (instance) {
    console.log('🦆 Disposing terminal completely:', terminalId);
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
