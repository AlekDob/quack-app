import { useState, useEffect, useCallback, useRef } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Store } from '@tauri-apps/plugin-store';

const JACK_WINDOW_LABEL = 'jack';
const STORE_KEY = 'jack-window-state';

interface JackWindowGeometry {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export function useJackWindow() {
  const [isJackOpen, setIsJackOpen] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    Store.load('jack-settings.json')
      .then((s) => setStore(s))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const openJackWindow = useCallback(async () => {
    try {
      const allWindows = await WebviewWindow.getAll();
      const existing = allWindows.find((w) => w.label === JACK_WINDOW_LABEL);
      if (existing) {
        await existing.setFocus();
        setIsJackOpen(true);
        return;
      }
    } catch {
      // ignore
    }

    try {
      await invoke('open_jack_window');
      setIsJackOpen(true);
    } catch (error) {
      console.error('Failed to open Jack window:', error);
    }
  }, []);

  const closeJackWindow = useCallback(async () => {
    try {
      const allWindows = await WebviewWindow.getAll();
      const jack = allWindows.find((w) => w.label === JACK_WINDOW_LABEL);
      if (jack) await jack.close();
    } catch {
      // ignore
    }
    setIsJackOpen(false);
  }, []);

  const toggleJackWindow = useCallback(async () => {
    if (isJackOpen) {
      await closeJackWindow();
    } else {
      await openJackWindow();
    }
  }, [isJackOpen, openJackWindow, closeJackWindow]);

  useEffect(() => {
    const unlistenClosing = listen<JackWindowGeometry>(
      'jack-window-closing',
      async (event) => {
        const s = storeRef.current;
        if (!s) return;
        try {
          await s.set(STORE_KEY, event.payload);
          await s.save();
        } catch {
          // ignore
        }
        setIsJackOpen(false);
      }
    );

    return () => {
      unlistenClosing.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const allWindows = await WebviewWindow.getAll();
        setIsJackOpen(allWindows.some((w) => w.label === JACK_WINDOW_LABEL));
      } catch {
        // ignore
      }
    };
    check();
  }, []);

  return { isJackOpen, openJackWindow, closeJackWindow, toggleJackWindow };
}
