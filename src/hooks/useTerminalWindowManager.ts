import { useCallback, useState } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export interface ProjectInfo {
  path: string;
  name: string;
}

export interface InitialCommand {
  projectPath: string;
  command: string;
  terminalLabel?: string;
}

const TERMINAL_WINDOW_LABEL = 'terminal-manager';

/**
 * Hook to manage the terminal window
 * Opens a separate Tauri window for terminal management
 */
export function useTerminalWindowManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [windowInstance, setWindowInstance] = useState<WebviewWindow | null>(null);

  /**
   * Open the terminal window with the list of projects
   * @param projects - List of projects to display
   * @param initialCommand - Optional command to execute in a new terminal
   */
  const openTerminalWindow = useCallback(async (
    projects: ProjectInfo[],
    initialCommand?: InitialCommand
  ) => {
    try {
      // Check if window already exists
      const allWindows = await WebviewWindow.getAll();
      const existingWindow = allWindows.find(w => w.label === TERMINAL_WINDOW_LABEL);

      if (existingWindow) {
        // Focus existing window
        await existingWindow.setFocus();
        setIsOpen(true);

        // If there's an initial command, emit event to create terminal with command
        if (initialCommand) {
          await existingWindow.emit('terminal-window-execute-command', initialCommand);
        }
        return;
      }

      // Encode projects for URL
      const projectsParam = encodeURIComponent(JSON.stringify(projects));

      // Encode initial command if provided
      const urlParams = new URLSearchParams({ projects: projectsParam });
      if (initialCommand) {
        urlParams.set('initialCommand', encodeURIComponent(JSON.stringify(initialCommand)));
      }

      // Create new window
      const webview = new WebviewWindow(TERMINAL_WINDOW_LABEL, {
        url: `terminal-window.html?${urlParams.toString()}`,
        title: 'Quack Terminals',
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 500,
        center: true,
        decorations: true,
        resizable: true,
        focus: true,
        titleBarStyle: 'overlay',
        hiddenTitle: true,
        transparent: true,
      });

      // Wait for window creation
      await webview.once('tauri://created', () => {
        console.log('Terminal window created');
        setIsOpen(true);
        setWindowInstance(webview);
      });

      // Handle window close
      webview.once('tauri://destroyed', () => {
        console.log('Terminal window closed');
        setIsOpen(false);
        setWindowInstance(null);
      });

    } catch (error) {
      console.error('Failed to open terminal window:', error);
    }
  }, []);

  /**
   * Close the terminal window
   */
  const closeTerminalWindow = useCallback(async () => {
    if (windowInstance) {
      try {
        await windowInstance.close();
      } catch (error) {
        console.error('Failed to close terminal window:', error);
      }
    }
  }, [windowInstance]);

  /**
   * Update projects list in the terminal window
   */
  const updateProjects = useCallback(async (projects: ProjectInfo[]) => {
    if (windowInstance) {
      try {
        await windowInstance.emit('terminal-window-projects-update', projects);
      } catch (error) {
        console.error('Failed to update projects:', error);
      }
    }
  }, [windowInstance]);

  return {
    isOpen,
    openTerminalWindow,
    closeTerminalWindow,
    updateProjects,
  };
}
