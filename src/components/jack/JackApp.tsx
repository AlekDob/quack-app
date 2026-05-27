import React, { useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useJackStore } from '../../stores/jackStore';
import { useJackAgentRefresh } from '../../hooks/useJackAgentRefresh';
import JackChat from './JackChat';
import JackSessionsSidebar from './JackSessionsSidebar';
import { loadJackSessions, saveJackSessions } from '../../services/jackSessionsStorage';

const SAVE_DEBOUNCE_MS = 600;

export default function JackApp() {
  const activeTab = useJackStore((s) => s.activeTab);
  const sessions = useJackStore((s) => s.sessions);
  const loadSessions = useJackStore((s) => s.loadSessions);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useJackAgentRefresh();

  // Load sessions on mount
  useEffect(() => {
    loadJackSessions().then((loaded) => {
      loadSessions(loaded);
    });
  }, [loadSessions]);

  // Debounced auto-save on session changes
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveJackSessions(sessions);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sessions]);

  const handleClose = useCallback(async () => {
    try {
      // Final save before close
      await saveJackSessions(useJackStore.getState().sessions);
      const appWindow = getCurrentWebviewWindow();
      const pos = await appWindow.outerPosition();
      const size = await appWindow.outerSize();
      await emit('jack-window-closing', {
        position: { x: pos.x, y: pos.y },
        size: { width: size.width, height: size.height },
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    const unlistenClose = appWindow.onCloseRequested(async () => {
      await handleClose();
    });
    return () => { unlistenClose.then((fn) => fn()); };
  }, [handleClose]);

  useEffect(() => {
    const unlisten = listen('accent-color-changed', (event) => {
      const hex = (event.payload as { color: string })?.color;
      if (hex) {
        document.documentElement.style.setProperty('--accent', hex);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      background: 'var(--bg-primary, #1a1a1e)',
      color: 'var(--text-primary, #e4e4e7)',
    }}>
      <JackSessionsSidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          data-tauri-drag-region
          style={{ height: 38, flexShrink: 0 }}
        />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'chat' && <JackChat />}
        </div>
      </div>
    </div>
  );
}
