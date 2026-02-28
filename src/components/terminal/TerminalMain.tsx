/**
 * TerminalMain Component
 *
 * Main container for managing multiple terminal instances
 * Replaces the old div.terminal-main with clean, composable architecture
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { type TerminalThemeName } from './TerminalThemes';
import { TerminalInstance, type TerminalInstanceHandle } from './TerminalInstance';
import type { ProjectTerminal } from '../../types';
import './TerminalMain.css';

/** Imperative API exposed by TerminalMain via ref */
export interface TerminalMainHandle {
  find: () => void;
  filter: () => void;
  clear: () => void;
}

export interface TerminalMainProps {
  /** List of project terminals */
  terminals: ProjectTerminal[];
  /** Currently active terminal ID */
  activeTerminalId: string | null;
  /** Theme to apply to all terminals */
  themeName?: TerminalThemeName;
  /** Callback when terminal receives data */
  onTerminalData?: (terminalId: string, data: string) => void;
  /** Callback when terminal exits */
  onTerminalExit?: (terminalId: string) => void;
}

/**
 * Main terminal container
 *
 * Features:
 * - Renders all terminals but only shows active one
 * - Preserves terminal state when switching
 * - Clean empty state UI
 * - Consistent theme across all terminals
 * - Exposes { find, filter, clear } via ref, delegating to the active terminal
 */
export const TerminalMain = forwardRef<TerminalMainHandle, TerminalMainProps>(function TerminalMain({
  terminals,
  activeTerminalId,
  themeName = 'tokyo-night',
  onTerminalData,
  onTerminalExit,
}, ref) {
  // Track refs to each TerminalInstance by terminal ID
  const instanceRefs = useRef<Map<string, TerminalInstanceHandle>>(new Map());
  // Stable per-ID callback refs — avoids creating new functions on each render
  const refCallbacks = useRef<Map<string, (h: TerminalInstanceHandle | null) => void>>(new Map());

  function getRefCallback(terminalId: string) {
    if (!refCallbacks.current.has(terminalId)) {
      refCallbacks.current.set(terminalId, (handle) => {
        if (handle) {
          instanceRefs.current.set(terminalId, handle);
        } else {
          instanceRefs.current.delete(terminalId);
          refCallbacks.current.delete(terminalId);
        }
      });
    }
    return refCallbacks.current.get(terminalId)!;
  }

  // Delegate to the active terminal's handle
  useImperativeHandle(ref, () => ({
    find: () => { if (activeTerminalId) instanceRefs.current.get(activeTerminalId)?.find(); },
    filter: () => { if (activeTerminalId) instanceRefs.current.get(activeTerminalId)?.filter(); },
    clear: () => { if (activeTerminalId) instanceRefs.current.get(activeTerminalId)?.clear(); },
  }), [activeTerminalId]);

  // Empty state - no terminals
  if (terminals.length === 0) {
    return (
      <div className="terminal-main">
        <div className="terminal-empty">
          <div className="terminal-empty-icon">&gt;_</div>
          <p className="terminal-empty-title">No terminals yet</p>
          <p className="terminal-empty-hint">
            Select a project and click + to create a terminal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-main">
      {terminals.map((terminal) => (
        <TerminalInstance
          key={terminal.id}
          ref={getRefCallback(terminal.id)}
          terminalId={terminal.id}
          isActive={terminal.id === activeTerminalId}
          themeName={themeName}
          cursorColor={terminal.color}
          onData={(data) => onTerminalData?.(terminal.id, data)}
          onExit={() => onTerminalExit?.(terminal.id)}
        />
      ))}
    </div>
  );
});
