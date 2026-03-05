/**
 * Task Agent Avatar Component
 *
 * Small avatar for task/subagent widgets in StreamMessage.
 * Handles async avatar loading.
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';

interface TaskAgentAvatarProps {
  subagentType: string;
}

export function TaskAgentAvatar({ subagentType }: TaskAgentAvatarProps) {
  const avatarUrl = useAgentAvatar(subagentType, undefined);

  return (
    <img
      src={avatarUrl || '/duck.png'}
      alt={subagentType}
      className="tool-widget-agent-avatar"
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        objectFit: 'contain',
        marginRight: '6px'
      }}
    />
  );
}
