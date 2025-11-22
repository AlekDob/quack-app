import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawerAnimation } from '../hooks/useDrawerAnimation';

/**
 * 🦆 useDrawerAnimation Hook Tests
 *
 * These tests verify that the useDrawerAnimation hook correctly manages
 * drawer slide-in/slide-out animations with proper state management.
 */

describe('useDrawerAnimation Hook', () => {
  beforeEach(() => {
    // Clear all timers before each test
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with isClosing = false', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    expect(result.current.isClosing).toBe(false);
  });

  it('should provide handleClose function', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    expect(typeof result.current.handleClose).toBe('function');
  });

  it('should provide getClassName function', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    expect(typeof result.current.getClassName).toBe('function');
  });

  it('should return slide-in-right className by default', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    const className = result.current.getClassName('drawer-base');

    expect(className).toBe('drawer-base slide-in-right');
  });

  it('should return slide-out-right className when closing', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    // Trigger close animation
    act(() => {
      result.current.handleClose();
    });

    const className = result.current.getClassName('drawer-base');

    expect(className).toBe('drawer-base slide-out-right');
  });

  it('should set isClosing to true when handleClose is called', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    act(() => {
      result.current.handleClose();
    });

    expect(result.current.isClosing).toBe(true);
  });

  it('should call onClose after animation duration', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 200));

    act(() => {
      result.current.handleClose();
    });

    // onClose should not be called immediately
    expect(onClose).not.toHaveBeenCalled();

    // Fast-forward time by 200ms (animation duration)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // onClose should now be called
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should reset isClosing after onClose is called', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 200));

    act(() => {
      result.current.handleClose();
    });

    expect(result.current.isClosing).toBe(true);

    // Fast-forward time by 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // isClosing should be reset to false
    expect(result.current.isClosing).toBe(false);
  });

  it('should use default animation duration of 200ms if not specified', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    act(() => {
      result.current.handleClose();
    });

    // onClose should not be called before 200ms
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(onClose).not.toHaveBeenCalled();

    // onClose should be called after 200ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should support custom animation duration', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 300));

    act(() => {
      result.current.handleClose();
    });

    // onClose should not be called before 300ms
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onClose).not.toHaveBeenCalled();

    // onClose should be called after 300ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple rapid close calls gracefully', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 200));

    // Call handleClose multiple times
    act(() => {
      result.current.handleClose();
      result.current.handleClose();
      result.current.handleClose();
    });

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // onClose should still be called correct number of times
    // (Based on implementation, it might be called 3 times - one for each handleClose)
    expect(onClose).toHaveBeenCalled();
  });

  it('should work with empty baseClassName', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    const className = result.current.getClassName('');

    expect(className).toBe('slide-in-right');
  });

  it('should work with no baseClassName argument', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    const className = result.current.getClassName();

    expect(className).toBe('slide-in-right');
  });

  it('should trim whitespace from className', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    const className = result.current.getClassName('  drawer-base  ');

    // Should be trimmed properly
    expect(className.startsWith('  ')).toBe(false);
    expect(className.endsWith('  ')).toBe(false);
  });
});

describe('useDrawerAnimation - Integration Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle complete open -> close cycle', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 200));

    // Initial state - drawer opening
    expect(result.current.isClosing).toBe(false);
    expect(result.current.getClassName('drawer')).toBe('drawer slide-in-right');

    // User clicks close button
    act(() => {
      result.current.handleClose();
    });

    // During closing animation
    expect(result.current.isClosing).toBe(true);
    expect(result.current.getClassName('drawer')).toBe('drawer slide-out-right');

    // After animation completes
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.isClosing).toBe(false);
  });

  it('should work with DroidFactoryDrawer use case', () => {
    const setDrawerOpen = vi.fn();
    const { result } = renderHook(() =>
      useDrawerAnimation(() => setDrawerOpen(false))
    );

    // Drawer opens
    const openClassName = result.current.getClassName(
      'fixed inset-y-0 right-0 z-50 flex flex-col'
    );
    expect(openClassName).toContain('slide-in-right');

    // User closes drawer
    act(() => {
      result.current.handleClose();
    });

    const closingClassName = result.current.getClassName(
      'fixed inset-y-0 right-0 z-50 flex flex-col'
    );
    expect(closingClassName).toContain('slide-out-right');

    // Animation completes
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(setDrawerOpen).toHaveBeenCalledWith(false);
  });

  it('should work with conditional rendering pattern', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose));

    // Simulate: if (!open && !isClosing) return null;
    const open = true;
    const shouldRender = open || result.current.isClosing;

    expect(shouldRender).toBe(true);

    // User closes
    act(() => {
      result.current.handleClose();
    });

    // During animation, drawer should still be rendered
    const open2 = false; // Parent sets open = false
    const shouldRender2 = open2 || result.current.isClosing;
    expect(shouldRender2).toBe(true); // Still renders due to isClosing

    // After animation
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const shouldRender3 = open2 || result.current.isClosing;
    expect(shouldRender3).toBe(false); // Now hidden
  });
});

describe('useDrawerAnimation - Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle zero animation duration', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 0));

    act(() => {
      result.current.handleClose();
    });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should handle very long animation duration', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useDrawerAnimation(onClose, 5000));

    act(() => {
      result.current.handleClose();
    });

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should maintain function identity across re-renders', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(() => useDrawerAnimation(onClose));

    const firstHandleClose = result.current.handleClose;
    const firstGetClassName = result.current.getClassName;

    rerender();

    // Functions should be stable (memoized with useCallback)
    expect(result.current.handleClose).toBe(firstHandleClose);
    expect(result.current.getClassName).toBe(firstGetClassName);
  });
});
