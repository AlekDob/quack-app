/**
 * Step 5: Triggers Configuration
 * - Configure WHEN to use each selected skill/droid
 * - User defines triggers with suggestions
 * - Toggle auto-invoke for proactive behavior
 */

import { useState, useMemo } from 'react';
import type { TriggerConfig, SkillMetadata, DroidMetadata, TRIGGER_SUGGESTIONS } from './types';

interface StepTriggersProps {
  selectedSkills: string[];
  selectedDroids: string[];
  availableSkills: SkillMetadata[];
  availableDroids: DroidMetadata[];
  triggerConfigs: TriggerConfig[];
  onTriggerChange: (configs: TriggerConfig[]) => void;
  onBack: () => void;
  onConfirm: () => void;
  creating: boolean;
  isEditing?: boolean;
}

// Helper to detect trigger category from name/description
function detectCategory(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes('ui') || text.includes('design') || text.includes('style') || text.includes('ux')) {
    return 'ui';
  }
  if (text.includes('test') || text.includes('spec') || text.includes('coverage')) {
    return 'test';
  }
  if (text.includes('doc') || text.includes('readme') || text.includes('comment')) {
    return 'docs';
  }
  if (text.includes('api') || text.includes('backend') || text.includes('endpoint') || text.includes('database')) {
    return 'api';
  }
  if (text.includes('code') || text.includes('review') || text.includes('refactor') || text.includes('debug')) {
    return 'code';
  }
  return 'default';
}

// Trigger suggestions based on category
const SUGGESTIONS: Record<string, string[]> = {
  'default': [
    'When the user asks about...',
    'Before making decisions about...',
    'When working on files related to...',
    'After completing...',
  ],
  'ui': [
    'When creating or modifying UI components',
    'Before making design decisions',
    'When discussing user experience',
    'When implementing accessibility features',
  ],
  'code': [
    'When reviewing or analyzing code',
    'Before refactoring',
    'When debugging issues',
    'When implementing new features',
  ],
  'docs': [
    'When writing documentation',
    'When explaining code or concepts',
    'Before publishing changes',
  ],
  'test': [
    'When writing or updating tests',
    'Before merging code',
    'When investigating failures',
  ],
  'api': [
    'When working with API endpoints',
    'When designing data structures',
    'When handling authentication',
  ],
};

