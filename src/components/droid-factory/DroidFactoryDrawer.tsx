import { useState } from 'react';
import { toast } from 'sonner';
import { DroidTemplateGallery } from './DroidTemplateGallery';
import { DroidWizard } from './DroidWizard';
import { DroidCollection } from './DroidCollection';
import { AssemblyLine } from './AssemblyLine';
import { validateDroidSpec } from '../../services/droidFactory';
import type { DroidSpec, UserStats } from './types';

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
  const [activeTab, setActiveTab] = useState<DroidFactoryTab>('templates');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DroidSpec | null>(null);

  const handleTemplateSelect = (template: DroidSpec) => {
    setSelectedTemplate(template);
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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col"
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
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{
            borderColor: 'rgba(255, 255, 255, 0.05)',
            background: '#101015',
          }}
        >
          <h3 className="text-base font-semibold" style={{ color: '#ffffff' }}>
            Droid Factory
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
        </div>

        {/* Assembly Line Visualization (shown during creation) */}
        {isCreating && <AssemblyLine />}
      </div>
    </>
  );
}
