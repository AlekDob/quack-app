import type { TeamConfig } from '../types';

interface TeamStatusBadgeProps {
  team: TeamConfig;
  teammateCount?: number;
}

export default function TeamStatusBadge({ team, teammateCount }: TeamStatusBadgeProps) {
  const activeCount = teammateCount ?? team.members.filter((m) => !m.isLead).length;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'rgba(255, 107, 53, 0.15)',
        border: '1px solid rgba(255, 107, 53, 0.3)',
        fontSize: '10px',
        fontWeight: 600,
        color: 'rgba(255, 107, 53, 0.9)',
        lineHeight: 1,
      }}
    >
      {/* Crown icon for Team Lead */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
      </svg>
      <span>{activeCount}</span>
      <span style={{ color: 'rgba(255, 107, 53, 0.6)', fontWeight: 400 }}>
        {team.name}
      </span>
    </div>
  );
}
