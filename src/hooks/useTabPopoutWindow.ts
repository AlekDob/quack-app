import { useCallback, useState, useEffect, useRef } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { emitTo, listen } from '@tauri-apps/api/event';
import type { Tab, PopoutPosition } from '../components/TabBar';
import {
  usePopoutWindowStore,
  generateWindowLabel,
  canPopoutTab,
  type PopoutWindowInfo
} from '../stores/popoutWindowStore';

const POPOUT_WINDOW_PREFIX = 'tab-popout-';
// Debounce time in ms to prevent rapid duplicate window creation
const POPOUT_DEBOUNCE_MS = 500;

interface TabClosingEvent {
  tabId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface TabDragbackEvent {
  tab: Tab;
  position: { x: number; y: number };
}

/**
 * Hook to manage tab popout windows
 * Handles creating, closing, and communicating with popped-out tabs
 */
export function useTabPopoutWindow(onTabReturn?: (tab: Tab) => void) {
  const [popoutWindows, setPopoutWindows] = useState<Map<string, WebviewWindow>>(new Map());
  // Track tabs currently being processed to prevent race conditions
  const pendingPopoutsRef = useRef<Set<string>>(new Set());
  const lastPopoutTimeRef = useRef<Map<string, number>>(new Map());

  // Get store actions
  const {
    addWindow,
    removeWindow,
    updatePosition,
    updateSize,
    getWindowByTabId,
    getAllWindows,
    initializeStore
  } = usePopoutWindowStore();

  // Initialize store on mount and cleanup stale entries
  useEffect(() => {
    const init = async () => {
      await initializeStore();

      // After store is loaded, validate that windows actually exist
      // This cleans up stale entries from previous sessions where windows weren't properly closed
      console.log('[TabPopoutWindow] Validating stored windows...');

      const storedWindows = getAllWindows();
      if (storedWindows.length > 0) {
        const existingTauriWindows = await WebviewWindow.getAll();
        const existingLabels = new Set(existingTauriWindows.map(w => w.label));

        console.log(`[TabPopoutWindow] Found ${storedWindows.length} stored windows, ${existingLabels.size} actual Tauri windows`);

        // Remove stale entries
        for (const storedWindow of storedWindows) {
          if (!existingLabels.has(storedWindow.windowLabel)) {
            console.log(`[TabPopoutWindow] Removing stale window entry: ${storedWindow.windowLabel}`);
            await removeWindow(storedWindow.windowLabel);
          }
        }
      }
    };

    init();
  }, [initializeStore, getAllWindows, removeWindow]);

  // Listen for drag-back events from popout windows
  useEffect(() => {
    const unlistenPromise = listen<TabDragbackEvent>('tab-popout-dragback', async (event) => {
      const { tab } = event.payload;
      console.log('[TabPopoutWindow] Received dragback request for tab:', tab.id);

      // Notify parent to add tab back
      if (onTabReturn) {
        onTabReturn(tab);
      }

      // Close the popout window
      await closePopoutWindow(tab.id);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [onTabReturn]);

  // Listen for window closing events to persist state
  useEffect(() => {
    const unlistenPromise = listen<TabClosingEvent>('tab-popout-closing', async (event) => {
      const { tabId, position, size } = event.payload;
      console.log('[TabPopoutWindow] Window closing, saving state:', tabId);

      await updatePosition(`${POPOUT_WINDOW_PREFIX}${tabId}`, position);
      await updateSize(`${POPOUT_WINDOW_PREFIX}${tabId}`, size);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [updatePosition, updateSize]);

  /**
   * Get window dimensions based on tab type
   */
  const getWindowSizeForTabType = useCallback((type: Tab['type']) => {
    switch (type) {
      case 'file':
        return { width: 1000, height: 800 };
      case 'agent-terminal':
        return { width: 1200, height: 700 };
      case 'browser':
        return { width: 1200, height: 900 };
      case 'docs':
        return { width: 900, height: 700 };
      case 'memory-graph':
        return { width: 1000, height: 800 };
      case 'kanban':
        return { width: 1400, height: 900 }; // Large window for Kanban board
      default:
        return { width: 800, height: 600 };
    }
  }, []);

  /**
   * Create a new popout window for a tab
   */
  const popoutTab = useCallback(async (
    tab: Tab,
    position: PopoutPosition
  ): Promise<string | null> => {
    console.log(`[TabPopoutWindow] popoutTab called for:`, tab.id, tab.type);

    // Validate tab can be popped out
    if (!canPopoutTab(tab)) {
      console.warn(`[TabPopoutWindow] Tab type ${tab.type} cannot be popped out`);
      return null;
    }
    console.log(`[TabPopoutWindow] canPopoutTab check passed`);

    // DEBOUNCE: Check if this tab was recently popped out
    const now = Date.now();
    const lastPopoutTime = lastPopoutTimeRef.current.get(tab.id);
    if (lastPopoutTime && (now - lastPopoutTime) < POPOUT_DEBOUNCE_MS) {
      console.log(`[TabPopoutWindow] Debouncing popout for tab ${tab.id}, too soon after last popout`);
      return null;
    }
    console.log(`[TabPopoutWindow] debounce check passed`);

    // MUTEX: Check if this tab is already being processed
    if (pendingPopoutsRef.current.has(tab.id)) {
      console.log(`[TabPopoutWindow] Popout already in progress for tab ${tab.id}`);
      return null;
    }
    console.log(`[TabPopoutWindow] mutex check passed`);

    // Mark as pending immediately
    pendingPopoutsRef.current.add(tab.id);
    lastPopoutTimeRef.current.set(tab.id, now);

    try {
      const windowLabel = generateWindowLabel(tab);
      console.log(`[TabPopoutWindow] Generated window label:`, windowLabel);

      // Check if already exists
      console.log(`[TabPopoutWindow] Checking for existing windows...`);
      const allWindows = await WebviewWindow.getAll();
      console.log(`[TabPopoutWindow] Found ${allWindows.length} existing windows:`, allWindows.map(w => w.label));
      const existingByTab = allWindows.find(w => w.label.includes(tab.id));

      if (existingByTab) {
        await existingByTab.setFocus();
        console.log(`[TabPopoutWindow] Window already exists for tab ${tab.id}`);
        // Clean up pending state
        pendingPopoutsRef.current.delete(tab.id);
        return existingByTab.label;
      }

      // Prepare tab data for URL
      const tabData = encodeURIComponent(JSON.stringify(tab));
      const url = `tab-popout.html?tabId=${tab.id}&tabType=${tab.type}&tabData=${tabData}`;
      console.log(`[TabPopoutWindow] Creating window with URL:`, url);

      // Determine window size based on tab type
      const windowSize = getWindowSizeForTabType(tab.type);
      console.log(`[TabPopoutWindow] Window size:`, windowSize);

      // Calculate position (center on cursor)
      const windowX = Math.max(0, position.screenX - windowSize.width / 2);
      const windowY = Math.max(0, position.screenY - 30);
      console.log(`[TabPopoutWindow] Window position:`, { x: windowX, y: windowY });

      // Create new window with macOS-style overlay titlebar
      console.log(`[TabPopoutWindow] Creating WebviewWindow...`);
      const webview = new WebviewWindow(windowLabel, {
        url,
        title: tab.label,
        width: windowSize.width,
        height: windowSize.height,
        x: windowX,
        y: windowY,
        decorations: true,
        titleBarStyle: 'overlay',
        hiddenTitle: true,
        transparent: true,
        resizable: true,
        alwaysOnTop: false,
        focus: true,
      });
      console.log(`[TabPopoutWindow] WebviewWindow created, setting up listeners...`);

      // Wait for window creation with timeout
      const createdPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Window creation timed out after 5s'));
        }, 5000);

        webview.once('tauri://created', async () => {
          clearTimeout(timeout);
          console.log(`[TabPopoutWindow] tauri://created event received for tab ${tab.id}`);
          setPopoutWindows(prev => new Map(prev).set(tab.id, webview));

          // Save to store for persistence
          const windowInfo: PopoutWindowInfo = {
            windowLabel,
            tab,
            position: { x: windowX, y: windowY },
            size: windowSize,
            createdAt: Date.now(),
          };
          await addWindow(windowInfo);

          // Emit creation event
          await emitTo(windowLabel, 'tab-popout-created', { tab });

          // Clean up pending state after successful creation
          pendingPopoutsRef.current.delete(tab.id);
          resolve();
        });

        webview.once('tauri://error', (e) => {
          clearTimeout(timeout);
          console.error(`[TabPopoutWindow] tauri://error event:`, e);
          reject(new Error(`Window creation error: ${e.payload}`));
        });
      });

      // Handle window close
      webview.once('tauri://destroyed', async () => {
        console.log(`[TabPopoutWindow] Window destroyed for tab ${tab.id}`);
        handleWindowClose(tab.id, windowLabel);
      });

      // Wait for creation to complete
      await createdPromise;
      console.log(`[TabPopoutWindow] Window fully created:`, windowLabel);

      return windowLabel;
    } catch (error) {
      console.error(`[TabPopoutWindow] Failed to create window:`, error);
      // Clean up pending state on error
      pendingPopoutsRef.current.delete(tab.id);
      return null;
    }
  }, [addWindow, getWindowSizeForTabType]);

  /**
   * Handle window close cleanup
   */
  const handleWindowClose = useCallback(async (tabId: string, windowLabel: string) => {
    setPopoutWindows(prev => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });

    // Remove from store
    await removeWindow(windowLabel);

    // Emit close event to main window
    await emitTo('main', 'tab-popout-closed', { tabId });
  }, [removeWindow]);

  /**
   * Close a specific popout window
   */
  const closePopoutWindow = useCallback(async (tabId: string): Promise<void> => {
    try {
      const window = popoutWindows.get(tabId);
      if (window) {
        await window.close();
      } else {
        // Try to find by label pattern
        const allWindows = await WebviewWindow.getAll();
        const targetWindow = allWindows.find(w => w.label.includes(tabId));
        if (targetWindow) {
          await targetWindow.close();
        }
      }
    } catch (error) {
      console.error(`[TabPopoutWindow] Failed to close window:`, error);
    }
  }, [popoutWindows]);

  /**
   * Close all popout windows
   */
  const closeAllPopoutWindows = useCallback(async (): Promise<void> => {
    try {
      const closePromises = Array.from(popoutWindows.values()).map(w => w.close());
      await Promise.all(closePromises);
      setPopoutWindows(new Map());
    } catch (error) {
      console.error(`[TabPopoutWindow] Failed to close all windows:`, error);
    }
  }, [popoutWindows]);

  /**
   * Check if a tab is currently popped out
   */
  const isTabPoppedOut = useCallback((tabId: string): boolean => {
    const inLocalState = popoutWindows.has(tabId);
    const inStore = getWindowByTabId(tabId);
    console.log(`[TabPopoutWindow] isTabPoppedOut check for ${tabId}: inLocalState=${inLocalState}, inStore=${!!inStore}`);
    return inLocalState || !!inStore;
  }, [popoutWindows, getWindowByTabId]);

  /**
   * Sanitize ID for Tauri event names
   */
  const sanitizeEventName = useCallback((id: string): string => {
    return id.replace(/[^a-zA-Z0-9\-/:_]/g, '_');
  }, []);

  /**
   * Send updates to a popout window
   */
  const updatePopoutTab = useCallback(async (
    tabId: string,
    updates: Partial<Tab>
  ): Promise<void> => {
    try {
      const windowInfo = getWindowByTabId(tabId);
      if (!windowInfo) {
        console.warn(`[TabPopoutWindow] No window found for tab ${tabId}`);
        return;
      }

      const sanitizedId = sanitizeEventName(tabId);
      await emitTo(windowInfo.windowLabel, `tab-popout-update/${sanitizedId}`, updates);
      console.log(`[TabPopoutWindow] Updated tab ${tabId}`, updates);
    } catch (error) {
      console.error(`[TabPopoutWindow] Failed to update tab:`, error);
    }
  }, [getWindowByTabId, sanitizeEventName]);

  return {
    popoutTab,
    closePopoutWindow,
    closeAllPopoutWindows,
    isTabPoppedOut,
    updatePopoutTab,
  };
}

;
