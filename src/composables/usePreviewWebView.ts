import { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface WebViewPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function usePreviewWebView() {
  const webviewActiveRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  const createWebView = useCallback(async (url: string, position: WebViewPosition) => {
    try {
      await invoke('create_preview_webview', {
        url,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });

      webviewActiveRef.current = true;
      currentUrlRef.current = url;

      console.log('🦆 WebView created:', url);
    } catch (error) {
      console.error('Failed to create webview:', error);
      throw error;
    }
  }, []);

  const updatePosition = useCallback(async (position: WebViewPosition) => {
    if (!webviewActiveRef.current) return;

    try {
      await invoke('update_preview_webview_position', {
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
      });
    } catch (error) {
      console.error('Failed to update webview position:', error);
    }
  }, []);

  const destroyWebView = useCallback(async () => {
    if (!webviewActiveRef.current) return;

    try {
      await invoke('destroy_preview_webview');
      webviewActiveRef.current = false;
      currentUrlRef.current = null;

      console.log('🦆 WebView destroyed');
    } catch (error) {
      console.error('Failed to destroy webview:', error);
    }
  }, []);

  const showWebView = useCallback(async () => {
    if (!webviewActiveRef.current) return;

    try {
      await invoke('show_preview_webview');
    } catch (error) {
      console.error('Failed to show webview:', error);
    }
  }, []);

  const hideWebView = useCallback(async () => {
    if (!webviewActiveRef.current) return;

    try {
      await invoke('hide_preview_webview');
    } catch (error) {
      console.error('Failed to hide webview:', error);
    }
  }, []);

  const injectScript = useCallback(async (script: string) => {
    if (!webviewActiveRef.current) return;

    try {
      await invoke('inject_preview_script', { script });
    } catch (error) {
      console.error('Failed to inject script:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webviewActiveRef.current) {
        void destroyWebView();
      }
    };
  }, [destroyWebView]);

  return {
    createWebView,
    updatePosition,
    destroyWebView,
    showWebView,
    hideWebView,
    injectScript,
    isActive: () => webviewActiveRef.current,
    getCurrentUrl: () => currentUrlRef.current,
  };
}