export function StepTriggers({
  selectedSkills,
  selectedDroids,
  availableSkills,
  availableDroids,
  triggerConfigs,
  onTriggerChange,
  onBack,
  onConfirm,
  creating,
  isEditing = false,
}: StepTriggersProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Build list of items to configure
  const itemsToConfig = useMemo(() => {
    const items: { id: string; type: 'skill' | 'droid'; name: string; description: string; category: string }[] = [];

    selectedSkills.forEach(skillId => {
      const skill = availableSkills.find(s => s.id === skillId);
      if (skill) {
        items.push({
          id: skillId,
          type: 'skill',
          name: skill.name,
          description: skill.description,
          category: detectCategory(skill.name, skill.description),
        });
      }
    });

    selectedDroids.forEach(droidId => {
      const droid = availableDroids.find(d => d.id === droidId);
      if (droid) {
        items.push({
          id: droidId,
          type: 'droid',
          name: droid.name,
          description: droid.description,
          category: detectCategory(droid.name, droid.description),
        });
      }
    });

    return items;
  }, [selectedSkills, selectedDroids, availableSkills, availableDroids]);

  // Get or create trigger config for an item
  const getConfig = (id: string, type: 'skill' | 'droid', name: string): TriggerConfig => {
    const existing = triggerConfigs.find(c => c.id === id && c.type === type);
    if (existing) return existing;
    return { id, type, name, trigger: '', autoInvoke: true };
  };

  // Update a single trigger config
  const updateConfig = (id: string, type: 'skill' | 'droid', name: string, updates: Partial<TriggerConfig>) => {
    const existing = triggerConfigs.find(c => c.id === id && c.type === type);

    if (existing) {
      onTriggerChange(
        triggerConfigs.map(c =>
          c.id === id && c.type === type ? { ...c, ...updates } : c
        )
      );
    } else {
      onTriggerChange([
        ...triggerConfigs,
        { id, type, name, trigger: '', autoInvoke: true, ...updates }
      ]);
    }
  };

  // Apply suggestion to trigger
  const applySuggestion = (id: string, type: 'skill' | 'droid', name: string, suggestion: string) => {
    const config = getConfig(id, type, name);
    const newTrigger = config.trigger
      ? `${config.trigger}, ${suggestion.toLowerCase()}`
      : suggestion;
    updateConfig(id, type, name, { trigger: newTrigger });
  };

  // Count configured triggers
  const configuredCount = triggerConfigs.filter(c => c.trigger.trim()).length;
  const totalCount = itemsToConfig.length;

  if (itemsToConfig.length === 0) {
    return (
      <>
        <div className="step-intro-message">
          <svg className="intro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
          <p className="intro-text">
            <strong>No skills or droids selected.</strong> Go back to select at least one skill or droid to configure triggers.
          </p>
        </div>

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
            {creating ? (
              <>
                <span className="spinner"></span>
                {isEditing ? 'Saving agent...' : 'Creating agent...'}
              </>
            ) : (
              isEditing ? 'Save Agent (No Triggers)' : 'Create Agent (No Triggers)'
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Intro Message */}
      <div className="step-intro-message">
        <svg className="intro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
        </svg>
        <p className="intro-text">
          <strong>Define WHEN to use each skill/droid.</strong> This teaches your agent to invoke them proactively without waiting for your request. Use suggestions or write custom triggers.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="triggers-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${totalCount > 0 ? (configuredCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <span className="progress-text">{configuredCount} / {totalCount} configured</span>
      </div>

      {/* Triggers List */}
      <div className="triggers-list">
        {itemsToConfig.map(item => {
          const config = getConfig(item.id, item.type, item.name);
          const isExpanded = expandedItem === `${item.type}-${item.id}`;
          const suggestions = SUGGESTIONS[item.category] || SUGGESTIONS['default'];
          const hasTrigger = config.trigger.trim().length > 0;

          return (
            <div
              key={`${item.type}-${item.id}`}
              className={`trigger-item ${isExpanded ? 'expanded' : ''} ${hasTrigger ? 'configured' : ''}`}
            >
              {/* Header */}
              <div
                className="trigger-header"
                onClick={() => setExpandedItem(isExpanded ? null : `${item.type}-${item.id}`)}
              >
                <div className="trigger-info">
                  <span className={`trigger-type-badge ${item.type}`}>
                    {item.type === 'skill' ? 'SKILL' : 'DROID'}
                  </span>
                  <span className="trigger-name">{item.name}</span>
                  {hasTrigger && (
                    <svg className="configured-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                  )}
                </div>
                <div className="trigger-controls">
                  <label className="auto-invoke-toggle" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={config.autoInvoke}
                      onChange={(e) => updateConfig(item.id, item.type, item.name, { autoInvoke: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">Auto</span>
                  </label>
                  <svg
                    className={`expand-icon ${isExpanded ? 'rotated' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6"></path>
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="trigger-content">
                  <p className="trigger-description">{item.description}</p>

                  {/* Trigger Input */}
                  <div className="trigger-input-wrapper">
                    <label className="trigger-input-label">When to use:</label>
                    <textarea
                      className="trigger-input"
                      placeholder="e.g., When working on UI components, before making design decisions..."
                      value={config.trigger}
                      onChange={(e) => updateConfig(item.id, item.type, item.name, { trigger: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Suggestions */}
                  <div className="trigger-suggestions">
                    <span className="suggestions-label">Suggestions:</span>
                    <div className="suggestions-chips">
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="suggestion-chip"
                          onClick={() => applySuggestion(item.id, item.type, item.name, suggestion)}
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="triggers-quick-actions">
        <button
          type="button"
          className="quick-action"
          onClick={() => {
            // Enable auto-invoke for all
            const updated = itemsToConfig.map(item => ({
              ...getConfig(item.id, item.type, item.name),
              autoInvoke: true,
            }));
            onTriggerChange(updated);
          }}
        >
          Enable all Auto-invoke
        </button>
        <button
          type="button"
          className="quick-action secondary"
          onClick={() => {
            // Clear all triggers
            onTriggerChange([]);
          }}
        >
          Reset all
        </button>
      </div>

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
          {creating ? (
            <>
              <span className="spinner"></span>
              {isEditing ? 'Saving agent...' : 'Creating agent...'}
            </>
          ) : (
            isEditing ? 'Save Agent' : 'Create Agent'
          )}
        </button>
      </div>
    </>
  );
}
