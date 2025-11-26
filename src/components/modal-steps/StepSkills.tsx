/**
 * Step 3: Skills Selection
 * - Select skills from available skill files
 * - Show empty state if no skills found
 * - Integration with Droid Factory
 */

import { useState, useMemo } from 'react';
import type { SkillMetadata } from './types';

interface StepSkillsProps {
  availableSkills: SkillMetadata[];
  selectedSkills: string[];
  loadingSkills: boolean;
  missingSkills?: string[]; // Skills saved but not available in current project
  onSkillToggle: (skillId: string) => void;
  onOpenDroidFactory: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepSkills({
  availableSkills,
  selectedSkills,
  loadingSkills,
  missingSkills = [],
  onSkillToggle,
  onOpenDroidFactory,
  onBack,
  onNext,
}: StepSkillsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const hasSkills = availableSkills.length > 0;

  console.log('[StepSkills] availableSkills:', availableSkills);
  console.log('[StepSkills] loadingSkills:', loadingSkills);

  // Filter skills based on search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return availableSkills;

    const query = searchQuery.toLowerCase();
    return availableSkills.filter(skill =>
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    );
  }, [availableSkills, searchQuery]);

  return (
    <>
      {/* Intro Message */}
      <div className="step-intro-message">
        <svg className="intro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <p className="intro-text">
          <strong>Pre-select skills to guide your agent.</strong> This helps automate common tasks, but you can always invoke any skill directly in chat using <code>/skill-name</code>.
        </p>
      </div>

      {/* Missing Skills Warning */}
      {missingSkills.length > 0 && (
        <div className="missing-items-warning">
          <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div className="warning-content">
            <strong>{missingSkills.length} skill(s) not available in this project:</strong>
            <ul className="missing-items-list">
              {missingSkills.map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
              Select specialized knowledge domains for your agent
            </p>
          </div>
        </div>

        {/* Search Bar */}
        {hasSkills && (
          <div className="config-search">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        )}

        {loadingSkills ? (
          <div className="config-loading">
            <span className="spinner"></span>
            Loading skills...
          </div>
        ) : hasSkills ? (
          <>
            {filteredSkills.length === 0 ? (
              <div className="config-empty-state">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p className="empty-text">No skills match "{searchQuery}"</p>
                <p className="empty-hint">Try a different search term</p>
              </div>
            ) : (
              <div className="config-items-list">
                {filteredSkills.map((skill) => (
                  <label key={skill.id} className="config-item">
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(skill.id)}
                      onChange={() => onSkillToggle(skill.id)}
                    />
                    <span className="config-checkbox"></span>
                    <img
                      src="/images/skills.jpeg"
                      alt="Skill avatar"
                      className="config-item-avatar"
                    />
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
            )}
          </>
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

      {/* Droid Factory CTA (only when no skills) */}
      {!hasSkills && (
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
            Create new skills to add specialized knowledge to your agents
          </p>
        </div>
      )}

      {/* Selection Summary */}
      {selectedSkills.length > 0 && (
        <div className="selection-summary">
          <h4 className="summary-title">Selected Skills ({selectedSkills.length})</h4>
          <ul className="summary-list">
            {selectedSkills.map(id => {
              const skill = availableSkills.find(s => s.id === id);
              return skill ? <li key={id}>{skill.name}</li> : null;
            })}
          </ul>
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
          onClick={onNext}
        >
          Continue →
        </button>
      </div>
    </>
  );
}
