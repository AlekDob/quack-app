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
    initializeStore
  } = usePopoutWindowStore();

  // Initialize store on mount
  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

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
    // Validate tab can be popped out
    if (!canPopoutTab(tab)) {
      console.warn(`[TabPopoutWindow] Tab type ${tab.type} cannot be popped out`);
      return null;
    }

    // DEBOUNCE: Check if this tab was recently popped out
    const now = Date.now();
    const lastPopoutTime = lastPopoutTimeRef.current.get(tab.id);
    if (lastPopoutTime && (now - lastPopoutTime) < POPOUT_DEBOUNCE_MS) {
      console.log(`[TabPopoutWindow] Debouncing popout for tab ${tab.id}, too soon after last popout`);
      return null;
    }

    // MUTEX: Check if this tab is already being processed
    if (pendingPopoutsRef.current.has(tab.id)) {
      console.log(`[TabPopoutWindow] Popout already in progress for tab ${tab.id}`);
      return null;
    }

    // Mark as pending immediately
    pendingPopoutsRef.current.add(tab.id);
    lastPopoutTimeRef.current.set(tab.id, now);

    try {
      const windowLabel = generateWindowLabel(tab);

      // Check if already exists
      const allWindows = await WebviewWindow.getAll();
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

      // Determine window size based on tab type
      const windowSize = getWindowSizeForTabType(tab.type);

      // Calculate position (center on cursor)
      const windowX = Math.max(0, position.screenX - windowSize.width / 2);
      const windowY = Math.max(0, position.screenY - 30);

      // Create new window with macOS-style overlay titlebar
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

      // Wait for window creation
      await webview.once('tauri://created', async () => {
        console.log(`[TabPopoutWindow] Created window for tab ${tab.id}`);
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
      });

      // Handle window close
      webview.once('tauri://destroyed', async () => {
        console.log(`[TabPopoutWindow] Window destroyed for tab ${tab.id}`);
        handleWindowClose(tab.id, windowLabel);
      });

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
    return popoutWindows.has(tabId) || !!getWindowByTabId(tabId);
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

export type { Tab, PopoutPosition };
