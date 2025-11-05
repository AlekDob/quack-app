import { useState } from 'react';
import type { AgentPersonality } from '../types';
import './PersonalityBuilder.css';

interface PersonalityBuilderProps {
  personality: Partial<AgentPersonality>;
  onPersonalityChange: (personality: Partial<AgentPersonality>) => void;
  availableSkills: string[];
}

const FOCUS_AREAS = [
  { id: 'feature-planning', label: 'Feature Planning', icon: '🗺️' },
  { id: 'sprint-management', label: 'Sprint Management', icon: '🏃' },
  { id: 'branch-coordination', label: 'Branch Coordination', icon: '🌿' },
  { id: 'team-alignment', label: 'Team Alignment', icon: '🤝' },
  { id: 'technical-oversight', label: 'Technical Oversight', icon: '👁️' },
  { id: 'quality-assurance', label: 'Quality Assurance', icon: '✅' },
  { id: 'delivery-tracking', label: 'Delivery Tracking', icon: '📦' },
  { id: 'stakeholder-comms', label: 'Stakeholder Communication', icon: '💬' },
];

const PERSONALITY_TRAITS = [
  { id: 'organized', label: 'Organized', icon: '📋' },
  { id: 'proactive', label: 'Proactive', icon: '⚡' },
  { id: 'pragmatic', label: 'Pragmatic', icon: '🎯' },
  { id: 'strategic', label: 'Strategic', icon: '♟️' },
  { id: 'collaborative', label: 'Collaborative', icon: '🤝' },
  { id: 'detail-oriented', label: 'Detail-oriented', icon: '🔍' },
  { id: 'communicative', label: 'Communicative', icon: '💬' },
  { id: 'results-driven', label: 'Results-driven', icon: '🎯' },
  { id: 'mad-genius', label: 'Mad Genius', icon: '🧪' },
];

const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Witty and ironic' },
];

