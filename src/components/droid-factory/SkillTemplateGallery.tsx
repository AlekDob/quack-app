import { SKILL_TEMPLATES } from './types';
import type { SkillSpec } from './types';

interface SkillTemplateGalleryProps {
  onSelectTemplate: (template: SkillSpec) => void;
}

export function SkillTemplateGallery({ onSelectTemplate }: SkillTemplateGalleryProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
        Choose a template to get started quickly, or create a custom skill from scratch.
      </p>

      <div className="grid grid-cols-1 gap-3">
        {SKILL_TEMPLATES.map((template) => (
          <button
            key={template.name}
            type="button"
            onClick={() => onSelectTemplate(template)}
            className="p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                style={{
                  background: 'rgba(var(--accent-rgb), 0.15)',
                  border: '1px solid rgba(var(--accent-rgb), 0.30)',
                }}
              >
                <img
                  src="/images/skills.jpeg"
                  alt={template.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-base mb-1" style={{ color: '#ffffff' }}>
                  {template.displayName}
                </h4>
                <p className="text-sm mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'rgba(var(--accent-rgb), 0.15)',
                      color: 'var(--accent-color)',
                      border: '1px solid rgba(var(--accent-rgb), 0.30)',
                    }}
                  >
                    {template.category}
                  </span>
                  {template.hasScripts && (
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'rgba(0, 217, 255, 0.15)',
                        color: '#00D9FF',
                        border: '1px solid rgba(0, 217, 255, 0.3)',
                      }}
                    >
                      Scripts
                    </span>
                  )}
                  {template.hasReferences && (
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                      }}
                    >
                      References
                    </span>
                  )}
                  {template.hasAssets && (
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'rgba(147, 51, 234, 0.15)',
                        color: '#9333ea',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                      }}
                    >
                      Assets
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
