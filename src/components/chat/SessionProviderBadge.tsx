// Brain: 037-anthropic-compatible-providers
// Small badge shown in a session header indicating which provider + model
// the session is using. Mirrors the value the picker had at spawn time.

import { useMemo } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { BUILTIN_PRESETS } from '../../constants/providerPresets';
import { useSessionProviderOverride } from '../../services/sessionProviderOverrides';
import type { ProviderEntry } from '../../types/providers';

interface Props {
  sessionId: string;
  modelEcho?: string | null;
}

export default function SessionProviderBadge({ sessionId, modelEcho }: Props) {
  const customProviders = useSettingsStore((s) => s.claude.customProviders) ?? [];
  const activeProvider = useSettingsStore((s) => s.claude.activeProvider) ?? { kind: 'anthropic' as const };
  const override = useSessionProviderOverride(sessionId);

  const all: ProviderEntry[] = useMemo(
    () => [...BUILTIN_PRESETS, ...customProviders],
    [customProviders],
  );

  const resolvedId =
    override ??
    (activeProvider.kind === 'custom' ? activeProvider.providerId : 'anthropic');
  const provider = all.find((p) => p.id === resolvedId);
  if (!provider) return null;

  // Hide badge for default Anthropic to avoid visual noise when nothing custom is active.
  if (provider.id === 'anthropic' && !override) return null;

  return (
    <span
      title={override ? 'Per-session override' : 'Using global default'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 10,
        background: override ? 'rgba(var(--accent-rgb), 0.16)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${override ? 'rgba(var(--accent-rgb), 0.35)' : 'rgba(255,255,255,0.1)'}`,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ opacity: 0.9 }}>{provider.name}</span>
      {(modelEcho || provider.sonnetModel) && (
        <span style={{ opacity: 0.5 }}>· {modelEcho || provider.sonnetModel}</span>
      )}
    </span>
  );
}
