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
 * - Detects when system wakes from standby using multiple event sources
 * - Uses pageshow/pagehide events (more reliable than visibilitychange for wake)
 * - Forces CSS repaint + React re-render to recover WebView rendering
 * - Falls back to full reload if recovery doesn't work (500ms timeout)
 *
 * Events monitored:
 * - `pageshow`/`pagehide` - Most reliable for BFCache and wake recovery
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
  /** Timeout before fallback reload (ms) (default: 500ms - reduced for faster recovery) */
  reloadTimeout?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Forces a CSS repaint by toggling a class on the root element.
 * This helps recover WebView rendering after macOS standby.
 */
function forceRepaint(): void {
  const root = document.documentElement;
  root.style.display = 'none';
  // Force reflow
  void root.offsetHeight;
  root.style.display = '';
}

/**
 * Checks if the WebView appears to be in a corrupted/blank state.
 * Returns true if the app content is not rendering properly.
 *
 * Detects both white-screen (light theme) and black-screen (dark theme) corruption.
 */
function isWebViewCorrupted(): boolean {
  // Check if the root element has any visible content
  const root = document.getElementById('root');
  if (!root) return true;

  // Check if root has children
  if (root.children.length === 0) return true;

  // Check if the computed style suggests visibility issues
  const computedStyle = window.getComputedStyle(root);
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    return true;
  }

  // Check if root has no height (collapsed layout)
  if (root.offsetHeight === 0) {
    return true;
  }

  // Check for empty main content area (sidebar visible but content blank)
  // This catches the dark-theme case where background color looks "normal"
  // but the main content area has no rendered children
  const mainContent = root.querySelector('[data-main-content]') ||
                      root.querySelector('.main-content') ||
                      root.querySelector('main');
  if (mainContent) {
    const mainRect = mainContent.getBoundingClientRect();
    // Main content exists but has zero dimensions = corrupted
    if (mainRect.width === 0 || mainRect.height === 0) {
      return true;
    }
    // Main content has no visible children (all children collapsed)
    const visibleChildren = Array.from(mainContent.children).filter(child => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (visibleChildren.length === 0) {
      return true;
    }
  }

  return false;
}

export function useSystemWakeHandler(options: WakeHandlerOptions = {}) {
  const {
    standbyThreshold = 5 * 60 * 1000, // 5 minutes
    reloadTimeout = 500, // 500ms - reduced from 2s for faster recovery
    debug = false,
  } = options;

  // Track when window was last hidden
  const hiddenTimestampRef = useRef<number | null>(null);

  // Force re-render trigger
  const [, setRenderTick] = useState(0);

  // Track if we're in reload timeout
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if recovery is in progress to prevent duplicate triggers
  const recoveryInProgressRef = useRef(false);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[SystemWakeHandler]', ...args);
    }
  }, [debug]);

  const handleWakeFromStandby = useCallback((source: string) => {
    // Prevent duplicate recovery attempts
    if (recoveryInProgressRef.current) {
      log(`Recovery already in progress, ignoring trigger from: ${source}`);
      return;
    }

    const now = Date.now();
    const hiddenDuration = hiddenTimestampRef.current
      ? now - hiddenTimestampRef.current
      : 0;

    log(`Wake detected from ${source}! Hidden duration: ${Math.round(hiddenDuration / 1000)}s`);

    // Check if WebView appears corrupted even for short hides
    const corrupted = isWebViewCorrupted();
    if (corrupted) {
      log('WebView appears corrupted, forcing recovery regardless of duration');
    }

    // If hidden for less than threshold AND not corrupted, just a quick focus change
    if (hiddenDuration < standbyThreshold && !corrupted) {
      log('Short hide and not corrupted, ignoring');
      hiddenTimestampRef.current = null;
      return;
    }

    log(`Triggering wake recovery (duration: ${Math.round(hiddenDuration / 1000)}s, corrupted: ${corrupted})...`);
    recoveryInProgressRef.current = true;

    // STEP 1: Force CSS repaint (helps WebView recover rendering)
    log('Step 1: Forcing CSS repaint...');
    forceRepaint();

    // STEP 2: Try React re-render (preserves state)
    log('Step 2: Attempting React re-render...');
    setRenderTick(prev => prev + 1);

    // STEP 3: Second repaint attempt after a short delay
    setTimeout(() => {
      if (isWebViewCorrupted()) {
        log('Step 3: Still corrupted, trying aggressive repaint...');
        // Force all children to re-layout
        document.body.style.opacity = '0';
        void document.body.offsetHeight;
        document.body.style.opacity = '1';
        forceRepaint();
        setRenderTick(prev => prev + 1);
      } else {
        log('Step 3: Recovery successful after re-render');
        recoveryInProgressRef.current = false;
      }
    }, 200);

    // STEP 4: Fallback to reload if still broken
    reloadTimeoutRef.current = setTimeout(() => {
      if (isWebViewCorrupted()) {
        log('Step 4: Still corrupted after all recovery attempts, falling back to full reload');
        window.location.reload();
      } else {
        log('Step 4: Recovery successful, no reload needed');
        recoveryInProgressRef.current = false;
      }
    }, reloadTimeout);

    // Clear hidden timestamp
    hiddenTimestampRef.current = null;
  }, [standbyThreshold, reloadTimeout, log]);

  // Handler for pageshow event (most reliable for wake recovery)
  const handlePageShow = useCallback((event: PageTransitionEvent) => {
    log('pageshow event fired, persisted:', event.persisted);

    // event.persisted is true when page is restored from BFCache or similar
    // This is the most reliable indicator of wake from standby
    if (event.persisted) {
      log('Page restored from cache (persisted=true), triggering recovery');
      handleWakeFromStandby('pageshow-persisted');
    } else if (hiddenTimestampRef.current) {
      // Even without persisted, if we were hidden, check duration
      handleWakeFromStandby('pageshow');
    }
  }, [handleWakeFromStandby, log]);

  // Handler for pagehide event
  const handlePageHide = useCallback(() => {
    log('pagehide event fired, recording timestamp');
    hiddenTimestampRef.current = Date.now();
  }, [log]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Document hidden - record timestamp
      hiddenTimestampRef.current = Date.now();
      log('Document hidden (visibilitychange), recording timestamp');
    } else {
      // Document visible again - check if we woke from standby
      log('Document visible again (visibilitychange)');
      handleWakeFromStandby('visibilitychange');
    }
  }, [handleWakeFromStandby, log]);

  const handleWindowFocus = useCallback(() => {
    // Window focused - check if we woke from standby
    if (hiddenTimestampRef.current) {
      log('Window focused after being hidden');
      handleWakeFromStandby('window-focus');
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
    log('Initializing system wake handler (enhanced version)');

    // Browser API - pageshow/pagehide (most reliable for wake recovery)
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

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
            handleWakeFromStandby('tauri-focus');
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
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (unlistenFocus) {
        unlistenFocus();
      }
    };
  }, [handlePageShow, handlePageHide, handleVisibilityChange, handleWindowFocus, handleWakeFromStandby, log]);

  // If we successfully re-rendered, cancel the reload timeout
  useEffect(() => {
    if (reloadTimeoutRef.current) {
      log('Component re-rendered successfully, canceling reload timeout');
      clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
      recoveryInProgressRef.current = false;
    }
  });

  // Return nothing - this hook just sets up side effects
}

export default useSystemWakeHandler;
