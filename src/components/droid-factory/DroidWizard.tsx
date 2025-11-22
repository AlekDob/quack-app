import { useState } from 'react';
import { TOOL_LEVELS, type DroidSpec } from './types';

interface DroidWizardProps {
  initialSpec?: DroidSpec;
  onCreateDroid: (spec: DroidSpec) => Promise<void>;
  isCreating: boolean;
}

export function DroidWizard({ initialSpec, onCreateDroid, isCreating }: DroidWizardProps) {
  const [spec, setSpec] = useState<DroidSpec>(
    initialSpec || {
      name: '',
      displayName: '',
      description: '',
      personality: 'professional',
      tools: ['Read', 'Grep', 'Glob'],
      model: 'sonnet',
      specialization: '',
      icon: '',
    }
  );

  const [selectedToolLevel, setSelectedToolLevel] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateSpec = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!spec.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (!spec.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!spec.specialization.trim()) {
      newErrors.specialization = 'Specialization is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateDroid = async () => {
    if (!validateSpec()) return;

    // Auto-generate name from display name
    const generatedName = spec.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    await onCreateDroid({
      ...spec,
      name: generatedName,
    });
  };

  const handleToolLevelChange = (level: number) => {
    setSelectedToolLevel(level);
    const toolConfig = Object.values(TOOL_LEVELS).find((t) => t.level === level);
    if (toolConfig) {
      setSpec({ ...spec, tools: [...toolConfig.tools] });
    }
  };

  return (
    <div>
      <p className="text-xs mb-3 leading-tight" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        Configure your custom droid by filling in the details below. All fields are required.
      </p>

      <div className="space-y-4">
        {/* Basic Info Card - More spacious */}
        <div
          className="rounded-lg p-3"
          style={{
            background: '#090A0C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" />
              <line x1="8" y1="9" x2="16" y2="9" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="15" x2="12" y2="15" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h4 className="text-sm font-semibold" style={{ color: '#FF6B35' }}>
              Basic Information
            </h4>
          </div>

          <div className="space-y-3">
            {/* Display Name - Larger input */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Display Name
              </label>
              <input
                type="text"
                value={spec.displayName}
                onChange={(e) => setSpec({ ...spec, displayName: e.target.value })}
                placeholder='e.g., "API Documentation Writer"'
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: '#1a1a1f',
                  border: errors.displayName ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  height: '36px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = errors.displayName ? '#ef4444' : '#FF6B35';
                  e.currentTarget.style.background = '#1e1e24';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.displayName ? '#ef4444' : 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = '#1a1a1f';
                }}
              />
              {errors.displayName && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.displayName}</p>
              )}
            </div>

            {/* Description - Larger textarea */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Description
              </label>
              <textarea
                value={spec.description}
                onChange={(e) => setSpec({ ...spec, description: e.target.value })}
                placeholder="Brief description of what this droid does"
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none transition-colors leading-tight"
                style={{
                  background: '#1a1a1f',
                  border: errors.description ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = errors.description ? '#ef4444' : '#FF6B35';
                  e.currentTarget.style.background = '#1e1e24';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.description ? '#ef4444' : 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = '#1a1a1f';
                }}
              />
              {errors.description && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.description}</p>
              )}
            </div>

            {/* Specialization - Larger input */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Specialization
              </label>
              <input
                type="text"
                value={spec.specialization}
                onChange={(e) => setSpec({ ...spec, specialization: e.target.value })}
                placeholder='e.g., "API documentation and OpenAPI specs"'
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: '#1a1a1f',
                  border: errors.specialization ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  height: '36px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = errors.specialization ? '#ef4444' : '#FF6B35';
                  e.currentTarget.style.background = '#1e1e24';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.specialization ? '#ef4444' : 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = '#1a1a1f';
                }}
              />
              {errors.specialization && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{errors.specialization}</p>
              )}
            </div>
          </div>
        </div>

        {/* Model Selection Card */}
        <div
          className="rounded-lg p-3"
          style={{
            background: '#090A0C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h4 className="text-sm font-semibold" style={{ color: '#FF6B35' }}>
              AI Model
            </h4>
          </div>

          <div>
            {/* Model - Larger select */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Choose Model
              </label>
              <select
                value={spec.model}
                onChange={(e) => setSpec({ ...spec, model: e.target.value as DroidSpec['model'] })}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors font-mono"
                style={{
                  background: '#1a1a1f',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  height: '36px',
                }}
              >
                <option value="sonnet">sonnet - Balanced (recommended)</option>
                <option value="opus">opus - Most capable</option>
                <option value="haiku">haiku - Fastest</option>
                <option value="inherit">inherit - Use default</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tool Permissions Card - More spacious */}
        <div
          className="rounded-lg p-3"
          style={{
            background: '#090A0C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" />
              <path d="M12 11V7M12 7C12 5.34315 13.3431 4 15 4C15.7403 4 16.3866 4.4022 16.7324 5M12 7C12 5.34315 10.6569 4 9 4C8.25972 4 7.61337 4.4022 7.26756 5" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h4 className="text-sm font-semibold" style={{ color: '#FF6B35' }}>
              Tool Permissions
            </h4>
          </div>

          <div className="space-y-3">
            {/* Permission Level - Larger select */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Permission Level
              </label>
              <select
                value={selectedToolLevel}
                onChange={(e) => handleToolLevelChange(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: '#1a1a1f',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  height: '36px',
                }}
              >
                {Object.values(TOOL_LEVELS).map((level) => (
                  <option key={level.level} value={level.level}>
                    Level {level.level}: {level.name} - {level.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled Tools - Larger badges */}
            <div>
              <p className="text-xs mb-2 font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Enabled Tools ({spec.tools.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {spec.tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-2 py-1 rounded text-xs font-medium font-mono"
                    style={{
                      background: 'rgba(107, 114, 128, 0.2)',
                      color: '#9ca3af',
                      border: '1px solid rgba(107, 114, 128, 0.3)',
                    }}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview - More spacious */}
        {spec.displayName && spec.description && (
          <div
            className="rounded-lg p-3"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div className="flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-0.5">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5Z" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Preview: {spec.displayName}
                </p>
                <p className="text-xs leading-tight" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  {spec.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create Button - Larger and more prominent */}
        <button
          type="button"
          onClick={handleCreateDroid}
          disabled={isCreating || !spec.displayName || !spec.description || !spec.specialization}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: '#FF6B35',
            color: '#ffffff',
            boxShadow: isCreating ? 'none' : '0 2px 8px rgba(255, 107, 53, 0.3)',
          }}
          onMouseEnter={(e) => {
            if (!isCreating && spec.displayName && spec.description && spec.specialization) {
              e.currentTarget.style.background = '#E55A24';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FF6B35';
            e.currentTarget.style.boxShadow = isCreating ? 'none' : '0 2px 8px rgba(255, 107, 53, 0.3)';
          }}
        >
          {isCreating ? 'Assembling Droid...' : 'Create Droid'}
        </button>
      </div>
    </div>
  );
}
