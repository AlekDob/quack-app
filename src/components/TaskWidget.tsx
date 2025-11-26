/**
 * Task Widget Component
 *
 * Displays droid/subagent invocations with the agent's color and avatar.
 */

import { useAgentInfo } from '../hooks/useAgentInfo';
import { getDuckdroidUrl } from '../utils/agentAvatars';

interface TaskWidgetProps {
  subagentType: string;
  description: string;
  isLoading: boolean;
  workingDirectory?: string;
}

export function TaskWidget({ subagentType, description, isLoading, workingDirectory }: TaskWidgetProps) {
  const { avatarUrl, color, model } = useAgentInfo(subagentType, workingDirectory);

  // Format display name: "strategic-project-advisor" -> "Strategic Project Advisor"
  const displayName = subagentType
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Convert hex color to rgba for backgrounds
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div
      className="tool-widget task-widget"
      style={{
        background: `linear-gradient(135deg, ${hexToRgba(color, 0.15)} 0%, ${hexToRgba(color, 0.05)} 100%)`,
        borderColor: hexToRgba(color, 0.4),
      }}
    >
      <div
        className="tool-widget-header"
        style={{ background: hexToRgba(color, 0.1) }}
      >
        <div className="tool-widget-title" style={{ color }}>
          <img
            src={avatarUrl || getDuckdroidUrl()}
            alt={subagentType}
            className="tool-widget-agent-avatar"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              objectFit: 'contain',
              marginRight: '6px',
            }}
          />
          <span>Droid: <strong style={{ color: 'rgba(255, 255, 255, 0.95)' }}>{displayName}</strong></span>
        </div>
        <span className="tool-widget-meta">{description}</span>
        {isLoading && (
          <div className="tool-widget-loading">
            <div
              className="spinner"
              style={{
                borderColor: hexToRgba(color, 0.2),
                borderTopColor: hexToRgba(color, 0.8),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
