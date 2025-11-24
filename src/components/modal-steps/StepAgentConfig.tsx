/**
 * Step 3: Agent Configuration
 * - Skills selector (from .claude/skills/)
 * - Protocol Droids selector (from .claude/agents/)
 * - Integration with Droid Factory for creating new skills/droids
 */

import type { StepAgentConfigProps } from './types';

export function StepAgentConfig({
  availableSkills,
  availableDroids,
  selectedSkills,
  selectedDroids,
  loadingSkills,
  loadingDroids,
  onSkillToggle,
  onDroidToggle,
  onOpenDroidFactory,
  onBack,
  onConfirm,
  creating,
}: StepAgentConfigProps) {
  const hasSkills = availableSkills.length > 0;
  const hasDroids = availableDroids.length > 0;

  return (
    <>
      {/* Skills Selector */}
      <div className="config-section">
        <div className="config-section-header">
          <svg className="config-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <div>
            <h3 className="config-section-title">Skills</h3>
            <p className="config-section-subtitle">
              Select specialized knowledge domains
            </p>
          </div>
        </div>

        {loadingSkills ? (
          <div className="config-loading">
            <span className="spinner"></span>
            Loading skills...
          </div>
        ) : hasSkills ? (
          <div className="config-items-list">
            {availableSkills.map((skill) => (
              <label key={skill.id} className="config-item">
                <input
                  type="checkbox"
                  checked={selectedSkills.includes(skill.id)}
                  onChange={() => onSkillToggle(skill.id)}
                />
                <span className="config-checkbox"></span>
                <div className="config-item-content">
                  <span className="config-item-name">
                    {skill.name}
                    {skill.isGlobal && <span className="global-badge">GLOBAL</span>}
                  </span>
                  <span className="config-item-description">{skill.description}</span>
                  <span className="config-item-path">{skill.path}</span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="config-empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="empty-text">No skills found</p>
            <p className="empty-hint">Create skills with Droid Factory to enhance your agents</p>
          </div>
        )}
      </div>

      {/* Protocol Droids Selector */}
      <div className="config-section">
        <div className="config-section-header">
          <svg className="config-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div>
            <h3 className="config-section-title">Protocol Droids</h3>
            <p className="config-section-subtitle">
              Select specialized sub-agents for delegation
            </p>
          </div>
        </div>

        {loadingDroids ? (
          <div className="config-loading">
            <span className="spinner"></span>
            Loading droids...
          </div>
        ) : hasDroids ? (
          <div className="config-items-list">
            {availableDroids.map((droid) => (
              <label key={droid.id} className="config-item">
                <input
                  type="checkbox"
                  checked={selectedDroids.includes(droid.id)}
                  onChange={() => onDroidToggle(droid.id)}
                />
                <span className="config-checkbox"></span>
                <div className="config-item-content">
                  <span className="config-item-name">
                    {droid.name}
                    {droid.isGlobal && <span className="global-badge">GLOBAL</span>}
                  </span>
                  <span className="config-item-specialization">{droid.specialization}</span>
                  <span className="config-item-description">{droid.description}</span>
                  <span className="config-item-path">{droid.path}</span>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="config-empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p className="empty-text">No protocol droids found</p>
            <p className="empty-hint">Create droids with Droid Factory to delegate tasks</p>
          </div>
        )}
      </div>

      {/* Droid Factory Button */}
      {(!hasSkills || !hasDroids) && (
        <div className="droid-factory-cta">
          <button
            type="button"
            className="droid-factory-button"
            onClick={onOpenDroidFactory}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            Open Droid Factory
          </button>
          <p className="droid-factory-hint">
            Create new skills and protocol droids to enhance agent capabilities
          </p>
        </div>
      )}

      {/* Selection Summary */}
      {(selectedSkills.length > 0 || selectedDroids.length > 0) && (
        <div className="selection-summary">
          <h4 className="summary-title">Configuration Summary</h4>
          {selectedSkills.length > 0 && (
            <div className="summary-section">
              <span className="summary-label">Skills ({selectedSkills.length}):</span>
              <ul className="summary-list">
                {selectedSkills.map(id => {
                  const skill = availableSkills.find(s => s.id === id);
                  return skill ? <li key={id}>{skill.name}</li> : null;
                })}
              </ul>
            </div>
          )}
          {selectedDroids.length > 0 && (
            <div className="summary-section">
              <span className="summary-label">Protocol Droids ({selectedDroids.length}):</span>
              <ul className="summary-list">
                {selectedDroids.map(id => {
                  const droid = availableDroids.find(d => d.id === id);
                  return droid ? <li key={id}>{droid.name}</li> : null;
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={onConfirm}
          disabled={creating}
        >
          {creating ? (
            <>
              <span className="spinner"></span>
              Creating agent...
            </>
          ) : (
            'Create Agent'
          )}
        </button>
      </div>
    </>
  );
}
