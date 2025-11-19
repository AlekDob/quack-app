/**
 * Agent Avatar Component
 *
 * Wrapper component that handles async avatar loading for agents.
 * Supports both default avatars (sync) and custom avatars (async).
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';
import { getDuckdroidUrl } from '../utils/agentAvatars';

interface AgentAvatarProps {
  agentName: string;
  avatarFilename?: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function AgentAvatar({
  agentName,
  avatarFilename,
  className,
  style,
  alt,
}: AgentAvatarProps) {
  const avatarUrl = useAgentAvatar(agentName, avatarFilename);

  console.log('[AgentAvatar] Rendering:', { agentName, avatarFilename, avatarUrl });

  return (
    <img
      src={avatarUrl || getDuckdroidUrl()} // Fallback while loading - use getDuckdroidUrl for proper Tauri path
      alt={alt || agentName}
      className={className}
      style={style}
      onLoad={() => console.log('[AgentAvatar] Image loaded successfully:', avatarUrl)}
      onError={(e) => {
        console.error('[AgentAvatar] Image failed to load:', {
          url: avatarUrl,
          agentName,
          avatarFilename,
          error: e
        });
      }}
    />
  );
}
