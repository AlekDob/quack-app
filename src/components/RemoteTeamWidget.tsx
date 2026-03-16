/**
 * Remote Team Widget
 *
 * Renders inline in the orchestrator's chat when a Remote Team is created.
 * Shows team members with avatars, status dots, and task descriptions.
 * Clicking a member navigates to their session.
 */

import { useAgentAvatar } from '../hooks/useAgentAvatar';

interface RemoteTeamMember {
  agentId: string;
  agentName: string;
  role?: string;
  task: string;
  sessionId?: string;
  status: string;
}

interface RemoteTeamWidgetProps {
  teamName: string;
  members: RemoteTeamMember[];
  teamStatus: string;
  onMemberClick?: (agentId: string, sessionId: string) => void;
  agentAvatars?: Map<string, { avatar?: string; color?: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  running: '#22d3ee',
  completed: '#4ade80',
  failed: '#ef4444',
};

export function RemoteTeamWidget({
  teamName,
  members,
  teamStatus,
  onMemberClick,
  agentAvatars,
}: RemoteTeamWidgetProps) {
  const completedCount = members.filter(m => m.status === 'completed').length;
  const isTeamDone = teamStatus === 'completed';

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, rgba(255,107,53,0.08) 0%, rgba(0,78,137,0.06) 100%)',
      border: '1px solid rgba(255,107,53,0.2)',
      margin: '6px 0',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <CrownIcon />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,107,53,0.9)' }}>
          {teamName}
        </span>
        <span style={{
          fontSize: '10px',
          color: isTeamDone ? '#4ade80' : 'rgba(255,255,255,0.4)',
          marginLeft: 'auto',
        }}>
          {completedCount}/{members.length} {isTeamDone ? 'done' : 'in progress'}
        </span>
      </div>

      {/* Members */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {members.map(member => (
          <MemberRow
            key={member.agentId}
            member={member}
            avatar={agentAvatars?.get(member.agentId)?.avatar}
            color={agentAvatars?.get(member.agentId)?.color || '#00D9FF'}
            onClick={onMemberClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Member Row ───────────────────────────────────────────────────

interface MemberRowProps {
  member: RemoteTeamMember;
  avatar?: string;
  color: string;
  onClick?: (agentId: string, sessionId: string) => void;
}

function MemberRow({ member, avatar, color, onClick }: MemberRowProps) {
  const avatarUrl = useAgentAvatar(member.agentName, avatar);
  const statusColor = STATUS_COLORS[member.status] || '#888';
  const isClickable = !!member.sessionId && !!onClick;

  return (
    <div
      onClick={() => isClickable && onClick!(member.agentId, member.sessionId!)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 6px',
        borderRadius: '6px',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        if (isClickable) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Avatar */}
      <img
        src={avatarUrl}
        alt={member.agentName}
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${color}55`,
          flexShrink: 0,
        }}
      />

      {/* Status dot */}
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: statusColor,
        flexShrink: 0,
        animation: member.status === 'running' ? 'teammate-pulse 1.5s ease-in-out infinite' : 'none',
      }} />

      {/* Name + task */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            {member.agentName}
          </span>
          {member.role && (
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)' }}>
              {member.role}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.45)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {member.task.slice(0, 80)}{member.task.length > 80 ? '...' : ''}
        </div>
      </div>

      {/* Click hint */}
      {isClickable && (
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          view
        </span>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────

function CrownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,107,53,0.8)">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
    </svg>
  );
}
