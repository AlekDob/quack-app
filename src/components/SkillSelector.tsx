/**
 * Skill Selector Component
 *
 * Allows users to select skills for agent personality.
 * Shows chips/tags for available skills from project, global, and marketplace.
 * Groups skills by installed/not-installed status.
 */

import { useState, useEffect } from 'react';
import { loadAvailableSkills } from '../utils/skillsAndDroidsLoader';
import type { SkillMetadata } from './modal-steps/types';
import './SkillSelector.css';

interface SkillSelectorProps {
  projectPath: string;
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
}

// Star icon for skills - same as AddonsDrawer
function SkillStarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="skill-star-icon">
      <path
        d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Simple fuzzy search - matches if all chars appear in order
function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let textIndex = 0;
  for (const char of lowerQuery) {
    const found = lowerText.indexOf(char, textIndex);
    if (found === -1) return false;
    textIndex = found + 1;
  }
  return true;
}

export default function SkillSelector({
  projectPath,
  selectedSkills,
  onSkillsChange,
}: SkillSelectorProps) {
  const [availableSkills, setAvailableSkills] = useState<SkillMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load available skills when project path changes
  useEffect(() => {
    async function loadSkills() {
      if (!projectPath) {
        setAvailableSkills([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const skills = await loadAvailableSkills(projectPath);
        setAvailableSkills(skills);
      } catch (err) {
        console.error('[SkillSelector] Failed to load skills:', err);
        setAvailableSkills([]);
      } finally {
        setLoading(false);
      }
    }

    loadSkills();
  }, [projectPath]);

  const toggleSkill = (skillName: string) => {
    if (selectedSkills.includes(skillName)) {
      onSkillsChange(selectedSkills.filter(s => s !== skillName));
    } else {
      onSkillsChange([...selectedSkills, skillName]);
    }
  };

  // Filter skills by search query
  const filteredSkills = searchQuery.trim()
    ? availableSkills.filter(s => fuzzyMatch(s.name, searchQuery) || fuzzyMatch(s.description, searchQuery))
    : availableSkills;

  // Group skills: installed (project + global) vs not installed (marketplace)
  const installedSkills = filteredSkills.filter(s => !s.isMarketplace);
  const notInstalledSkills = filteredSkills.filter(s => s.isMarketplace);

  // Calculate how many to show when collapsed
  const maxCollapsedInstalled = 12;
  const maxCollapsedNotInstalled = 6;

  if (loading) {
    return (
      <div className="skill-selector">
        <div className="skill-selector-loading">
          <svg className="skill-selector-spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="3" />
          </svg>
          <span>Loading skills...</span>
        </div>
      </div>
    );
  }

  if (availableSkills.length === 0) {
    return (
      <div className="skill-selector">
        <div className="skill-selector-empty">
          No skills available. Add skills to .claude/commands/ or ~/.claude/commands/
        </div>
      </div>
    );
  }

  return (
    <div className="skill-selector">
      {/* Compact search input */}
      <div className="skill-search">
        <svg className="skill-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="skill-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="skill-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      <div className="skill-chips-container">
        {/* Installed Skills (Project + Global) */}
        {installedSkills.length > 0 && (
          <div className="skill-group">
            <div className="skill-group-header">
              <div className="skill-group-icon installed">
                <SkillStarIcon />
              </div>
              <span className="skill-group-label">Installed</span>
              <span className="skill-group-count">{installedSkills.length}</span>
            </div>
            <div className="skill-chips">
              {(expanded ? installedSkills : installedSkills.slice(0, maxCollapsedInstalled)).map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill-chip ${selectedSkills.includes(skill.name) ? 'selected' : ''}`}
                  onClick={() => toggleSkill(skill.name)}
                  title={skill.description}
                >
                  <span className="skill-chip-name">{skill.name}</span>
                  {selectedSkills.includes(skill.name) && (
                    <svg className="skill-chip-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Not Installed Skills (Marketplace) */}
        {notInstalledSkills.length > 0 && (
          <div className="skill-group">
            <div className="skill-group-header">
              <div className="skill-group-icon not-installed">
                <SkillStarIcon />
              </div>
              <span className="skill-group-label">Marketplace</span>
              <span className="skill-group-count">{notInstalledSkills.length}</span>
            </div>
            <div className="skill-chips">
              {(expanded ? notInstalledSkills : notInstalledSkills.slice(0, maxCollapsedNotInstalled)).map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={`skill-chip marketplace ${selectedSkills.includes(skill.name) ? 'selected' : ''}`}
                  onClick={() => toggleSkill(skill.name)}
                  title={`${skill.description} (will be installed)`}
                >
                  <span className="skill-chip-name">{skill.name}</span>
                  {selectedSkills.includes(skill.name) && (
                    <svg className="skill-chip-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Show more/less toggle */}
      {(installedSkills.length > maxCollapsedInstalled || notInstalledSkills.length > maxCollapsedNotInstalled) && (
        <button
          type="button"
          className="skill-selector-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : `Show all (${availableSkills.length})`}
        </button>
      )}

      {/* Selected count */}
      {selectedSkills.length > 0 && (
        <div className="skill-selector-selected-count">
          {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
