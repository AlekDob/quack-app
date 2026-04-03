import { useState, useEffect } from 'react';
import type { PendingToolPermission } from '../types';
import './ToolPermissionBanner.css';

// Brain: pattern-permission-modes (Ask mode)

interface ToolPermissionBannerProps {
  permission: PendingToolPermission;
  onRespond: (requestId: string, approved: boolean) => void;
  onAllowAlways?: (requestId: string) => void;
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

/** Build a human-readable preview of what the tool wants to do */
function getToolPreview(toolName: string, input: Record<string, unknown>): string | null {
  switch (toolName) {
    case 'Write': {
      const content = input.content;
      if (typeof content === 'string') {
        const lines = content.split('\n');
        const preview = lines.slice(0, 20).join('\n');
        return lines.length > 20 ? `${preview}\n... (${lines.length} lines total)` : preview;
      }
      return null;
    }
    case 'Edit': {
      const oldStr = input.old_string || input.oldString;
      const newStr = input.new_string || input.newString;
      if (typeof oldStr === 'string' && typeof newStr === 'string') {
        const parts: string[] = [];
        parts.push(`- ${oldStr.split('\n').slice(0, 8).join('\n- ')}`);
        parts.push('');
        parts.push(`+ ${newStr.split('\n').slice(0, 8).join('\n+ ')}`);
        return parts.join('\n');
      }
      return null;
    }
    case 'Bash': {
      const cmd = input.command;
      if (typeof cmd === 'string') return cmd;
      return null;
    }
    default:
      return null;
  }
}

export default function ToolPermissionBanner({ permission, onRespond, onAllowAlways }: ToolPermissionBannerProps) {
  const [responded, setResponded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const target = getToolTarget(permission.input);
  const preview = getToolPreview(permission.toolName, permission.input);

  const handle = (approved: boolean) => {
    if (responded) return;
    setResponded(true);
    onRespond(permission.requestId, approved);
  };

  const handleAlways = () => {
    if (responded) return;
    setResponded(true);
    onAllowAlways?.(permission.requestId);
  };

  // Keyboard shortcuts: A = Allow, S = Allow always, D = Deny, Space = toggle preview
  useEffect(() => {
    if (responded) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); handle(true); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleAlways(); }
      else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); handle(false); }
      else if (e.key === ' ' && preview) { e.preventDefault(); setExpanded(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (responded) return null;

  return (
    <div className={`tp-banner ${expanded ? 'tp-expanded' : ''}`}>
      <div className="tp-header">
        <div className="tp-left">
          <span className="tp-tool">{permission.toolName}</span>
          {target && <span className="tp-target">{target}</span>}
          {preview && (
            <button
              className="tp-toggle"
              onClick={() => setExpanded(p => !p)}
              title="Show details (Space)"
            >
              {expanded ? '\u25B4' : '\u25BE'}
            </button>
          )}
        </div>
        <div className="tp-actions">
          <button className="tp-btn tp-deny" onClick={() => handle(false)} title="Deny (D)">
            Deny
          </button>
          <button className="tp-btn tp-allow" onClick={() => handle(true)} title="Allow once (A)">
            Allow
          </button>
          {onAllowAlways && (
            <button className="tp-btn tp-always" onClick={handleAlways} title={`Allow all ${permission.toolName} in this session (S)`}>
              Always
            </button>
          )}
        </div>
      </div>
      {expanded && preview && (
        <pre className={`tp-preview ${permission.toolName === 'Edit' ? 'tp-diff' : ''}`}>
          {preview}
        </pre>
      )}
    </div>
  );
}
