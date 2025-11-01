import { useState } from 'react';
import type { AgentPersonality } from '../types';
import './PersonalityBuilder.css';

interface PersonalityBuilderProps {
  personality: Partial<AgentPersonality>;
  onPersonalityChange: (personality: Partial<AgentPersonality>) => void;
  availableSkills: string[];
}

const SPECIALTY_OPTIONS = [
  { id: 'frontend', label: 'Frontend Development', icon: '🎨' },
  { id: 'backend', label: 'Backend Development', icon: '⚙️' },
  { id: 'database', label: 'Database Design', icon: '🗄️' },
  { id: 'devops', label: 'DevOps & Infrastructure', icon: '🚀' },
  { id: 'testing', label: 'Testing & QA', icon: '🧪' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'mobile', label: 'Mobile Development', icon: '📱' },
  { id: 'ai-ml', label: 'AI & Machine Learning', icon: '🤖' },
];

const PERSONALITY_TRAITS = [
  { id: 'meticulous', label: 'Meticulous', icon: '🔍' },
  { id: 'creative', label: 'Creative', icon: '💡' },
  { id: 'pragmatic', label: 'Pragmatic', icon: '⚡' },
  { id: 'detail-oriented', label: 'Detail-oriented', icon: '🎯' },
  { id: 'innovative', label: 'Innovative', icon: '✨' },
  { id: 'analytical', label: 'Analytical', icon: '📊' },
  { id: 'collaborative', label: 'Collaborative', icon: '🤝' },
  { id: 'efficient', label: 'Efficient', icon: '⚡' },
];

const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
];

function PersonalityBuilder({
  personality,
  onPersonalityChange,
  availableSkills,
}: PersonalityBuilderProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleSpecialty = (specialtyId: string) => {
    const specialties = personality.specialties || [];
    const newSpecialties = specialties.includes(specialtyId)
      ? specialties.filter((s) => s !== specialtyId)
      : [...specialties, specialtyId];
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
          <span className="field-badge">Optional</span>
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
                placeholder="e.g., Senior Developer, Code Reviewer, UI Designer"
                className="personality-input"
              />
            </label>
          </div>

          <div className="personality-section">
            <span className="field-sublabel">Specialties</span>
            <div className="tag-grid">
              {SPECIALTY_OPTIONS.map((specialty) => (
                <button
                  key={specialty.id}
                  type="button"
                  className={`tag-button ${
                    (personality.specialties || []).includes(specialty.id)
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => toggleSpecialty(specialty.id)}
                >
                  <span className="tag-icon">{specialty.icon}</span>
                  <span className="tag-label">{specialty.label}</span>
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
              {personality.specialties && personality.specialties.length > 0 && (
                <p>
                  <strong>Specialties:</strong>{' '}
                  {personality.specialties
                    .map(
                      (s) =>
                        SPECIALTY_OPTIONS.find((opt) => opt.id === s)?.label ||
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
