import { useState } from 'react';
import { toast } from 'sonner';
import { DroidTemplateGallery } from './DroidTemplateGallery';
import { DroidWizard } from './DroidWizard';
import { DroidCollection } from './DroidCollection';
import { SkillTemplateGallery } from './SkillTemplateGallery';
import { SkillWizard } from './SkillWizard';
import { AssemblyLine } from './AssemblyLine';
import { validateDroidSpec } from '../../services/droidFactory';
import { useDrawerAnimation } from '../../hooks/useDrawerAnimation';
import type { DroidSpec, SkillSpec, FactoryMode, UserStats } from './types';

interface DroidFactoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  userStats: UserStats;
}

type DroidFactoryTab = 'templates' | 'custom' | 'collection';

export function DroidFactoryDrawer({
  open,
  onClose,
  onSendMessage,
  userStats,
}: DroidFactoryDrawerProps) {
  const [mode, setMode] = useState<FactoryMode>('droid');
  const [activeTab, setActiveTab] = useState<DroidFactoryTab>('templates');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DroidSpec | null>(null);
  const [selectedSkillTemplate, setSelectedSkillTemplate] = useState<SkillSpec | null>(null);
  const { isClosing, handleClose, getClassName } = useDrawerAnimation(onClose);

  const handleTemplateSelect = (template: DroidSpec) => {
    setSelectedTemplate(template);
    setActiveTab('custom');
  };

  const handleSkillTemplateSelect = (template: SkillSpec) => {
    setSelectedSkillTemplate(template);
    setActiveTab('custom');
  };

  const handleCreateDroid = async (spec: DroidSpec) => {
    // Validate spec
    const validation = validateDroidSpec(spec);
    if (!validation.valid) {
      toast.error(`Validation failed: ${validation.errors.join(', ')}`);
      return;
    }

    // Generate message to send to AI with instructions to read the skill
    const message = `I need you to create a new AI agent (droid).

**IMPORTANT - Check for existing droids first:**
Before creating, please check if similar droids already exist in:
1. ~/.claude/agents/ (global droids)
2. .claude/agents/ (project droids)

If you find existing droids with similar names, descriptions, or purposes, please:
- List them for me
- Ask if I want to proceed anyway or use an existing one
- Only create the new droid after I confirm

Please read the instructions in public/embedded-skills/droid-factory/SKILL.md to understand how to create droids properly.

Then create an agent with these specifications:

**Name:** ${spec.displayName}
**Description:** ${spec.description}
**Specialization:** ${spec.specialization}
**Tools:** ${spec.tools.join(', ')}
**Model:** ${spec.model}

Save the agent file to .claude/agents/${spec.name}.md in the current project.`;

    // Show Assembly Line animation
    setIsCreating(true);

    // Send message to AI via callback
    onSendMessage(message);

    // Show info toast
    toast.info('Droid creation request sent', {
      description: 'Check the chat to see the AI create your droid',
    });

    // Reset UI after delay to show Assembly Line, then close drawer
    setTimeout(() => {
      setIsCreating(false);
      setActiveTab('collection');
      setSelectedTemplate(null);
      // Close drawer after another brief moment
      setTimeout(() => {
        onClose();
      }, 300);
    }, 800);
  };

  const handleCreateSkill = async (spec: SkillSpec) => {
    // Generate message to send to AI with instructions to read the skill-creator skill
    const message = `I need you to create a new skill package.

**IMPORTANT - Check for existing skills first:**
Before creating, please check if similar skills already exist in:
1. ~/.claude/skills/ (global skills)
2. .claude/skills/ (project skills)

If you find existing skills with similar names, descriptions, or purposes, please:
- List them for me
- Ask if I want to proceed anyway or use an existing one
- Only create the new skill after I confirm

Please read the instructions in public/embedded-skills/skill-creator/SKILL.md to understand how to create skills properly.

Then create a skill with these specifications:

**Name:** ${spec.displayName}
**Description:** ${spec.description}
**Category:** ${spec.category}
**Resources:**
- Scripts: ${spec.hasScripts ? 'Yes' : 'No'}
- References: ${spec.hasReferences ? 'Yes' : 'No'}
- Assets: ${spec.hasAssets ? 'Yes' : 'No'}

Save the skill to .claude/skills/${spec.name}/ in the current project.`;

    // Show Assembly Line animation
    setIsCreating(true);

    // Send message to AI via callback
    onSendMessage(message);

    // Show info toast
    toast.info('Skill creation request sent', {
      description: 'Check the chat to see the AI create your skill',
    });

    // Reset UI after delay to show Assembly Line, then close drawer
    setTimeout(() => {
      setIsCreating(false);
      setActiveTab('collection');
      setSelectedSkillTemplate(null);
      // Close drawer after another brief moment
      setTimeout(() => {
        onClose();
      }, 300);
    }, 800);
  };

  if (!open && !isClosing) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={getClassName('fixed inset-y-0 right-0 z-50 flex flex-col')}
        style={{
          width: '600px',
          maxWidth: '100vw',
          background: '#0A0A0D',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Header - More spacious */}
        <div
          className="px-4 py-3 border-b"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.05)',
            background: '#101015',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold" style={{ color: '#ffffff' }}>
              Droid Factory
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setMode('droid')}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: mode === 'droid' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: mode === 'droid' ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
                border: mode === 'droid' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="10" cy="3" r="0.8" fill="currentColor" />
                <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
                <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
                <line x1="7" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Droids
            </button>
            <button
              type="button"
              onClick={() => setMode('skill')}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: mode === 'skill' ? 'rgba(247, 147, 30, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: mode === 'skill' ? '#F7931E' : 'rgba(255, 255, 255, 0.6)',
                border: mode === 'skill' ? '1px solid #F7931E' : '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3L4 7v6l6 4 6-4V7l-6-4z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="2.5" fill="currentColor" />
                <line x1="10" y1="7.5" x2="10" y2="3" stroke="currentColor" strokeWidth="1.5" />
                <line x1="10" y1="12.5" x2="10" y2="17" stroke="currentColor" strokeWidth="1.5" />
                <line x1="7.5" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5" />
                <line x1="12.5" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Skills
            </button>
          </div>
        </div>

        {/* Stats Bar - More spacious */}
        <div
          className="px-4 py-2 border-b"
          style={{
            background: '#16161a',
            borderColor: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="8" height="8" rx="1" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" fill="none" />
                <circle cx="7" cy="7" r="0.8" fill="rgba(255, 255, 255, 0.5)" />
                <circle cx="9" cy="7" r="0.8" fill="rgba(255, 255, 255, 0.5)" />
              </svg>
              <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Droids: <strong style={{ color: '#ffffff' }}>{userStats.droidsCreated}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2L5 4.5L6 6L8 7.5L10 6L11 4.5L8 2Z" fill="rgba(255, 255, 255, 0.5)" />
                <path d="M5 5L3 8L5 11L8 9.5L5 5Z" fill="rgba(255, 255, 255, 0.5)" opacity="0.6" />
                <path d="M11 5L13 8L11 11L8 9.5L11 5Z" fill="rgba(255, 255, 255, 0.5)" opacity="0.6" />
              </svg>
              <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Achievements: <strong style={{ color: '#ffffff' }}>{userStats.achievements.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Tabs - More spacious */}
        <div className="border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          <div className="flex">
            {[
              { value: 'templates', label: 'Templates' },
              { value: 'custom', label: 'Custom' },
              { value: 'collection', label: 'Collection' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value as DroidFactoryTab)}
                className="flex-1 px-4 py-3 text-sm font-medium transition-colors relative"
                style={{
                  color: activeTab === tab.value ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
                  background: activeTab === tab.value ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                }}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: '2px', background: '#3b82f6' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content - More padding */}
        <div className="flex-1 overflow-y-auto p-4">
          {mode === 'droid' && (
            <>
              {activeTab === 'templates' && (
                <DroidTemplateGallery onSelectTemplate={handleTemplateSelect} />
              )}
              {activeTab === 'custom' && (
                <DroidWizard
                  initialSpec={selectedTemplate || undefined}
                  onCreateDroid={handleCreateDroid}
                  isCreating={isCreating}
                />
              )}
              {activeTab === 'collection' && (
                <DroidCollection userStats={userStats} />
              )}
            </>
          )}

          {mode === 'skill' && (
            <>
              {activeTab === 'templates' && (
                <SkillTemplateGallery onSelectTemplate={handleSkillTemplateSelect} />
              )}
              {activeTab === 'custom' && (
                <SkillWizard
                  initialSpec={selectedSkillTemplate || undefined}
                  onCreateSkill={handleCreateSkill}
                  isCreating={isCreating}
                />
              )}
              {activeTab === 'collection' && (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Skill collection coming soon...
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Assembly Line Visualization (shown during creation) */}
        {isCreating && <AssemblyLine />}
      </div>
    </>
  );
}
