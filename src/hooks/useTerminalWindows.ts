import { useCallback, useState } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

interface TerminalWindowOptions {
  label?: string;
  cwd?: string;
  color?: string;
  width?: number;
  height?: number;
}

interface TerminalWindowInstance {
  id: string;
  label: string;
  window: WebviewWindow;
  terminalId: string;
}

export function useTerminalWindows() {
  const [windows, setWindows] = useState<TerminalWindowInstance[]>([]);
  const [creating, setCreating] = useState(false);

  const createTerminalWindow = useCallback(
    async (options: TerminalWindowOptions = {}) => {
      console.log('🦆 useTerminalWindows: createTerminalWindow called with options:', options);
      if (creating) {
        console.log('🦆 useTerminalWindows: Already creating, returning');
        return;
      }

      setCreating(true);

      try {
        const timestamp = Date.now();
        const windowLabel = options.label || `terminal-window-${timestamp}`;
        const terminalId = `term-${timestamp}`;
        console.log('🦆 useTerminalWindows: Generated windowLabel:', windowLabel, 'terminalId:', terminalId);

        // Create new terminal in Rust backend first
        console.log('🦆 useTerminalWindows: Getting home directory...');
        const cwd = options.cwd || await invoke<string>('get_home_directory');
        console.log('🦆 useTerminalWindows: cwd:', cwd);

        console.log('🦆 useTerminalWindows: Creating terminal in backend...');
        await invoke('create_terminal', {
          id: terminalId,
          label: windowLabel,
          cwd,
        });
        console.log('🦆 useTerminalWindows: Terminal created in backend');

        // Create new webview window with Tauri using terminal.html entry point
        console.log('🦆 useTerminalWindows: Creating WebviewWindow...');
        const webview = new WebviewWindow(windowLabel, {
          url: `terminal.html?terminal=${terminalId}&cwd=${encodeURIComponent(cwd)}&color=${encodeURIComponent(options.color || 'var(--accent-color)')}`,
          title: windowLabel,
          width: options.width || 1200,
          height: options.height || 800,
          minWidth: 800,
          minHeight: 600,
          center: true,
          decorations: true,
          resizable: true,
          focus: true,
        });

        // Wait for window to load
        console.log('🦆 useTerminalWindows: Waiting for tauri://created event...');
        await webview.once('tauri://created', () => {
          console.log('🦆 useTerminalWindows: Terminal window created:', windowLabel);
        });
        console.log('🦆 useTerminalWindows: tauri://created event received');

        const instance: TerminalWindowInstance = {
          id: windowLabel,
          label: windowLabel,
          window: webview,
          terminalId,
        };

        setWindows((prev) => [...prev, instance]);

        // Listen for window close to cleanup
        webview.once('tauri://destroyed', () => {
          setWindows((prev) => prev.filter((w) => w.id !== windowLabel));
          // Cleanup terminal in backend
          invoke('close_terminal', { id: terminalId }).catch(console.error);
        });

        return instance;
      } catch (error) {
        console.error('Failed to create terminal window:', error);
        throw error;
      } finally {
        setCreating(false);
      }
    },
    [creating]
  );

  const closeTerminalWindow = useCallback(async (id: string) => {
    const instance = windows.find((w) => w.id === id);
    if (!instance) {
      return;
    }

    try {
      await instance.window.close();
      // Cleanup is handled by the destroyed event listener
    } catch (error) {
      console.error('Failed to close terminal window:', error);
    }
  }, [windows]);

  const focusTerminalWindow = useCallback(async (id: string) => {
    const instance = windows.find((w) => w.id === id);
    if (!instance) {
      return;
    }

    try {
      await instance.window.setFocus();
    } catch (error) {
      console.error('Failed to focus terminal window:', error);
    }
  }, [windows]);

  return {
    windows,
    creating,
    createTerminalWindow,
    closeTerminalWindow,
    focusTerminalWindow,
  };
}
