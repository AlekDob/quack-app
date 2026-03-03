import { useEffect, useRef } from 'react';
import type { TerminalInfo } from '../../types';
import type { ActionMenuData } from './officeTypes';

interface OfficeActionMenuProps {
  data: ActionMenuData;
  terminals: TerminalInfo[];
  onGoToChat: (agentId: string) => void;
  onClose: () => void;
}

export default function OfficeActionMenu({
  data,
  terminals,
  onGoToChat,
  onClose,
}: OfficeActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const agent = terminals.find(t => t.id === data.agentId);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!agent) return null;

  return (
    <div
      ref={menuRef}
      className="office-action-menu"
      style={{
        position: 'absolute',
        left: `${data.screenX + 30}px`,
        top: `${data.screenY}px`,
      }}
    >
      <div className="office-action-menu-header">
        <span
          className="office-action-menu-color"
          style={{ backgroundColor: agent.color }}
        />
        <strong>{agent.label}</strong>
      </div>
      <div className="office-action-menu-info">
        <span>{agent.status === 'busy' ? 'Lavorando' : 'In attesa'}</span>
        {agent.workingOn && <span>{agent.workingOn}</span>}
        {agent.branch && <span className="office-action-menu-branch">{agent.branch}</span>}
      </div>
      <div className="office-action-menu-actions">
        <button onClick={() => onGoToChat(agent.id)}>
          Vai alla Chat
        </button>
      </div>
    </div>
  );
}
