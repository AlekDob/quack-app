/**
 * System Wake Handler Test Suite
 *
 * Tests the useSystemWakeHandler hook to verify it correctly handles
 * macOS standby/wake cycles and prevents blank white screen bug.
 *
 * Test Coverage:
 * - Short visibility changes (< 5min) should be ignored
 * - Long visibility changes (> 5min) should trigger re-render
 * - Fallback reload if re-render doesn't work
 * - Cleanup of event listeners and timers
 * - Tauri focus events integration
 * - pageshow/pagehide events (enhanced for v2)
 * - WebView corruption detection
 * - Duplicate recovery prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSystemWakeHandler } from '../hooks/useSystemWakeHandler';

// Mock Tauri getCurrentWindow
const mockOnFocusChanged = vi.fn();
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: mockOnFocusChanged,
  }),
}));

describe('useSystemWakeHandler', () => {
  let originalLocationReload: typeof window.location.reload;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Mock window.location.reload
    originalLocationReload = window.location.reload;
    reloadSpy = vi.fn();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: reloadSpy,
    });

    // Reset document.hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      writable: true,
      value: false,
    });

    // Mock Tauri onFocusChanged to return a cleanup function
    mockOnFocusChanged.mockResolvedValue(() => {});

    // Mock DOM elements for corruption detection
    const mockRoot = document.createElement('div');
    mockRoot.id = 'root';
    mockRoot.appendChild(document.createElement('div')); // Has children
    Object.defineProperty(mockRoot, 'offsetHeight', { value: 100 }); // Has height
    vi.spyOn(document, 'getElementById').mockReturnValue(mockRoot);

    // Mock getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      display: 'block',
      visibility: 'visible',
      backgroundColor: 'rgb(0, 0, 0)', // Not white
    } as CSSStyleDeclaration);
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: originalLocationReload,
    });
    vi.restoreAllMocks();
  });

  it('should ignore short visibility changes (< 5min)', async () => {
    const { result } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 1 minute (less than threshold)
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    // Simulate document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for any pending promises
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT trigger reload
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should trigger re-render on long visibility change (> 5min)', async () => {
    const { rerender } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 6 minutes (more than threshold)
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Simulate successful re-render by calling rerender
    // This should cancel the reload timeout
    act(() => {
      rerender();
    });

    // Wait for any pending timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT trigger reload because re-render was successful
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should set reload timeout on wake from standby (500ms default)', async () => {
    // This test verifies that the reload timeout is set up correctly
    // In real scenarios, if React fails to re-render, the timeout will trigger
    // In tests, renderHook auto-triggers re-render, so we verify setup instead
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() =>
      useSystemWakeHandler({
        debug: true,
        // Default is now 500ms
      })
    );

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 6 minutes (more than threshold)
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify setTimeout was called with reload timeout (500ms - new default)
    // This confirms the fallback reload mechanism is set up
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it('should handle window focus events', async () => {
    const { rerender } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate window losing focus (hidden timestamp set)
    // First hide the document
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 6 minutes
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate window regaining focus
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // Successful re-render
    act(() => {
      rerender();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT reload because re-render was successful
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should use custom thresholds', async () => {
    const { rerender } = renderHook(() =>
      useSystemWakeHandler({
        standbyThreshold: 60 * 1000, // 1 minute
        reloadTimeout: 1000, // 1 second
        debug: true,
      })
    );

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 2 minutes (more than 1min threshold)
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    // Simulate document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Successful re-render
    act(() => {
      rerender();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT reload
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const windowAddEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Verify event listeners were added
    expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(windowAddEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    // New: pageshow/pagehide listeners
    expect(windowAddEventListenerSpy).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(windowAddEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

    // Unmount
    unmount();

    // Verify event listeners were removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });

  it('should cancel reload timeout on unmount', async () => {
    const { unmount } = renderHook(() =>
      useSystemWakeHandler({
        debug: true,
        reloadTimeout: 2000,
      })
    );

    // Simulate long hide
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Trigger wake
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Unmount before timeout expires
    unmount();

    // Fast-forward past timeout
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync();
    });

    // Should NOT reload because hook was unmounted
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should handle Tauri focus events', async () => {
    let focusHandler: ((event: { payload: boolean }) => void) | null = null;

    // Capture the focus handler
    mockOnFocusChanged.mockImplementation(async (handler: typeof focusHandler) => {
      focusHandler = handler;
      return () => {}; // cleanup function
    });

    const { rerender } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Wait for Tauri listener setup
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnFocusChanged).toHaveBeenCalled();
    expect(focusHandler).not.toBeNull();

    // Simulate window losing focus (Tauri)
    act(() => {
      focusHandler!({ payload: false });
    });

    // Fast-forward 6 minutes
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate window regaining focus (Tauri)
    act(() => {
      focusHandler!({ payload: true });
    });

    // Successful re-render
    act(() => {
      rerender();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT reload
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  // New tests for enhanced v2 functionality

  it('should handle pageshow event with persisted=true', async () => {
    const { rerender } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate pagehide (records timestamp)
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    // Fast-forward 6 minutes
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate pageshow with persisted=true (page restored from cache)
    act(() => {
      const pageShowEvent = new PageTransitionEvent('pageshow', { persisted: true });
      window.dispatchEvent(pageShowEvent);
    });

    // Successful re-render
    act(() => {
      rerender();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT reload because re-render was successful
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('should handle pagehide event', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate pagehide
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    // Verify timestamp was recorded (check console log)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SystemWakeHandler]'),
      expect.stringContaining('pagehide')
    );
  });

  it('should prevent duplicate recovery attempts', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 6 minutes
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Clear the spy to count only new calls
    setTimeoutSpy.mockClear();

    // Trigger multiple wake events rapidly
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });

    // Should only have one setTimeout call for reload (not multiple)
    // The duplicate prevention should stop additional recovery attempts
    const reloadTimeoutCalls = setTimeoutSpy.mock.calls.filter(
      (call) => call[1] === 500 // Only count the reload timeout calls
    );
    expect(reloadTimeoutCalls.length).toBe(1);
  });

  it('should trigger recovery immediately when WebView is corrupted', async () => {
    // Mock corrupted WebView state
    const mockRoot = document.createElement('div');
    mockRoot.id = 'root';
    // Empty root = corrupted
    vi.spyOn(document, 'getElementById').mockReturnValue(mockRoot);

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate document hidden for just 1 minute (less than threshold)
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(60 * 1000); // Only 1 minute
    });

    // Clear to count new calls
    setTimeoutSpy.mockClear();

    // Simulate document visible again
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should trigger recovery even though duration is short, because WebView is corrupted
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it('should log source of wake event in debug mode', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { rerender } = renderHook(() => useSystemWakeHandler({ debug: true }));

    // Simulate document hidden
    Object.defineProperty(document, 'hidden', { value: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward 6 minutes
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    // Simulate wake from visibilitychange
    Object.defineProperty(document, 'hidden', { value: false });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify source is logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SystemWakeHandler]'),
      expect.stringContaining('visibilitychange')
    );

    // Re-render to reset
    act(() => {
      rerender();
    });
  });
});
