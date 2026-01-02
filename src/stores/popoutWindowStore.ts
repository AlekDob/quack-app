import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Store } from '@tauri-apps/plugin-store';
import type { Tab } from '../components/TabBar';

// Store file name for persistence
const STORE_FILE = '.quack-popout-windows.dat';
const STORE_KEY = 'popout-windows';

export interface PopoutWindowInfo {
  windowLabel: string;
  tab: Tab;
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: number;
}

interface PopoutWindowState {
  windows: Map<string, PopoutWindowInfo>;
  store: Store | null;

  // Actions
  addWindow: (info: PopoutWindowInfo) => Promise<void>;
  removeWindow: (windowLabel: string) => Promise<void>;
  updatePosition: (windowLabel: string, position: { x: number; y: number }) => Promise<void>;
  updateSize: (windowLabel: string, size: { width: number; height: number }) => Promise<void>;
  getWindowByTabId: (tabId: string) => PopoutWindowInfo | undefined;
  getAllWindows: () => PopoutWindowInfo[];
  hasWindow: (windowLabel: string) => boolean;

  // Persistence
  loadWindows: () => Promise<void>;
  persistWindows: () => Promise<void>;
  initializeStore: () => Promise<void>;
}

export const usePopoutWindowStore = create<PopoutWindowState>()(
  devtools(
    (set, get) => ({
      windows: new Map(),
      store: null,

      // Initialize store on mount
      initializeStore: async () => {
        try {
          const loadedStore = await Store.load(STORE_FILE);
          set({ store: loadedStore });
          console.log('🦆 Popout window store initialized');

          // Load persisted windows
          await get().loadWindows();
        } catch (error) {
          console.error('🦆 Failed to initialize popout window store:', error);
        }
      },

      // Add new popout window
      addWindow: async (info: PopoutWindowInfo) => {
        const { windows } = get();
        const newWindows = new Map(windows);
        newWindows.set(info.windowLabel, info);

        set({ windows: newWindows });
        await get().persistWindows();

        console.log('🦆 Added popout window:', info.windowLabel);
      },

      // Remove popout window
      removeWindow: async (windowLabel: string) => {
        const { windows } = get();
        const newWindows = new Map(windows);

        if (newWindows.delete(windowLabel)) {
          set({ windows: newWindows });
          await get().persistWindows();
          console.log('🦆 Removed popout window:', windowLabel);
        }
      },

      // Update window position
      updatePosition: async (windowLabel: string, position: { x: number; y: number }) => {
        const { windows } = get();
        const windowInfo = windows.get(windowLabel);

        if (!windowInfo) return;

        const newWindows = new Map(windows);
        newWindows.set(windowLabel, {
          ...windowInfo,
          position,
        });

        set({ windows: newWindows });
        await get().persistWindows();
      },

      // Update window size
      updateSize: async (windowLabel: string, size: { width: number; height: number }) => {
        const { windows } = get();
        const windowInfo = windows.get(windowLabel);

        if (!windowInfo) return;

        const newWindows = new Map(windows);
        newWindows.set(windowLabel, {
          ...windowInfo,
          size,
        });

        set({ windows: newWindows });
        await get().persistWindows();
      },

      // Get window by tab ID
      getWindowByTabId: (tabId: string) => {
        const { windows } = get();
        console.log(`[PopoutStore] getWindowByTabId(${tabId}) - windows in store:`, windows.size);

        for (const windowInfo of windows.values()) {
          console.log(`[PopoutStore] Checking window:`, windowInfo.windowLabel, 'with tab:', windowInfo.tab.id);
          if (windowInfo.tab.id === tabId) {
            console.log(`[PopoutStore] Found match for ${tabId}`);
            return windowInfo;
          }
        }

        console.log(`[PopoutStore] No window found for ${tabId}`);
        return undefined;
      },

      // Get all windows as array
      getAllWindows: () => {
        const { windows } = get();
        return Array.from(windows.values());
      },

      // Check if window exists
      hasWindow: (windowLabel: string) => {
        const { windows } = get();
        return windows.has(windowLabel);
      },

      // Load windows from persistent storage
      loadWindows: async () => {
        const { store } = get();

        if (!store) {
          console.warn('🦆 Store not ready, cannot load popout windows');
          return;
        }

        try {
          const saved = await store.get<PopoutWindowInfo[]>(STORE_KEY);

          if (saved && Array.isArray(saved)) {
            const windowsMap = new Map<string, PopoutWindowInfo>();
            saved.forEach((info) => {
              windowsMap.set(info.windowLabel, info);
            });

            set({ windows: windowsMap });
            console.log(`🦆 Loaded ${windowsMap.size} popout windows from storage`);
          }
        } catch (error) {
          console.error('🦆 Failed to load popout windows:', error);
        }
      },

      // Persist windows to storage
      persistWindows: async () => {
        const { store, windows } = get();

        if (!store) {
          console.warn('🦆 Store not ready, cannot persist popout windows');
          return;
        }

        try {
          // Convert Map to array for storage
          const windowsArray = Array.from(windows.values());

          await store.set(STORE_KEY, windowsArray);
          await store.save();

          console.log(`🦆 Persisted ${windowsArray.length} popout windows`);
        } catch (error) {
          console.error('🦆 Failed to persist popout windows:', error);
        }
      },
    }),
    { name: 'popout-window-store' }
  )
);

// Utility function to generate unique window label
export function generateWindowLabel(tab: Tab): string {
  const timestamp = Date.now();
  const sanitizedType = tab.type.replace(/[^a-z0-9-]/gi, '-');
  return `tab-popout-${sanitizedType}-${timestamp}`;
}

// Utility function to check if tab type can be popped out
export function canPopoutTab(tab: Tab): boolean {
  // Chat tabs cannot be popped out (main app tab)
  if (tab.type === 'chat') {
    return false;
  }

  // Kanban tabs cannot be popped out - they require main app state (terminals, chat sessions, etc.)
  if (tab.type === 'kanban') {
    return false;
  }

  // All other tab types can be popped out
  return true;
}
