/**
 * useSystemWakeHandler Hook
 *
 * Handles macOS standby/wake cycle to prevent blank white screen bug.
 *
 * Problem:
 * - When Mac goes to standby, WebView enters dormant state
 * - On wake, WebView doesn't resume rendering properly → blank white screen
 * - Terminal windows continue to work (separate lifecycle)
 *
 * Solution:
 * - Detects when system wakes from standby (hidden > 5min threshold)
 * - Tries to force React re-render first (preserves state)
 * - Falls back to full reload if re-render doesn't work (2s timeout)
 *
 * Events monitored:
 * - `visibilitychange` - document.hidden changes
 * - `focus` - window gains focus
 * - Tauri `onFocusChanged` - Tauri window focus events
 *
 * Usage:
 * ```tsx
 * // In App.tsx or TerminalWindowApp.tsx
 * useSystemWakeHandler();
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface WakeHandlerOptions {
  /** Minimum time hidden (ms) to trigger wake handler (default: 5min) */
  standbyThreshold?: number;
  /** Timeout before fallback reload (ms) (default: 2s) */
  reloadTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export function useSystemWakeHandler(options: WakeHandlerOptions = {}) {
  const {
    standbyThreshold = 5 * 60 * 1000, // 5 minutes
    reloadTimeout = 2000, // 2 seconds
    debug = false,
  } = options;

  // Track when window was last hidden
  const hiddenTimestampRef = useRef<number | null>(null);

  // Force re-render trigger
  const [, setRenderTick] = useState(0);

  // Track if we're in reload timeout
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[SystemWakeHandler]', ...args);
    }
  }, [debug]);

  const handleWakeFromStandby = useCallback(() => {
    const now = Date.now();
    const hiddenDuration = hiddenTimestampRef.current
      ? now - hiddenTimestampRef.current
      : 0;

    log(`Wake detected! Hidden duration: ${Math.round(hiddenDuration / 1000)}s`);

    // If hidden for less than threshold, just a quick focus change
    if (hiddenDuration < standbyThreshold) {
      log('Short hide, ignoring');
      hiddenTimestampRef.current = null;
      return;
    }

    log(`Long hide detected (>${standbyThreshold / 1000}s), triggering wake recovery...`);

    // STEP 1: Try React re-render first (preserves state)
    log('Attempting React re-render...');
    setRenderTick(prev => prev + 1);

    // STEP 2: Fallback to reload if re-render doesn't work
    reloadTimeoutRef.current = setTimeout(() => {
      log('Re-render timeout, falling back to full reload');
      window.location.reload();
    }, reloadTimeout);

    // Clear hidden timestamp
    hiddenTimestampRef.current = null;
  }, [standbyThreshold, reloadTimeout, log]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Document hidden - record timestamp
      hiddenTimestampRef.current = Date.now();
      log('Document hidden, recording timestamp');
    } else {
      // Document visible again - check if we woke from standby
      log('Document visible again');
      handleWakeFromStandby();
    }
  }, [handleWakeFromStandby, log]);

  const handleWindowFocus = useCallback(() => {
    // Window focused - check if we woke from standby
    if (hiddenTimestampRef.current) {
      log('Window focused after being hidden');
      handleWakeFromStandby();
    }
  }, [handleWakeFromStandby, log]);

  // Clean up reload timeout if component unmounts or re-renders successfully
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, []);

  // Setup event listeners
  useEffect(() => {
    log('Initializing system wake handler');

    // Browser API - visibilitychange
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Browser API - window focus
    window.addEventListener('focus', handleWindowFocus);

    // Tauri API - window focus changed (more reliable on macOS)
    let unlistenFocus: (() => void) | null = null;
    const setupTauriListener = async () => {
      try {
        const currentWindow = getCurrentWindow();
        const unlisten = await currentWindow.onFocusChanged(({ payload: focused }) => {
          if (focused && hiddenTimestampRef.current) {
            log('Tauri window focused after being hidden');
            handleWakeFromStandby();
          } else if (!focused) {
            // Window lost focus - record timestamp
            hiddenTimestampRef.current = Date.now();
            log('Tauri window unfocused, recording timestamp');
          }
        });
        unlistenFocus = unlisten;
      } catch (error) {
        log('Failed to setup Tauri focus listener (not in Tauri context?):', error);
      }
    };

    setupTauriListener();

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (unlistenFocus) {
        unlistenFocus();
      }
    };
  }, [handleVisibilityChange, handleWindowFocus, handleWakeFromStandby, log]);

  // If we successfully re-rendered, cancel the reload timeout
  useEffect(() => {
    if (reloadTimeoutRef.current) {
      log('Component re-rendered successfully, canceling reload timeout');
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
  });

  // Return nothing - this hook just sets up side effects
}

export default useSystemWakeHandler;
