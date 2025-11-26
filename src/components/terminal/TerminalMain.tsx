/**
 * TerminalMain Component
 *
 * Main container for managing multiple terminal instances
 * Replaces the old div.terminal-main with clean, composable architecture
 */

import { type TerminalThemeName } from './TerminalThemes';
import { TerminalInstance } from './TerminalInstance';
import type { ProjectTerminal } from '../../types';
import './TerminalMain.css';

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
 *
 * Usage:
 * ```tsx
 * <TerminalMain
 *   terminals={projectTerminals}
 *   activeTerminalId={activeId}
 *   themeName="tokyo-night"
 * />
 * ```
 */
export function TerminalMain({
  terminals,
  activeTerminalId,
  themeName = 'tokyo-night',
  onTerminalData,
  onTerminalExit,
}: TerminalMainProps) {
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
}
