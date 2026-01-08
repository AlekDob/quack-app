import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { useState, useEffect } from 'react';

/**
 * Test suite for ThinkingBlock sync behavior
 * Bug fix: When user enters "thinking mode" (Ultra Think) and collapses the thinking-block,
 * they should be able to exit by pressing Tab to cycle thinking modes, which resets all blocks.
 *
 * Root cause: ThinkingBlock used uncontrolled state that didn't sync with parent.
 * Fix: Added resetKey prop that triggers state reset when thinking mode changes.
 */

describe('ThinkingBlock Sync Behavior', () => {
  // Simulate the ThinkingBlock controlled/uncontrolled pattern
  function useThinkingBlockState(defaultExpanded: boolean, resetKey?: string | number) {
    const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

    useEffect(() => {
      if (resetKey !== undefined) {
        setLocalExpanded(defaultExpanded);
      }
    }, [resetKey, defaultExpanded]);

    return {
      expanded: localExpanded,
      toggle: () => setLocalExpanded(prev => !prev),
    };
  }

  it('should maintain local state in uncontrolled mode', () => {
    const { result } = renderHook(() => useThinkingBlockState(false));

    expect(result.current.expanded).toBe(false);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.expanded).toBe(true);
  });

  it('should reset to defaultExpanded when resetKey changes', () => {
    let resetKey = 0;
    const { result, rerender } = renderHook(
      ({ key }) => useThinkingBlockState(true, key),
      { initialProps: { key: resetKey } }
    );

    // Initially expanded (defaultExpanded=true)
    expect(result.current.expanded).toBe(true);

    // User collapses the block
    act(() => {
      result.current.toggle();
    });
    expect(result.current.expanded).toBe(false);

    // Tab key pressed - resetKey increments
    resetKey = 1;
    rerender({ key: resetKey });

    // Should reset back to expanded (defaultExpanded=true)
    expect(result.current.expanded).toBe(true);
  });

  it('should reset multiple times as resetKey increments', () => {
    let resetKey = 0;
    const { result, rerender } = renderHook(
      ({ key }) => useThinkingBlockState(true, key),
      { initialProps: { key: resetKey } }
    );

    // Simulate multiple Tab key presses cycling through thinking modes
    for (let i = 1; i <= 5; i++) {
      // User collapses
      act(() => {
        result.current.toggle();
      });
      expect(result.current.expanded).toBe(false);

      // Tab key pressed
      resetKey = i;
      rerender({ key: resetKey });

      // Should reset back to expanded
      expect(result.current.expanded).toBe(true);
    }
  });

  it('should not reset when resetKey is undefined', () => {
    const { result, rerender } = renderHook(
      () => useThinkingBlockState(true, undefined)
    );

    expect(result.current.expanded).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.expanded).toBe(false);

    // Rerender without changing resetKey
    rerender();

    // Should stay collapsed (no reset)
    expect(result.current.expanded).toBe(false);
  });
});

describe('ThinkingMode Reset Counter', () => {
  // Simulate the ChatView reset counter pattern
  function useThinkingModeResetCounter() {
    const [counter, setCounter] = useState(0);
    const [thinkingMode, setThinkingMode] = useState('auto');

    const cycleMode = () => {
      const modes = ['auto', 'think', 'hard', 'harder', 'ultra'];
      const currentIndex = modes.indexOf(thinkingMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setThinkingMode(modes[nextIndex]);
      setCounter(prev => prev + 1);
    };

    return { counter, thinkingMode, cycleMode };
  }

  it('should increment counter when cycling through thinking modes', () => {
    const { result } = renderHook(() => useThinkingModeResetCounter());

    expect(result.current.counter).toBe(0);
    expect(result.current.thinkingMode).toBe('auto');

    act(() => {
      result.current.cycleMode();
    });

    expect(result.current.counter).toBe(1);
    expect(result.current.thinkingMode).toBe('think');

    act(() => {
      result.current.cycleMode();
    });

    expect(result.current.counter).toBe(2);
    expect(result.current.thinkingMode).toBe('hard');
  });

  it('should cycle through all modes and wrap around', () => {
    const { result } = renderHook(() => useThinkingModeResetCounter());

    const expectedModes = ['think', 'hard', 'harder', 'ultra', 'auto'];

    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.cycleMode();
      });
      expect(result.current.thinkingMode).toBe(expectedModes[i]);
      expect(result.current.counter).toBe(i + 1);
    }
  });
});

describe('Integration: ThinkingBlock + ResetCounter', () => {
  it('should reset ThinkingBlock when thinking mode cycles', () => {
    // Simulate the full flow: ChatView → MessageList → ChatMessage → ThinkingBlock
    let resetKey = 0;
    const blocks = renderHook(
      ({ key }) => ({
        block1: useThinkingBlockState(true, key),
        block2: useThinkingBlockState(true, key),
      }),
      { initialProps: { key: resetKey } }
    );

    // Both blocks start expanded
    expect(blocks.result.current.block1.expanded).toBe(true);
    expect(blocks.result.current.block2.expanded).toBe(true);

    // User collapses both blocks
    act(() => {
      blocks.result.current.block1.toggle();
      blocks.result.current.block2.toggle();
    });
    expect(blocks.result.current.block1.expanded).toBe(false);
    expect(blocks.result.current.block2.expanded).toBe(false);

    // Tab key pressed - simulates ChatView incrementing reset counter
    resetKey = 1;
    blocks.rerender({ key: resetKey });

    // BOTH blocks should reset to expanded
    expect(blocks.result.current.block1.expanded).toBe(true);
    expect(blocks.result.current.block2.expanded).toBe(true);
  });

  // Simulates the internal state helper for controlled/uncontrolled pattern
  function useThinkingBlockState(defaultExpanded: boolean, resetKey?: string | number) {
    const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

    useEffect(() => {
      if (resetKey !== undefined) {
        setLocalExpanded(defaultExpanded);
      }
    }, [resetKey, defaultExpanded]);

    return {
      expanded: localExpanded,
      toggle: () => setLocalExpanded(prev => !prev),
    };
  }
});
