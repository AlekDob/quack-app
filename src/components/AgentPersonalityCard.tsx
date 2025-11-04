import type { AgentPersonality } from '../types';
import './AgentPersonalityCard.css';

interface AgentPersonalityCardProps {
  personality: AgentPersonality | null;
  agentName?: string | null;
  agentAvatar?: string | null;
  agentWorkingOn?: string | null;
}

const FOCUS_AREAS_MAP: Record<string, { label: string; icon: string }> = {
  'feature-planning': { label: 'Feature Planning', icon: '🗺️' },
  'sprint-management': { label: 'Sprint Management', icon: '🏃' },
  'branch-coordination': { label: 'Branch Coordination', icon: '🌿' },
  'team-alignment': { label: 'Team Alignment', icon: '🤝' },
  'technical-oversight': { label: 'Technical Oversight', icon: '👁️' },
  'quality-assurance': { label: 'Quality Assurance', icon: '✅' },
  'delivery-tracking': { label: 'Delivery Tracking', icon: '📦' },
  'stakeholder-comms': { label: 'Stakeholder Communication', icon: '💬' },
};

const PERSONALITY_TRAITS_MAP: Record<string, { label: string; icon: string }> = {
  organized: { label: 'Organized', icon: '📋' },
  proactive: { label: 'Proactive', icon: '⚡' },
  pragmatic: { label: 'Pragmatic', icon: '🎯' },
  strategic: { label: 'Strategic', icon: '♟️' },
  collaborative: { label: 'Collaborative', icon: '🤝' },
  'detail-oriented': { label: 'Detail-oriented', icon: '🔍' },
  communicative: { label: 'Communicative', icon: '💬' },
  'results-driven': { label: 'Results-driven', icon: '🎯' },
  'mad-genius': { label: 'Mad Genius', icon: '🧪' },
};

const COMMUNICATION_STYLES_MAP: Record<string, string> = {
  professional: 'Professional',
  friendly: 'Friendly',
  casual: 'Casual',
  technical: 'Technical',
  sarcastic: 'Sarcastic',
};

// Helper function to get avatar image URL (works in both dev and production)
function getAvatarUrl(avatarName: string): string {
  // Check if we're in Tauri context
  if (window.__TAURI__) {
    // In Tauri v2, use asset:// protocol for bundled resources
    return `asset://localhost/images/ducks/avatars/${avatarName}`;
  }
  // In dev mode, use standard public path
  return `/images/ducks/avatars/${avatarName}`;
}

export default function AgentPersonalityCard({
  personality,
  agentName,
  agentAvatar,
  agentWorkingOn,
}: AgentPersonalityCardProps) {
  if (!personality) {
    return (
      <div className="agent-personality-card empty">
        <div className="personality-empty-state">
          <h3>No Agent Selected</h3>
          <p>Select an agent to view their personality configuration</p>
        </div>
      </div>
    );
  }

  // Extract personality traits from personality text
  const getPersonalityTraits = () => {
    if (!personality.personality) return [];
    const traits: Array<{ id: string; label: string; icon: string }> = [];
    Object.entries(PERSONALITY_TRAITS_MAP).forEach(([id, trait]) => {
      if (personality.personality?.toLowerCase().includes(trait.label.toLowerCase())) {
        traits.push({ id, ...trait });
      }
    });
    return traits;
  };

  const personalityTraits = getPersonalityTraits();

  return (
    <div className="agent-personality-card">
      <div className="personality-header">
        <div className="personality-avatar">
          {agentAvatar ? (
            <img
              src={getAvatarUrl(agentAvatar)}
              alt={agentName || personality.name}
              className="avatar-image"
              onError={(e) => {
                // Fallback to SVG icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<svg class="avatar-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="3"/><path d="M5 17a5 5 0 0 1 10 0"/></svg>';
                }
              }}
            />
          ) : (
            <svg className="avatar-icon-svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="7" r="3"/>
              <path d="M5 17a5 5 0 0 1 10 0"/>
            </svg>
          )}
        </div>
        <div className="personality-identity">
          <h3 className="personality-name">{agentName || personality.name}</h3>
          <p className="personality-role">{personality.role}</p>
          {agentWorkingOn && (
            <div className="personality-working-on">
              <span className="working-on-label">Working on:</span>
              <span className="working-on-text">{agentWorkingOn}</span>
            </div>
          )}
        </div>
      </div>

      {personality.communicationStyle && (
        <div className="personality-section">
          <h4 className="section-title">Communication Style</h4>
          <div className="communication-badge">
            {COMMUNICATION_STYLES_MAP[personality.communicationStyle] ||
              personality.communicationStyle}
          </div>
        </div>
      )}

      {personality.specialties && personality.specialties.length > 0 && (
        <div className="personality-section">
          <h4 className="section-title">Focus Areas</h4>
          <div className="focus-areas-grid">
            {personality.specialties.map((specialty) => {
              const focusArea = FOCUS_AREAS_MAP[specialty];
              return (
                <div key={specialty} className="focus-area-badge">
                  <span className="focus-label">
                    {focusArea?.label || specialty}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {personalityTraits.length > 0 && (
        <div className="personality-section">
          <h4 className="section-title">Personality Traits</h4>
          <div className="personality-traits-grid">
            {personalityTraits.map((trait) => (
              <div key={trait.id} className="personality-trait-badge">
                <span className="trait-label">{trait.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {personality.skills && personality.skills.length > 0 && (
        <div className="personality-section">
          <h4 className="section-title">Skills to Remember</h4>
          <div className="skills-list">
            {personality.skills.map((skill) => (
              <div key={skill} className="skill-badge">
                {skill}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
