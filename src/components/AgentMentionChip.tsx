/**
 * Agent Mention Chip Component
 *
 * Displays an agent mention with avatar in chat messages.
 * Handles async avatar loading for both default and custom avatars.
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';
import './ChatMessage.css';

interface AgentMentionChipProps {
  agentName: string;
}

export function AgentMentionChip({ agentName }: AgentMentionChipProps) {
  const avatarUrl = useAgentAvatar(agentName, undefined);

  return (
    <span className="agent-mention-chip">
      <img
        src={avatarUrl || '/duck.png'}
        alt={agentName}
        className="agent-mention-avatar"
      />
      <span className="agent-mention-name">@{agentName}</span>
    </span>
  );
}
