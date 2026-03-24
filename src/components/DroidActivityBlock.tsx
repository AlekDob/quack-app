/**
 * DroidActivityBlock — Wraps consecutive nested tool calls from the same droid
 * into a single visual block: avatar + name once, all tool events inside.
 */

import { useAgentInfo } from '../hooks/useAgentInfo';

interface DroidActivityBlockProps {
  droidType: string;
  workingDirectory?: string;
  children: React.ReactNode;
}

export function DroidActivityBlock({ droidType, workingDirectory, children }: DroidActivityBlockProps) {
  const { avatarUrl } = useAgentInfo(droidType, workingDirectory);
  const displayName = droidType
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <div className="droid-activity-block">
      <img src={avatarUrl} alt={droidType} className="droid-activity-avatar" />
      <div className="droid-activity-content">
        <span className="droid-activity-name">{displayName}</span>
        {children}
      </div>
    </div>
  );
}
