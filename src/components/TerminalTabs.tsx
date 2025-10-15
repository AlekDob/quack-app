import type { TerminalInfo } from '../types';
import './TerminalTabs.css';

interface TerminalTabsProps {
  terminals: TerminalInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export default function TerminalTabs({
  terminals,
  activeId,
  onSelect,
  onClose,
}: TerminalTabsProps) {
  if (terminals.length === 0) {
    return null;
  }

  return (
    <div className="terminal-tabs">
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          className={`terminal-tab ${terminal.id === activeId ? 'active' : ''}`}
          onClick={() => onSelect(terminal.id)}
          style={{
            borderTopColor: terminal.color,
          }}
        >
          <div
            className="terminal-tab-indicator"
            style={{ backgroundColor: terminal.color }}
          />
          <span className="terminal-tab-label">{terminal.label}</span>
          {terminal.status === 'busy' && (
            <span className="terminal-tab-status busy" title="Running">
              ●
            </span>
          )}
          <button
            type="button"
            className="terminal-tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(terminal.id);
            }}
            aria-label={`Close ${terminal.label}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
