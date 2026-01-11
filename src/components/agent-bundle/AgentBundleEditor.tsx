import React, { useState, useMemo, useEffect } from 'react';
import type { SavedAgent } from '../../types';
import { EquipmentPickerModal } from './EquipmentPickerModal';
import './AgentBundleEditor.css';

interface AgentBundleEditorProps {
  /** Agent data from Basics step */
  agent?: SavedAgent;
  availableSkills: string[];
  availableDroids: string[];
  availableRules: string[];
  availableCommands: string[];
  onSave: (agent: SavedAgent) => void;
  onCancel: () => void;
  /** Whether we're editing an existing agent (changes button text) */
  isEditing?: boolean;
}

/**
 * Agent Toolkit Editor - Brand Guidelines Style
 *
 * Step 5 of agent creation: Select quick-access tools.
 * These tools will appear in the chat EquipBar for easy invocation.
 *
 * Layout: 3-column grid with Skills, Droids, Commands sections
 */
export function AgentBundleEditor({
  agent,
  availableSkills,
  availableDroids,
  availableRules,
  availableCommands,
  onSave,
  onCancel,
  isEditing = false,
}: AgentBundleEditorProps) {
  const name = agent?.name || 'Agent';

  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    agent?.personality?.toolkit?.skills || agent?.personality?.skills || []
  );
  const [selectedDroids, setSelectedDroids] = useState<string[]>(
    agent?.personality?.toolkit?.droids || []
  );
  const [selectedCommands, setSelectedCommands] = useState<string[]>(
    agent?.personality?.toolkit?.commands || []
  );

  // Sync state when agent prop changes (important for edit mode)
  useEffect(() => {
    const toolkit = agent?.personality?.toolkit;
    if (toolkit) {
      setSelectedSkills(toolkit.skills || agent?.personality?.skills || []);
      setSelectedDroids(toolkit.droids || []);
      setSelectedCommands(toolkit.commands || []);
    }
  }, [agent?.personality?.toolkit, agent?.personality?.skills]);

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState<'skills' | 'droids' | 'commands' | null>(null);

  // Handlers for adding/removing items
  const handleRemoveSkill = (skill: string) => {
    setSelectedSkills(prev => prev.filter(s => s !== skill));
  };

  const handleRemoveDroid = (droid: string) => {
    setSelectedDroids(prev => prev.filter(d => d !== droid));
  };

  const handleRemoveCommand = (command: string) => {
    setSelectedCommands(prev => prev.filter(c => c !== command));
  };

  // Picker modal handlers
  const handlePickerConfirm = (selected: string[]) => {
    if (pickerOpen === 'skills') {
      setSelectedSkills(selected);
    } else if (pickerOpen === 'droids') {
      setSelectedDroids(selected);
    } else if (pickerOpen === 'commands') {
      setSelectedCommands(selected);
    }
    setPickerOpen(null);
  };

  const handlePickerCancel = () => setPickerOpen(null);

  // Get picker props based on current picker type
  const getPickerProps = () => {
    switch (pickerOpen) {
      case 'skills':
        return {
          title: 'Select Skills',
          items: availableSkills,
          selectedItems: selectedSkills,
          maxItems: 10,
          color: '#f28c52',
        };
      case 'droids':
        return {
          title: 'Select Droids',
          items: availableDroids,
          selectedItems: selectedDroids,
          maxItems: 6,
          color: '#f28c52',
        };
      case 'commands':
        return {
          title: 'Select Commands',
          items: availableCommands,
          selectedItems: selectedCommands,
          maxItems: 10,
          color: '#f28c52',
        };
      default:
        return {
          title: '',
          items: [],
          selectedItems: [],
          maxItems: 10,
          color: '#f28c52',
        };
    }
  };

  const handleSave = () => {
    const savedAgent: SavedAgent = {
      id: agent?.id || `agent-${Date.now()}`,
      name,
      avatar: agent?.avatar || '',
      color: agent?.color || '#f28c52',
      workingOn: agent?.workingOn,
      personality: {
        ...agent?.personality,
        toolkit: {
          skills: selectedSkills,
          droids: selectedDroids,
          commands: selectedCommands,
        },
      },
      createdAt: agent?.createdAt || Date.now(),
      lastUsed: Date.now(),
      usageCount: agent?.usageCount || 0,
    };

    onSave(savedAgent);
  };

  // SVG Icons
  const SkillsIcon = () => (
    <svg className="toolkit-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );

  const DroidsIcon = () => (
    <svg className="toolkit-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="3" />
      <path d="M12 8v3" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );

  const CommandsIcon = () => (
    <svg className="toolkit-section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );

  const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: string[],
    onAdd: () => void,
    onRemove: (item: string) => void,
    emptyText: string
  ) => (
    <div className="toolkit-section">
      <div className="toolkit-section-header">
        <div className="toolkit-section-title">
          {icon}
          <span>{title}</span>
        </div>
        <span className="toolkit-section-count">{items.length} selected</span>
      </div>
      <div className="toolkit-items">
        {items.map(item => (
          <div key={item} className="toolkit-item">
            <span className="toolkit-item-name">{item}</span>
            <button
              className="toolkit-item-remove"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item}`}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
        <button className="toolkit-add-btn" onClick={onAdd}>
          <PlusIcon />
          <span>Add</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="toolkit-editor">
      <p className="toolkit-description">
        Select your quick-access tools. These will appear in the chat toolbar for easy invocation with a single click.
      </p>

      <div className="toolkit-grid">
        {renderSection(
          'Skills',
          <SkillsIcon />,
          selectedSkills,
          () => setPickerOpen('skills'),
          handleRemoveSkill,
          'No skills selected'
        )}
        {renderSection(
          'Droids',
          <DroidsIcon />,
          selectedDroids,
          () => setPickerOpen('droids'),
          handleRemoveDroid,
          'No droids selected'
        )}
        {renderSection(
          'Commands',
          <CommandsIcon />,
          selectedCommands,
          () => setPickerOpen('commands'),
          handleRemoveCommand,
          'No commands selected'
        )}
      </div>

      {/* Action buttons */}
      <div className="toolkit-actions">
        <button className="toolkit-btn toolkit-btn-secondary" onClick={onCancel}>
          Back
        </button>
        <button className="toolkit-btn toolkit-btn-primary" onClick={handleSave}>
          {isEditing ? 'Save Agent' : 'Create Agent'}
        </button>
      </div>

      {/* Equipment Picker Modal */}
      <EquipmentPickerModal
        open={pickerOpen !== null}
        {...getPickerProps()}
        onConfirm={handlePickerConfirm}
        onCancel={handlePickerCancel}
      />
    </div>
  );
}
