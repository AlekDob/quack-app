import { useState } from 'react';
import type { AgentPersonality } from '../types';
import './PersonalityBuilder.css';

interface PersonalityBuilderProps {
  personality: Partial<AgentPersonality>;
  onPersonalityChange: (personality: Partial<AgentPersonality>) => void;
  availableSkills: string[];
}

const COMMUNICATION_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal and precise' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and informal' },
  { id: 'technical', label: 'Technical', description: 'Highly detailed and technical' },
  { id: 'sarcastic', label: 'Sarcastic', description: 'Witty and ironic' },
];

// Suggested rules for AI coding - generic best practices
const SUGGESTED_RULES = [
  'Always verify assumptions before implementing',
  'Break complex tasks into smaller, testable steps',
  'Write clear, self-documenting code with meaningful names',
  'Consider edge cases and error handling',
  'Keep functions small and focused on single responsibility',
  'Prefer readability over cleverness',
  'Document non-obvious decisions and trade-offs',
  'Test critical paths and edge cases',
  'Avoid premature optimization',
  'Follow the existing codebase patterns and style',
  'Ask clarifying questions when requirements are unclear',
  'Refactor incrementally, not all at once',
];

function PersonalityBuilder({
  personality,
  onPersonalityChange,
}: PersonalityBuilderProps) {
  const [expanded, setExpanded] = useState(true);
  const [newRule, setNewRule] = useState('');

  const handleAddRule = () => {
    if (!newRule.trim()) return;

    const rules = personality.rules || [];
    onPersonalityChange({
      ...personality,
      rules: [...rules, newRule.trim()],
    });
    setNewRule('');
  };

  const handleRemoveRule = (index: number) => {
    const rules = personality.rules || [];
    onPersonalityChange({
      ...personality,
      rules: rules.filter((_, i) => i !== index),
    });
  };

  const handleAddSuggestedRule = (suggestedRule: string) => {
    const rules = personality.rules || [];
    // Don't add if already exists
    if (rules.includes(suggestedRule)) {
      console.log('Rule already exists:', suggestedRule);
      return;
    }

    console.log('Adding suggested rule:', suggestedRule);
    console.log('Current rules:', rules);

    const newRules = [...rules, suggestedRule];
    console.log('New rules:', newRules);

    onPersonalityChange({
      ...personality,
      rules: newRules,
    });
  };

  const handleRoleChange = (role: string) => {
    onPersonalityChange({ ...personality, role });
  };

  const handleTechnicalContextChange = (technicalContext: string) => {
    onPersonalityChange({ ...personality, technicalContext });
  };

  const handleCommunicationStyleChange = (style: string) => {
    onPersonalityChange({ ...personality, communicationStyle: style });
  };

  const handleCustomNotesChange = (customNotes: string) => {
    onPersonalityChange({ ...personality, customNotes });
  };

  return (
    <div className="personality-builder">
      <div className="personality-header">
        <span className="field-label">
          Agent Configuration
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
          {/* Role/Mission */}
          <div className="personality-section">
            <label className="personality-field">
              <span className="field-sublabel">Role / Mission</span>
              <input
                type="text"
                value={personality.role || ''}
                onChange={(e) => handleRoleChange(e.target.value)}
                placeholder="e.g., Backend Performance Specialist, UI/UX Coordinator"
                className="personality-input"
              />
            </label>
            <p className="field-hint">
              Generic role that works across different tech stacks
            </p>
          </div>

          {/* Technical Context */}
          <div className="personality-section">
            <label className="personality-field">
              <span className="field-sublabel">Technical Context</span>
              <textarea
                value={personality.technicalContext || ''}
                onChange={(e) => handleTechnicalContextChange(e.target.value)}
                placeholder="e.g., 'Tauri v2 + React 19. PTY managed in Rust. Use fireAndForget for non-blocking I/O operations.'"
                className="personality-textarea"
                rows={4}
                maxLength={500}
              />
            </label>
            <p className="field-hint">
              Free-form notes about the current project's tech stack and patterns (max 500 chars)
            </p>
          </div>

          {/* Rules & Best Practices */}
          <div className="personality-section">
            <span className="field-sublabel">Rules & Best Practices</span>
            <p className="field-hint-small">Specific constraints and guidelines for this agent</p>

            {/* Current Rules */}
            {(personality.rules && personality.rules.length > 0) ? (
              <div className="rules-list">
                {personality.rules.map((rule, index) => (
                  <div key={index} className="rule-item">
                    <span className="rule-bullet">•</span>
                    <span className="rule-text">{rule}</span>
                    <button
                      type="button"
                      className="rule-remove-button"
                      onClick={() => handleRemoveRule(index)}
                      aria-label="Remove rule"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rules-empty">
                <span className="rules-empty-icon">📋</span>
                <span className="rules-empty-text">No rules yet. Add custom rules or select from suggestions below.</span>
              </div>
            )}

            {/* Add Custom Rule */}
            <div className="rule-add-form">
              <input
                type="text"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRule();
                  }
                }}
                placeholder="Add a custom rule..."
                className="rule-input"
              />
              <button
                type="button"
                className="rule-add-button"
                onClick={handleAddRule}
                disabled={!newRule.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add
              </button>
            </div>

            {/* Suggested Rules */}
            <div className="suggested-rules">
              <span className="suggested-rules-label">💡 Quick suggestions:</span>
              <div className="suggested-rules-grid">
                {SUGGESTED_RULES.filter(rule => !(personality.rules || []).includes(rule)).map((suggestedRule, index) => (
                  <button
                    key={index}
                    type="button"
                    className="suggested-rule-button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Button clicked:', suggestedRule);
                      handleAddSuggestedRule(suggestedRule);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    {suggestedRule}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Communication Style */}
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

          {/* Custom Notes */}
          <div className="personality-section">
            <label className="personality-field">
              <span className="field-sublabel">Custom Notes</span>
              <textarea
                value={personality.customNotes || ''}
                onChange={(e) => handleCustomNotesChange(e.target.value)}
                placeholder="Additional context, working memory, or custom instructions..."
                className="personality-textarea"
                rows={3}
                maxLength={500}
              />
            </label>
            <p className="field-hint">
              Free-form field for any additional information (max 500 chars)
            </p>
          </div>

          {/* Preview */}
          <div className="personality-preview">
            <span className="preview-label">Preview</span>
            <div className="preview-content">
              {personality.role && (
                <p>
                  <strong>Role:</strong> {personality.role}
                </p>
              )}
              {personality.technicalContext && (
                <p>
                  <strong>Technical Context:</strong> {personality.technicalContext}
                </p>
              )}
              {personality.rules && personality.rules.length > 0 && (
                <p>
                  <strong>Rules:</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                    {personality.rules.map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
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
              {personality.customNotes && (
                <p>
                  <strong>Custom Notes:</strong> {personality.customNotes}
                </p>
              )}
              {!personality.role &&
                !personality.technicalContext &&
                !personality.rules?.length &&
                !personality.communicationStyle &&
                !personality.customNotes && (
                  <p className="preview-empty">
                    No configuration yet. Fill in the fields above.
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
