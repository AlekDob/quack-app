import React from 'react';
import type { PipAgentState } from '../types';

interface PipAgentCardProps {
  agent: PipAgentState;
  onClick: () => void;
}

const PipAgentCard: React.FC<PipAgentCardProps> = ({ agent, onClick }) => {
  // Status icon mapping
  const getStatusIcon = (status: PipAgentState['status']) => {
    switch (status) {
      case 'idle':
        return '✅';
      case 'thinking':
        return '💭';
      case 'streaming':
        return '📝';
      case 'executing':
        return '⚡';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🦆';
    }
  };

  // Status color mapping
  const getStatusColor = (status: PipAgentState['status']) => {
    switch (status) {
      case 'idle':
        return '#10b981'; // green
      case 'thinking':
        return '#f59e0b'; // amber
      case 'streaming':
        return '#3b82f6'; // blue
      case 'executing':
        return '#8b5cf6'; // purple
      case 'completed':
        return '#10b981'; // green
      case 'error':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  // Status label mapping
  const getStatusLabel = (status: PipAgentState['status']) => {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'thinking':
        return 'Thinking...';
      case 'streaming':
        return 'Streaming...';
      case 'executing':
        return agent.currentTool ? `Running ${agent.currentTool}` : 'Executing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  // Format last activity time
  const formatLastActivity = (timestamp?: number) => {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ago`;
  };

  return (
    <div
      onClick={onClick}
      className="pip-agent-card rounded-lg p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'rgba(12, 16, 24, 0.8)',
        border: `1px solid ${agent.color}40`,
        backdropFilter: 'blur(10px)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(12, 16, 24, 0.95)';
        e.currentTarget.style.borderColor = `${agent.color}80`;
        e.currentTarget.style.boxShadow = `0 0 12px ${agent.color}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(12, 16, 24, 0.8)';
        e.currentTarget.style.borderColor = `${agent.color}40`;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header: Agent name and status icon */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
          style={{
            background: `${agent.color}20`,
            border: `1px solid ${agent.color}`,
          }}
        >
          {getStatusIcon(agent.status)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">
            {agent.agentName}
          </div>
          <div
            className="text-xs"
            style={{ color: getStatusColor(agent.status) }}
          >
            {getStatusLabel(agent.status)}
          </div>
        </div>
      </div>

      {/* Progress bar for executing tasks */}
      {agent.status === 'executing' && agent.progress !== undefined && (
        <div className="mb-2">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255, 255, 255, 0.1)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${agent.progress}%`,
                background: agent.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Last message preview */}
      {agent.lastMessage && (
        <div
          className="text-xs mb-1.5 line-clamp-2"
          style={{ color: 'rgba(255, 255, 255, 0.6)' }}
        >
          {agent.lastMessage}
        </div>
      )}

      {/* Error message */}
      {agent.error && (
        <div
          className="text-xs mb-1.5 line-clamp-2"
          style={{ color: '#ef4444' }}
        >
          ⚠️ {agent.error}
        </div>
      )}

      {/* Footer: Stats */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
        <span>{agent.toolsExecuted} tools executed</span>
        {agent.lastActivity && (
          <span>{formatLastActivity(agent.lastActivity)}</span>
        )}
      </div>
    </div>
  );
};

export default PipAgentCard;
