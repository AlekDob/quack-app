/**
 * Step 5: Triggers Configuration
 * - Configure WHEN to use each selected skill/droid
 * - User defines triggers with concrete pattern-based suggestions
 * - AI-powered trigger generation via OpenAI
 * - Toggle auto-invoke for proactive behavior
 * - Quality indicator shows trigger specificity
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import type { TriggerConfig, SkillMetadata, DroidMetadata } from './types';
import {
  detectCategory,
  calculateTriggerQuality,
  generateSmartTrigger,
  TRIGGER_SUGGESTIONS,
  EXAMPLE_TRIGGERS,
} from '../../lib/triggerQuality';
import { useAITriggerGenerator } from '../../hooks/useAITriggerGenerator';

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
  const [generatingItemId, setGeneratingItemId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Ref to track if component is mounted (prevent memory leaks)
  const isMountedRef = useRef(true);

  // Cleanup on unmount - reset to true on mount, false on unmount
  useEffect(() => {
    isMountedRef.current = true;
    console.log('[StepTriggers] Component mounted, isMountedRef set to true');
    return () => {
      console.log('[StepTriggers] Component unmounting, setting isMountedRef to false');
      isMountedRef.current = false;
    };
  }, []);

  // AI Trigger Generator hook
  const { generateTrigger: generateAITrigger, isGenerating, isAvailable: isAIAvailable } = useAITriggerGenerator();

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

  // Generate smart trigger using AI (with fallback to pattern-based)
  const handleGenerateTrigger = async (item: { id: string; type: 'skill' | 'droid'; name: string; description: string; category: string }) => {
    const itemKey = `${item.type}-${item.id}`;
    console.log(`[StepTriggers] Starting generation for ${item.name}, key: ${itemKey}`);
    setGeneratingItemId(itemKey);

    try {
      console.log(`[StepTriggers] Calling generateAITrigger...`);
      const result = await generateAITrigger({
        name: item.name,
        description: item.description,
        category: item.category,
      });
      console.log(`[StepTriggers] Got result:`, result);
      console.log(`[StepTriggers] isMountedRef.current:`, isMountedRef.current);

      // Always try to update - the parent callback should handle it
      console.log(`[StepTriggers] Updating config with trigger: "${result.trigger}"`);
      updateConfig(item.id, item.type, item.name, { trigger: result.trigger });
      console.log(`[StepTriggers] Config updated successfully`);

      if (result.isAIGenerated) {
        console.log(`[StepTriggers] AI generated trigger for ${item.name} using ${result.model}`);
      } else {
        console.log(`[StepTriggers] Fallback pattern-based trigger for ${item.name}`);
      }
    } catch (err) {
      console.error('[StepTriggers] Error generating trigger:', err);
      // Fallback to pattern-based
      const smartTrigger = generateSmartTrigger(item.name, item.description, item.category);
      updateConfig(item.id, item.type, item.name, { trigger: smartTrigger });
    } finally {
      // Always reset generating state
      console.log(`[StepTriggers] Resetting generatingItemId to null`);
      setGeneratingItemId(null);
    }
  };

  // Generate all triggers using AI
  const handleGenerateAllTriggers = async () => {
    setIsGeneratingAll(true);

    for (const item of itemsToConfig) {
      // Stop if component unmounted
      if (!isMountedRef.current) return;

      const existing = getConfig(item.id, item.type, item.name);
      // Only generate if no trigger exists
      if (!existing.trigger.trim()) {
        try {
          const result = await generateAITrigger({
            name: item.name,
            description: item.description,
            category: item.category,
          });
          // Check if still mounted before updating
          if (!isMountedRef.current) return;
          updateConfig(item.id, item.type, item.name, { trigger: result.trigger, autoInvoke: true });
        } catch {
          // Check if still mounted before updating
          if (!isMountedRef.current) return;
          // Fallback to pattern-based
          const smartTrigger = generateSmartTrigger(item.name, item.description, item.category);
          updateConfig(item.id, item.type, item.name, { trigger: smartTrigger, autoInvoke: true });
        }
      }
    }

    if (isMountedRef.current) {
      setIsGeneratingAll(false);
    }
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
          <strong>Define WHEN to use each skill/droid.</strong> Be specific: use file patterns (*.test.ts), folder paths (/components), or keywords. The more concrete your trigger, the better your agent will understand when to act.
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
          const suggestions = TRIGGER_SUGGESTIONS[item.category] || TRIGGER_SUGGESTIONS['default'];
          const hasTrigger = config.trigger.trim().length > 0;
          const quality = hasTrigger ? calculateTriggerQuality(config.trigger) : null;
          const exampleTrigger = EXAMPLE_TRIGGERS[item.category] || EXAMPLE_TRIGGERS['default'];

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
                  {quality && (
                    <span className={`trigger-quality-badge quality-${quality.level}`}>
                      {quality.level === 'weak' && '!'}
                      {quality.level === 'moderate' && '~'}
                      {quality.level === 'strong' && '✓'}
                    </span>
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

                  {/* Trigger Input with Quality Indicator */}
                  <div className="trigger-input-wrapper">
                    <div className="trigger-input-header">
                      <label className="trigger-input-label">When to use:</label>
                      {isAIAvailable ? (
                        <button
                          type="button"
                          className={`generate-trigger-btn ai-enabled ${generatingItemId === `${item.type}-${item.id}` ? 'generating' : ''}`}
                          onClick={() => handleGenerateTrigger(item)}
                          disabled={generatingItemId !== null || isGeneratingAll}
                          title="Generate AI-powered trigger using OpenAI"
                        >
                          {generatingItemId === `${item.type}-${item.id}` ? (
                            <>
                              <span className="btn-spinner"></span>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                              </svg>
                              AI Generate
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="generate-trigger-btn pattern-only"
                          onClick={() => handleGenerateTrigger(item)}
                          disabled={generatingItemId !== null || isGeneratingAll}
                          title="Generate pattern-based trigger (add OpenAI key in Settings for AI generation)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                          </svg>
                          Auto Generate
                        </button>
                      )}
                    </div>
                    <textarea
                      className={`trigger-input ${quality ? `quality-${quality.level}` : ''}`}
                      placeholder="e.g., When editing files in /components folder that contain React hooks..."
                      value={config.trigger}
                      onChange={(e) => updateConfig(item.id, item.type, item.name, { trigger: e.target.value })}
                      rows={3}
                    />
                    {quality && (
                      <div className={`trigger-quality-indicator quality-${quality.level}`}>
                        <div className="quality-bar">
                          <div className="quality-fill" style={{ width: `${Math.min(quality.score, 100)}%` }} />
                        </div>
                        <span className="quality-message">{quality.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Example */}
                  <div className="trigger-example">
                    <span className="example-label">Example:</span>
                    <code className="example-text">{exampleTrigger}</code>
                  </div>

                  {/* Suggestions */}
                  <div className="trigger-suggestions">
                    <span className="suggestions-label">Quick patterns:</span>
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
        {isAIAvailable ? (
          <button
            type="button"
            className={`quick-action ai-action primary ${isGeneratingAll ? 'generating' : ''}`}
            onClick={handleGenerateAllTriggers}
            disabled={isGeneratingAll || generatingItemId !== null}
          >
            {isGeneratingAll ? (
              <>
                <span className="btn-spinner"></span>
                Generating with AI...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                  <path d="M2 17l10 5 10-5"></path>
                  <path d="M2 12l10 5 10-5"></path>
                </svg>
                AI Generate All Empty
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`quick-action ${isGeneratingAll ? 'generating' : ''}`}
            onClick={handleGenerateAllTriggers}
            disabled={isGeneratingAll || generatingItemId !== null}
            title="Add OpenAI key in Settings for AI-powered generation"
          >
            {isGeneratingAll ? (
              <>
                <span className="btn-spinner"></span>
                Generating...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
                Auto Generate All Empty
              </>
            )}
          </button>
        )}
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
