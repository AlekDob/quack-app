/**
 * DormantAgentChip
 *
 * Compact chip rendered in the "DORMANT" row of the sidebar.
 * Shows a tiny avatar to the left of the agent's name and starts a new
 * session when clicked. Avatar resolution mirrors the active agent card:
 * - default avatars resolve via `getAvatarUrl`
 * - custom UUID avatars resolve via `getCustomAvatarUrl` (async)
 * - while the URL is loading (or on failure), a colored dot fallback is shown.
 */

import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCustomAvatarUrl, isCustomAvatar } from '../utils/customAvatarStorage';
import type { TerminalInfo } from '../types';

interface DormantAgentChipProps {
  agent: TerminalInfo;
  onClick: (e: React.MouseEvent) => void;
}

function resolveDefaultAvatar(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

export default function DormantAgentChip({ agent, onClick }: DormantAgentChipProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!agent.avatar) {
      setAvatarUrl(null);
      return;
    }

    if (isCustomAvatar(agent.avatar)) {
      getCustomAvatarUrl(agent.avatar)
        .then((url) => {
          if (mounted) setAvatarUrl(url);
        })
        .catch(() => {
          if (mounted) setAvatarUrl(null);
        });
    } else {
      setAvatarUrl(resolveDefaultAvatar(agent.avatar));
    }

    return () => {
      mounted = false;
    };
  }, [agent.avatar]);

  const fallbackColor = agent.color || 'rgba(255,255,255,0.35)';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.55)',
        borderRadius: '10px',
        padding: '2px 8px 2px 3px',
        fontSize: '11px',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
        e.currentTarget.style.borderColor = agent.color || 'rgba(255,255,255,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          width={14}
          height={14}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
            background: fallbackColor,
          }}
          onError={(e) => {
            // Fall back to colored dot if image fails to load
            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: fallbackColor,
            flexShrink: 0,
          }}
        />
      )}
      <span>{agent.label}</span>
    </button>
  );
}
