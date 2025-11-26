import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../stores/terminalStore';
import type { ProjectTerminal } from '../types';
import './ProjectTerminalItem.css';

interface ProjectTerminalItemProps {
  terminal: ProjectTerminal;
  isActive: boolean;
  onSelect: (id: string) => void;
}

export function ProjectTerminalItem({
  terminal,
  isActive,
  onSelect,
}: ProjectTerminalItemProps) {
  const removeProjectTerminal = useTerminalStore(state => state.removeProjectTerminal);

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await invoke('close_terminal', { id: terminal.id });
      removeProjectTerminal(terminal.id);
    } catch (error) {
      console.error('Failed to close terminal:', error);
    }
  };

  return (
    <div
      className={`project-terminal-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(terminal.id)}
    >
      <div
        className="terminal-item-indicator"
        style={{ backgroundColor: terminal.color }}
      />
      <span className="terminal-item-name">{terminal.name}</span>

      {terminal.status === 'busy' && (
        <span className="terminal-item-status busy" title="Running">
          ●
        </span>
      )}

      <button
        type="button"
        className="terminal-item-close"
        onClick={handleClose}
        title="Close terminal"
      >
        ×
      </button>
    </div>
  );
}
