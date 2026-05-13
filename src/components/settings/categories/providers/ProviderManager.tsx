// Brain: 037-anthropic-compatible-providers
import { useMemo, useState } from 'react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { BUILTIN_PRESETS } from '../../../../constants/providerPresets';
import { deleteCustomProvider } from '../../../../services/providerService';
import type {
  ActiveProviderState,
  CustomProvider,
  ProviderEntry,
} from '../../../../types/providers';
import ProviderCard from './ProviderCard';
import ProviderAddModal from './ProviderAddModal';

export default function ProviderManager() {
  // Defensive defaults — persisted state from older builds may lack these fields.
  const customProviders = useSettingsStore((s) => s.claude.customProviders) ?? [];
  const activeProvider = useSettingsStore((s) => s.claude.activeProvider) ?? { kind: 'anthropic' as const };
  const updateClaude = useSettingsStore((s) => s.updateClaudeSettings);

  const [addOpen, setAddOpen] = useState(false);
  const [duplicateSeed, setDuplicateSeed] = useState<Partial<CustomProvider> | undefined>(undefined);

  const allProviders: ProviderEntry[] = useMemo(
    () => [...BUILTIN_PRESETS, ...customProviders],
    [customProviders],
  );

  const handleSetDefault = (providerId: string) => {
    const next: ActiveProviderState =
      providerId === 'anthropic'
        ? { kind: 'anthropic' }
        : { kind: 'custom', providerId };
    updateClaude({ activeProvider: next });
  };

  const isActive = (providerId: string): boolean => {
    if (activeProvider.kind === 'anthropic') return providerId === 'anthropic';
    if (activeProvider.kind === 'custom') return providerId === activeProvider.providerId;
    return false;
  };

  const handleDuplicate = (source: ProviderEntry) => {
    setDuplicateSeed({
      name: `${source.name} (Copy)`,
      baseUrl: source.baseUrl,
      sonnetModel: source.sonnetModel,
      haikuModel: source.haikuModel,
      defaultModel: source.defaultModel,
      contextWindow: source.contextWindow,
    });
    setAddOpen(true);
  };

  const closeModal = () => {
    setAddOpen(false);
    setDuplicateSeed(undefined);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7, flex: 1 }}>
          Pick a provider preset or add a custom Anthropic-compatible endpoint.
          Per-session override is available when starting a new session.
        </div>
        <button
          type="button"
          onClick={() => {
            setDuplicateSeed(undefined);
            setAddOpen(true);
          }}
          style={{
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid rgba(var(--accent-rgb), 0.4)',
            background: 'rgba(var(--accent-rgb), 0.12)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          + Add provider
        </button>
      </div>

      {allProviders.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          isActive={isActive(p.id)}
          onSetDefault={() => handleSetDefault(p.id)}
          onDelete={
            p.isBuiltIn
              ? undefined
              : () => deleteCustomProvider(p.id)
          }
          onDuplicate={p.id === 'anthropic' ? undefined : () => handleDuplicate(p)}
        />
      ))}

      <ProviderAddModal open={addOpen} onClose={closeModal} initial={duplicateSeed} />
    </div>
  );
}
