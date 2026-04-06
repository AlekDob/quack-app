import { useState, useEffect } from 'react';
import type { SkillSpec } from './types';

interface SkillWizardProps {
  initialSpec?: SkillSpec;
  onCreateSkill: (spec: SkillSpec) => void;
  isCreating: boolean;
}

const CATEGORIES = [
  { value: 'workflow', label: 'Workflow', description: 'Multi-step processes' },
  { value: 'tool-integration', label: 'Tool Integration', description: 'API & service connectors' },
  { value: 'domain-expertise', label: 'Domain Expertise', description: 'Specialized knowledge' },
  { value: 'bundled-resources', label: 'Bundled Resources', description: 'Templates & assets' },
] as const;

export function SkillWizard({ initialSpec, onCreateSkill, isCreating }: SkillWizardProps) {
  const [displayName, setDisplayName] = useState(initialSpec?.displayName || '');
  const [description, setDescription] = useState(initialSpec?.description || '');
  const [category, setCategory] = useState<SkillSpec['category']>(initialSpec?.category || 'workflow');
  const [hasScripts, setHasScripts] = useState(initialSpec?.hasScripts || false);
  const [hasReferences, setHasReferences] = useState(initialSpec?.hasReferences || false);
  const [hasAssets, setHasAssets] = useState(initialSpec?.hasAssets || false);

  useEffect(() => {
    if (initialSpec) {
      setDisplayName(initialSpec.displayName);
      setDescription(initialSpec.description);
      setCategory(initialSpec.category);
      setHasScripts(initialSpec.hasScripts);
      setHasReferences(initialSpec.hasReferences);
      setHasAssets(initialSpec.hasAssets);
    }
  }, [initialSpec]);

  const generateName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const spec: SkillSpec = {
      name: generateName(displayName),
      displayName,
      description,
      category,
      hasScripts,
      hasReferences,
      hasAssets,
    };

    onCreateSkill(spec);
  };

  const isValid = displayName.trim() && description.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Skill Name *
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., API Client, Data Processor"
            className="w-full px-4 py-2.5 rounded-lg text-sm transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            }}
            required
          />
          {displayName && (
            <p className="text-xs mt-1" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              File name: {generateName(displayName) || '(empty)'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe when to use this skill and what it does..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg text-sm transition-all resize-none"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            }}
            required
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          Category *
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                background: category === cat.value ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: category === cat.value ? '2px solid var(--accent-color)' : '2px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="font-semibold text-sm mb-1" style={{ color: '#ffffff' }}>
                {cat.label}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                {cat.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
          Bundled Resources
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5">
            <input
              type="checkbox"
              checked={hasScripts}
              onChange={(e) => setHasScripts(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium" style={{ color: '#ffffff' }}>
                Scripts
              </div>
              <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Executable scripts and utilities
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5">
            <input
              type="checkbox"
              checked={hasReferences}
              onChange={(e) => setHasReferences(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium" style={{ color: '#ffffff' }}>
                References
              </div>
              <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Documentation and reference materials
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5">
            <input
              type="checkbox"
              checked={hasAssets}
              onChange={(e) => setHasAssets(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium" style={{ color: '#ffffff' }}>
                Assets
              </div>
              <div className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Template files and assets
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || isCreating}
        className="w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isValid ? 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-gradient-end) 100%)' : 'rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
        }}
      >
        {isCreating ? 'Creating Skill...' : 'Create Skill'}
      </button>
    </form>
  );
}