function PersonalityBuilder({
  personality,
  onPersonalityChange,
  availableSkills,
}: PersonalityBuilderProps) {
  const [expanded, setExpanded] = useState(true);

  const toggleFocusArea = (focusId: string) => {
    const specialties = personality.specialties || [];
    const newSpecialties = specialties.includes(focusId)
      ? specialties.filter((s) => s !== focusId)
      : [...specialties, focusId];
    onPersonalityChange({ ...personality, specialties: newSpecialties });
  };

  const toggleSkill = (skill: string) => {
    const skills = personality.skills || [];
    const newSkills = skills.includes(skill)
      ? skills.filter((s) => s !== skill)
      : [...skills, skill];
    onPersonalityChange({ ...personality, skills: newSkills });
  };

  const handleRoleChange = (role: string) => {
    onPersonalityChange({ ...personality, role });
  };

  const handleCommunicationStyleChange = (style: string) => {
    onPersonalityChange({ ...personality, communicationStyle: style });
  };

  return (
    <div className="personality-builder">
      <div className="personality-header">
        <span className="field-label">
          Agent Personality
        </span>
        <button
          type="button"
          className="expand-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : 'Customize'}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="personality-content">
          <div className="personality-section">
            <label className="personality-field">
              <span className="field-sublabel">Role</span>
              <input
                type="text"
                value={personality.role || ''}
                onChange={(e) => handleRoleChange(e.target.value)}
                placeholder="e.g., Feature Coordinator, Sprint Manager, Release Lead"
                className="personality-input"
              />
            </label>
            <p className="field-hint">
              Duck Agents are PMs/coordinators who manage features and invoke Protocol Droids for technical work
            </p>
          </div>

          <div className="personality-section">
            <label className="personality-field">
              <span className="field-sublabel">
                Intro
              </span>
              <textarea
                value={personality.intro || ''}
                onChange={(e) =>
                  onPersonalityChange({ ...personality, intro: e.target.value })
                }
                placeholder="e.g., 'Experienced PM specializing in feature delivery and team coordination...'"
                className="personality-textarea"
                rows={3}
                maxLength={300}
              />
            </label>
            <p className="field-hint">
              Additional context or characteristics about this agent (optional)
            </p>
          </div>

          <div className="personality-section">
            <span className="field-sublabel">Focus Areas</span>
            <p className="field-hint-small">What this agent coordinates (not technical specialties)</p>
            <div className="tag-grid">
              {FOCUS_AREAS.map((focus) => (
                <button
                  key={focus.id}
                  type="button"
                  className={`tag-button ${
                    (personality.specialties || []).includes(focus.id)
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => toggleFocusArea(focus.id)}
                >
                  <span className="tag-icon">{focus.icon}</span>
                  <span className="tag-label">{focus.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="personality-section">
            <span className="field-sublabel">Personality Traits</span>
            <div className="tag-grid">
              {PERSONALITY_TRAITS.map((trait) => {
                const personalityText = personality.personality || '';
                const isSelected = personalityText
                  .toLowerCase()
                  .includes(trait.id.toLowerCase());

                return (
                  <button
                    key={trait.id}
                    type="button"
                    className={`tag-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      const current = personality.personality || '';
                      const newPersonality = isSelected
                        ? current
                            .replace(trait.label, '')
                            .replace(/\s+/g, ' ')
                            .trim()
                        : current
                        ? `${current}. ${trait.label}`
                        : trait.label;
                      onPersonalityChange({
                        ...personality,
                        personality: newPersonality,
                      });
                    }}
                  >
                    <span className="tag-icon">{trait.icon}</span>
                    <span className="tag-label">{trait.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="personality-section">
            <span className="field-sublabel">Communication Style</span>
            <div className="communication-grid">
              {COMMUNICATION_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className={`communication-card ${
                    personality.communicationStyle === style.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => handleCommunicationStyleChange(style.id)}
                >
                  <span className="communication-label">{style.label}</span>
                  <span className="communication-description">
                    {style.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {availableSkills.length > 0 && (
            <div className="personality-section">
              <span className="field-sublabel">
                Skills to Remember
                <span className="field-hint-inline">
                  Select relevant skills for this agent
                </span>
              </span>
              <div className="skills-list">
                {availableSkills.map((skill) => (
                  <label key={skill} className="skill-checkbox">
                    <input
                      type="checkbox"
                      checked={(personality.skills || []).includes(skill)}
                      onChange={() => toggleSkill(skill)}
                    />
                    <span className="skill-name">{skill}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="personality-preview">
            <span className="preview-label">Preview</span>
            <div className="preview-content">
              {personality.role && (
                <p>
                  <strong>Role:</strong> {personality.role}
                </p>
              )}
              {personality.intro && (
                <p>
                  <strong>Intro:</strong> {personality.intro}
                </p>
              )}
              {personality.specialties && personality.specialties.length > 0 && (
                <p>
                  <strong>Focus Areas:</strong>{' '}
                  {personality.specialties
                    .map(
                      (s) =>
                        FOCUS_AREAS.find((opt) => opt.id === s)?.label ||
                        s
                    )
                    .join(', ')}
                </p>
              )}
              {personality.personality && (
                <p>
                  <strong>Personality:</strong> {personality.personality}
                </p>
              )}
              {personality.communicationStyle && (
                <p>
                  <strong>Style:</strong>{' '}
                  {COMMUNICATION_STYLES.find(
                    (s) => s.id === personality.communicationStyle
                  )?.label || personality.communicationStyle}
                </p>
              )}
              {personality.skills && personality.skills.length > 0 && (
                <p>
                  <strong>Skills:</strong> {personality.skills.join(', ')}
                </p>
              )}
              {!personality.role &&
                !personality.specialties?.length &&
                !personality.personality &&
                !personality.communicationStyle &&
                !personality.skills?.length && (
                  <p className="preview-empty">
                    No personality configured. Using default settings.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalityBuilder;
