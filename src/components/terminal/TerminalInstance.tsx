/**
 * TerminalInstance Component
 *
 * Lightweight wrapper for a single terminal instance
 * Handles visibility, theme application, and lifecycle
 */

import { memo } from 'react';
import { useTerminal } from './useTerminal';
import { TERMINAL_THEMES, type TerminalThemeName } from './TerminalThemes';
import '@xterm/xterm/css/xterm.css';

export interface TerminalInstanceProps {
  /** Terminal ID from backend */
  terminalId: string;
  /** Whether this terminal is currently active/visible */
  isActive: boolean;
  /** Theme name to apply */
  themeName?: TerminalThemeName;
  /** Custom cursor color (overrides theme) */
  cursorColor?: string;
  /** Callback when terminal receives data */
  onData?: (data: string) => void;
  /** Callback when terminal exits */
  onExit?: () => void;
}

/**
 * Single terminal instance component
 *
 * Features:
 * - Uses useTerminal hook for clean lifecycle management
 * - Applies theme from TerminalThemes
 * - Handles visibility with opacity (not display:none) to preserve dimensions
 * - Memoized to prevent unnecessary re-renders
 */
function TerminalInstanceComponent({
  terminalId,
  isActive,
  themeName = 'tokyo-night',
  cursorColor,
  onData,
  onExit,
}: TerminalInstanceProps) {
  // Get theme colors
  const theme = TERMINAL_THEMES[themeName]?.colors || TERMINAL_THEMES['tokyo-night'].colors;

  // Initialize terminal with hook
  const { containerRef } = useTerminal({
    terminalId,
    theme,
    cursorColor,
    onData,
    onExit,
  });

  return (
    <div
      className="terminal-instance"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Use opacity instead of display:none to preserve dimensions
        opacity: isActive ? 1 : 0,
        // Disable pointer events when hidden
        pointerEvents: isActive ? 'auto' : 'none',
        // Stack order
        zIndex: isActive ? 1 : 0,
        // Match theme background
        background: theme.background,
        // Smooth transition
        transition: 'opacity 0.15s ease',
      }}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{
          width: '100%',
          height: '100%',
          padding: '8px',
        }}
      />
    </div>
  );
}

/**
 * Memoized export
 * Only re-render when props actually change
 */
export const TerminalInstance = memo(
  TerminalInstanceComponent,
  (prev, next) => {
    // Only re-render if these props change
    return (
      prev.terminalId === next.terminalId &&
      prev.isActive === next.isActive &&
      prev.themeName === next.themeName &&
      prev.cursorColor === next.cursorColor
    );
  }
);

TerminalInstance.displayName = 'TerminalInstance';
