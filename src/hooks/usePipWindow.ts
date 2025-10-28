import { useState, useEffect, useCallback } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emit, listen } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';
import type { PipAgentState, PipWindowState } from '../types';

const PIP_WINDOW_LABEL = 'pip-window';
const STORE_KEY_PIP_STATE = 'pip-window-state';

export function usePipWindow() {
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [pipWindow, setPipWindow] = useState<WebviewWindow | null>(null);
  const [store, setStore] = useState<Store | null>(null);

  // Initialize store on mount
  useEffect(() => {
    const initStore = async () => {
      try {
        const loadedStore = await Store.load('pip-settings.json');
        setStore(loadedStore);
      } catch (error) {
        console.error('🦆 Failed to load PiP store:', error);
      }
    };
    initStore();
  }, []);

  // Open PiP window
  const openPipWindow = useCallback(async () => {
    if (pipWindow) {
      // Already open, just focus it
      await pipWindow.setFocus();
      return;
    }

    try {
      // Load saved position/size from store (if available)
      let savedState: PipWindowState | null = null;
      if (store) {
        savedState = await store.get<PipWindowState>(STORE_KEY_PIP_STATE);
      }

      // Default size and position
      const width = savedState?.size?.width || 400;
      const height = savedState?.size?.height || 600;
      const x = savedState?.position?.x || undefined;
      const y = savedState?.position?.y || undefined;

      // Create new PiP window (starts hidden)
      const webview = new WebviewWindow(PIP_WINDOW_LABEL, {
        url: '/pip.html',
        title: 'Quack PiP - Active Agents',
        width,
        height,
        x,
        y,
        minWidth: 300,
        minHeight: 400,
        resizable: true,
        decorations: false, // Custom titlebar in component
        alwaysOnTop: true,  // Float above all other windows
        skipTaskbar: false,
        transparent: true,
        center: x === undefined && y === undefined, // Center only if no saved position
        visible: false,     // Start hidden, will show when main window loses focus
      });

      await webview.once('tauri://created', () => {
        console.log('🦆 PiP Window created successfully!');
        setIsPipOpen(true);
        setPipWindow(webview);
      });

      await webview.once('tauri://error', (error) => {
        console.error('🦆 Error creating PiP window:', error);
        setIsPipOpen(false);
        setPipWindow(null);
      });

      await webview.once('tauri://close-requested', async () => {
        console.log('🦆 PiP Window close requested');
        setIsPipOpen(false);
        setPipWindow(null);
      });
    } catch (error) {
      console.error('🦆 Failed to open PiP window:', error);
    }
  }, [pipWindow, store]);

  // Close PiP window
  const closePipWindow = useCallback(async () => {
    if (!pipWindow) return;

    try {
      await pipWindow.close();
      setPipWindow(null);
      setIsPipOpen(false);
    } catch (error) {
      console.error('🦆 Failed to close PiP window:', error);
    }
  }, [pipWindow]);

  // Toggle PiP window
  const togglePipWindow = useCallback(async () => {
    if (isPipOpen) {
      await closePipWindow();
    } else {
      await openPipWindow();
    }
  }, [isPipOpen, openPipWindow, closePipWindow]);

  // Show/hide PiP window without closing it
  const showPipWindow = useCallback(async () => {
    if (!pipWindow) return;
    try {
      await pipWindow.show();
    } catch (error) {
      console.error('🦆 Failed to show PiP window:', error);
    }
  }, [pipWindow]);

  const hidePipWindow = useCallback(async () => {
    if (!pipWindow) return;
    try {
      await pipWindow.hide();
    } catch (error) {
      console.error('🦆 Failed to hide PiP window:', error);
    }
  }, [pipWindow]);

  // Send agent state updates to PiP window
  const updatePipAgents = useCallback(
    async (agents: PipAgentState[]) => {
      if (!isPipOpen) return;

      try {
        await emit('pip-agents-update', agents);
      } catch (error) {
        console.error('🦆 Failed to update PiP agents:', error);
      }
    },
    [isPipOpen]
  );

  // Listen for events from PiP window
  useEffect(() => {
    // Listen for PiP window ready event
    const unlistenReady = listen('pip-window-ready', async () => {
      console.log('🦆 PiP Window is ready, sending initial data');
      // Initial data will be sent by the parent component via updatePipAgents
    });

    // Listen for PiP window closing event (to save position/size)
    const unlistenClosing = listen<{ position: { x: number; y: number }; size: { width: number; height: number } }>(
      'pip-window-closing',
      async (event) => {
        console.log('🦆 Saving PiP window state:', event.payload);
        if (!store) {
          console.warn('🦆 Store not ready, cannot save PiP state');
          return;
        }
        try {
          await store.set(STORE_KEY_PIP_STATE, {
            agents: [], // Don't save agents, only window geometry
            position: event.payload.position,
            size: event.payload.size,
          });
          await store.save();
        } catch (error) {
          console.error('🦆 Failed to save PiP window state:', error);
        }
      }
    );

    return () => {
      unlistenReady.then((fn) => fn());
      unlistenClosing.then((fn) => fn());
    };
  }, [store]);

  // Check if PiP window is already open on mount
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const allWindows = await WebviewWindow.getAll();
        const existing = allWindows.find((w) => w.label === PIP_WINDOW_LABEL);
        if (existing) {
          setIsPipOpen(true);
          setPipWindow(existing);
        }
      } catch (error) {
        console.error('🦆 Failed to check existing PiP window:', error);
      }
    };

    checkExisting();
  }, []);

  // Auto-open PiP window on mount (default active)
  useEffect(() => {
    if (!store) return; // Wait for store to be ready

    const autoOpenPip = async () => {
      try {
        // Check if a PiP window already exists
        const allWindows = await WebviewWindow.getAll();
        const existing = allWindows.find((w) => w.label === PIP_WINDOW_LABEL);

        if (!existing) {
          // Open PiP window on startup (will start hidden)
          await openPipWindow();
        }
      } catch (error) {
        console.error('🦆 Failed to auto-open PiP window:', error);
      }
    };

    autoOpenPip();
  }, [store, openPipWindow]);

  return {
    isPipOpen,
    openPipWindow,
    closePipWindow,
    togglePipWindow,
    updatePipAgents,
    showPipWindow,
    hidePipWindow,
  };
}
