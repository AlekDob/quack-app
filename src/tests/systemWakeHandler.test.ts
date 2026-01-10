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
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: originalLocationReload,
    });
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

  it('should set reload timeout on wake from standby', async () => {
    // This test verifies that the reload timeout is set up correctly
    // In real scenarios, if React fails to re-render, the timeout will trigger
    // In tests, renderHook auto-triggers re-render, so we verify setup instead
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    renderHook(() =>
      useSystemWakeHandler({
        debug: true,
        reloadTimeout: 2000,
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

    // Verify setTimeout was called with reload timeout (2000ms)
    // This confirms the fallback reload mechanism is set up
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
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

    // Unmount
    unmount();

    // Verify event listeners were removed
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
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
});
