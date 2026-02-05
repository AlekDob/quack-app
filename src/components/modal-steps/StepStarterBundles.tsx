/**
 * Step: Starter Agent Bundles
 * Shows starter agent templates from marketplace during onboarding.
 * User selects which agents to create for their project.
 */

import { useState } from 'react';
import type { MarketplaceResource, AgentTemplate } from '../../types';
import { getAvatarUrl } from '../../utils/agentAvatars';

interface StarterBundle {
  resource: MarketplaceResource;
  template: AgentTemplate;
}

interface StepStarterBundlesProps {
  bundles: StarterBundle[];
  loading: boolean;
  installing: boolean;
  onConfirm: (selected: StarterBundle[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepStarterBundles({
  bundles,
  loading,
  installing,
  onConfirm,
  onSkip,
  onBack,
}: StepStarterBundlesProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Pre-select first two by default
    const initial = new Set<string>();
    bundles.slice(0, 2).forEach(b => initial.add(b.resource.id));
    return initial;
  });

  function toggleBundle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    const selected = bundles.filter(b => selectedIds.has(b.resource.id));
    onConfirm(selected);
  }

  if (installing) {
    const selectedCount = selectedIds.size;
    return (
      <div className="step-content" style={{
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: 300,
      }}>
        {/* Spinner */}
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#f28c52',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
          Setting up your agents...
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.5 }}>
          Installing skills, rules and creating {selectedCount} agent{selectedCount !== 1 ? 's' : ''}.
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="step-content" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          Loading starter agents...
        </div>
      </div>
    );
  }

  return (
    <div className="step-content">
      <div style={{ padding: '24px 24px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
          Choose starter agents
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.5 }}>
          Pre-configured AI agents with skills and rules. You can customize them later.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bundles.map((bundle) => {
            const isSelected = selectedIds.has(bundle.resource.id);
            const template = bundle.template;
            const skillCount = (template.skills || template.bundledPlugins)?.length || 0;

            return (
              <button
                key={bundle.resource.id}
                type="button"
                onClick={() => toggleBundle(bundle.resource.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSelected
                    ? '1px solid rgba(242, 140, 82, 0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected
                    ? 'rgba(242, 140, 82, 0.08)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  width: '100%',
                }}
              >
                {/* Avatar with selection indicator */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: isSelected
                      ? `2px solid ${template.suggestedColor}`
                      : '2px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                    overflow: 'hidden',
                    position: 'relative',
                    opacity: isSelected ? 1 : 0.6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <img
                    src={template.suggestedAvatar ? getAvatarUrl(template.suggestedAvatar) : undefined}
                    alt={template.suggestedName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: template.suggestedColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                    marginBottom: 2,
                  }}>
                    {template.suggestedName} — {template.role}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {template.communicationStyle} style
                    {skillCount > 0 && ` · ${skillCount} ${skillCount === 1 ? 'skill' : 'skills'}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="modal-actions" style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          className="modal-btn-secondary"
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            color: 'rgba(255,255,255,0.6)',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onSkip}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: selectedIds.size > 0 ? '#fff' : 'rgba(255,255,255,0.3)',
              background: selectedIds.size > 0
                ? 'linear-gradient(135deg, #f28c52 0%, #e06b2a 100%)'
                : 'rgba(255,255,255,0.05)',
              border: 'none',
              cursor: selectedIds.size > 0 ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
            }}
          >
            Create {selectedIds.size} agent{selectedIds.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { StarterBundle };
