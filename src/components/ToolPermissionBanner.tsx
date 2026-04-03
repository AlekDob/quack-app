import { useState } from 'react';
import type { PendingToolPermission } from '../types';
import './ToolPermissionBanner.css';

// Brain: pattern-permission-modes (Ask mode)

interface ToolPermissionBannerProps {
  permission: PendingToolPermission;
  onRespond: (requestId: string, approved: boolean) => void;
}

function getToolTarget(input: Record<string, unknown>): string {
  const filePath = input.file_path || input.filePath || input.path;
  if (typeof filePath === 'string') {
    const parts = filePath.split(/[/\\]/);
    return parts.slice(-2).join('/');
  }
  if (typeof input.command === 'string') {
    return input.command.length > 50
      ? input.command.slice(0, 47) + '...'
      : input.command;
  }
  if (typeof input.pattern === 'string') return input.pattern;
  return '';
}

export default function ToolPermissionBanner({ permission, onRespond }: ToolPermissionBannerProps) {
  const [responded, setResponded] = useState(false);
  const target = getToolTarget(permission.input);

  const handle = (approved: boolean) => {
    if (responded) return;
    setResponded(true);
    onRespond(permission.requestId, approved);
  };

  if (responded) return null;

  return (
    <div className="tp-banner">
      <div className="tp-left">
        <span className="tp-tool">{permission.toolName}</span>
        {target && <span className="tp-target">{target}</span>}
      </div>
      <div className="tp-actions">
        <button className="tp-btn tp-deny" onClick={() => handle(false)}>
          Deny
        </button>
        <button className="tp-btn tp-allow" onClick={() => handle(true)}>
          Allow
        </button>
      </div>
    </div>
  );
}
