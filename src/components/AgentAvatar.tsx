/**
 * Agent Avatar Component
 *
 * Wrapper component that handles async avatar loading for agents.
 * Supports both default avatars (sync) and custom avatars (async).
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';

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

  return (
    <img
      src={avatarUrl || '/duckdroid.png'} // Fallback while loading
      alt={alt || agentName}
      className={className}
      style={style}
    />
  );
}
