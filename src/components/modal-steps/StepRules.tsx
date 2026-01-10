/**
 * Step 3: Rules Selection
 * - Select rules to guide agent behavior
 * - Shows project and global rules
 * - Inline rule creation via overlay modal
 * - Simplified UX replacing skills/droids/triggers
 */

import { useState, useMemo } from 'react';
import type { Rule, RuleScope } from '../../types';
import type { StepRulesProps } from './types';
import { CreateRuleModal } from './CreateRuleModal';
import { getDisplayPath, areRulePathsEqual } from '../../utils/rulePathUtils';

export function StepRules({
  availableRules,
  selectedRules,
  loadingRules,
  missingRules = [],
  onRuleToggle,
  onCreateRule,
  onBack,
  onConfirm,
  creating,
  isEditing = false,
}: StepRulesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    project: true,
    global: true,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);

  const hasRules = availableRules.project.length > 0 || availableRules.global.length > 0;

  // Filter rules based on search query
  const filterRules = (ruleList: Rule[]) => {
    if (!searchQuery.trim()) return ruleList;
    const query = searchQuery.toLowerCase();
    return ruleList.filter(rule =>
      rule.name.toLowerCase().includes(query) ||
      rule.frontmatter?.description?.toLowerCase().includes(query)
    );
  };

  const filteredProject = useMemo(() => filterRules(availableRules.project), [availableRules.project, searchQuery]);
  const filteredGlobal = useMemo(() => filterRules(availableRules.global), [availableRules.global, searchQuery]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreateRule = async (
    name: string,
    content: string,
    scope: RuleScope,
    description?: string,
    globs?: string[],
    alwaysApply?: boolean
  ) => {
    if (!onCreateRule) return;

    setCreatingRule(true);
    try {
      await onCreateRule(name, content, scope, description, globs, alwaysApply);
      setShowCreateModal(false);
    } finally {
      setCreatingRule(false);
    }
  };

  const renderRuleItem = (rule: Rule, scope: 'project' | 'global') => {
    // Use areRulePathsEqual to handle both normalized and absolute paths
    const isSelected = selectedRules.some(path => areRulePathsEqual(path, rule.filePath));

    return (
      <label key={rule.filePath} className="config-item">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onRuleToggle(rule.filePath)}
        />
        <span className="config-checkbox"></span>
        <div className="config-item-content">
          <span className="config-item-name">
            {rule.name}
            {rule.frontmatter?.alwaysApply && (
              <span className="always-apply-badge">ALWAYS</span>
            )}
          </span>
          {rule.frontmatter?.description && (
            <span className="config-item-description">{rule.frontmatter.description}</span>
          )}
          {rule.frontmatter?.globs && rule.frontmatter.globs.length > 0 && (
            <span className="config-item-globs">
              Applies to: {rule.frontmatter.globs.join(', ')}
            </span>
          )}
          <span className="config-item-path">{getDisplayPath(rule.filePath)}</span>
        </div>
      </label>
    );
  };

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
          <strong>Select rules to guide your agent.</strong> Rules define behavior patterns, coding standards, and project conventions that Claude will follow. The agent will recap active rules in each response.
        </p>
      </div>

      {/* Missing Rules Warning */}
      {missingRules.length > 0 && (
        <div className="missing-items-warning">
          <svg className="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div className="warning-content">
            <strong>{missingRules.length} rule(s) not available:</strong>
            <ul className="missing-items-list">
              {missingRules.map((path, index) => (
                <li key={index}>{path}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Rules Selector */}
      <div className="config-section">
        <div className="config-section-header">
          <svg className="config-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <div>
            <h3 className="config-section-title">Rules</h3>
            <p className="config-section-subtitle">
              Select behavior rules and conventions for your agent
            </p>
          </div>
        </div>

        {/* Search Bar */}
        {hasRules && (
          <div className="config-search">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules..."
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

        {loadingRules ? (
          <div className="config-loading">
            <span className="spinner"></span>
            Loading rules...
          </div>
        ) : hasRules ? (
          <>
            {filteredProject.length === 0 && filteredGlobal.length === 0 ? (
              <div className="config-empty-state">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p className="empty-text">No rules match "{searchQuery}"</p>
                <p className="empty-hint">Try a different search term</p>
              </div>
            ) : (
              <div className="rules-sections">
                {/* Project Rules */}
                {filteredProject.length > 0 && (
                  <div className="rules-section">
                    <button
                      type="button"
                      className="rules-section-header"
                      onClick={() => toggleSection('project')}
                    >
                      <svg
                        className={`section-chevron ${expandedSections.project ? 'expanded' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span className="section-title">Project Rules</span>
                      <span className="section-count">{filteredProject.length}</span>
                    </button>
                    {expandedSections.project && (
                      <div className="config-items-list">
                        {filteredProject.map(rule => renderRuleItem(rule, 'project'))}
                      </div>
                    )}
                  </div>
                )}

                {/* Global Rules */}
                {filteredGlobal.length > 0 && (
                  <div className="rules-section">
                    <button
                      type="button"
                      className="rules-section-header"
                      onClick={() => toggleSection('global')}
                    >
                      <svg
                        className={`section-chevron ${expandedSections.global ? 'expanded' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span className="section-title">Global Rules</span>
                      <span className="section-count">{filteredGlobal.length}</span>
                    </button>
                    {expandedSections.global && (
                      <div className="config-items-list">
                        {filteredGlobal.map(rule => renderRuleItem(rule, 'global'))}
                      </div>
                    )}
                  </div>
                )}
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
            <p className="empty-text">No rules found</p>
            <p className="empty-hint">
              Create rules in .claude/rules/ to define agent behavior and conventions.
              Rules can be project-specific or global across all projects.
            </p>
          </div>
        )}

        {/* Create Rule CTA */}
        {onCreateRule && (
          <button
            type="button"
            className="create-rule-cta"
            onClick={() => setShowCreateModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create New Rule</span>
          </button>
        )}
      </div>

      {/* Selection Summary */}
      {selectedRules.length > 0 && (
        <div className="selection-summary">
          <h4 className="summary-title">Selected Rules ({selectedRules.length})</h4>
          <ul className="summary-list">
            {selectedRules.map(path => {
              const rule = [...availableRules.project, ...availableRules.global].find(r => r.filePath === path);
              return rule ? <li key={path}>{rule.name}</li> : <li key={path} className="missing">{path}</li>;
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={onConfirm}
          disabled={creating}
        >
          Continue
        </button>
      </div>

      {/* Create Rule Modal (overlay) */}
      <CreateRuleModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateRule}
        creating={creatingRule}
      />
    </>
  );
}
