import { DROID_TEMPLATES, type DroidSpec } from './types';

interface DroidTemplateGalleryProps {
  onSelectTemplate: (template: DroidSpec) => void;
}

// Droid icon component - using public/droid.jpeg (INCREASED SIZE)
const DroidIcon = () => (
  <img
    src="/droid.jpeg"
    alt="Droid"
    className="rounded-lg"
    style={{ width: '48px', height: '48px', objectFit: 'cover' }}
  />
);

export function DroidTemplateGallery({ onSelectTemplate }: DroidTemplateGalleryProps) {
  return (
    <div>
      <p className="text-xs mb-3 leading-tight" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        Choose a pre-built droid template to get started quickly, or create a custom one from scratch.
      </p>

      <div className="space-y-4">
        {DROID_TEMPLATES.map((template) => (
          <div
            key={template.name}
            className="rounded-lg p-4 cursor-pointer transition-all duration-200"
            style={{
              background: '#090A0C',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
            onClick={() => onSelectTemplate(template)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1a1a1f';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#090A0C';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <div className="space-y-3">
              {/* Header - More spacious with larger icon */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <DroidIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-tight" style={{ color: '#ffffff' }}>
                    {template.displayName}
                  </h4>
                  <p className="text-xs leading-tight" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    {template.specialization}
                  </p>
                </div>
              </div>

              {/* Description - More breathing room */}
              <p className="text-xs leading-snug" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {template.description}
              </p>

              {/* Metadata - Slightly larger badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    background: 'rgba(107, 114, 128, 0.2)',
                    color: '#9ca3af',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                  }}
                >
                  {template.tools.length} tools
                </span>
                <span
                  className="px-2 py-1 rounded text-xs font-medium font-mono"
                  style={{
                    background: 'rgba(var(--accent-rgb), 0.15)',
                    color: 'var(--accent-color)',
                    border: '1px solid rgba(var(--accent-rgb), 0.30)',
                  }}
                >
                  {template.model}
                </span>
              </div>

              {/* CTA - Compact button */}
              <button
                type="button"
                className="w-full py-1.5 px-3 rounded text-xs font-semibold transition-all"
                style={{
                  background: 'var(--accent-color)',
                  color: '#ffffff',
                  border: '1px solid rgba(var(--accent-rgb), 0.30)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTemplate(template);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-color)';
                  e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.30)';
                }}
              >
                Use Template
              </button>
            </div>
          </div>
        ))}

        {/* Custom Droid Card - More spacious */}
        <div
          className="rounded-lg p-4 cursor-pointer transition-all duration-200 text-center"
          style={{
            background: '#090A0C',
            border: '2px dashed rgba(255, 255, 255, 0.2)',
          }}
          onClick={() => onSelectTemplate({
            name: '',
            displayName: '',
            description: '',
            personality: 'professional',
            tools: ['Read', 'Grep', 'Glob'],
            model: 'sonnet',
            specialization: '',
            icon: '',
          })}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1a1a1f';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#090A0C';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          <div className="space-y-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="12" y1="8" x2="12" y2="16" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="12" x2="16" y2="12" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h4 className="text-sm font-semibold" style={{ color: '#ffffff' }}>
              Create Custom Droid
            </h4>
            <p className="text-xs leading-tight" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Build a droid from scratch with your own specifications
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
