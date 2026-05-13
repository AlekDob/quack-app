// Brain: 037-anthropic-compatible-providers
// Compact dropdown shown at session-start time. Allows overriding the global
// default provider for THIS session only. The override lives in memory until
// the session is closed.

import { useMemo } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { BUILTIN_PRESETS } from '../../constants/providerPresets';
import {
  setSessionProviderOverride,
  useSessionProviderOverride,
} from '../../services/sessionProviderOverrides';

interface Props {
  sessionId: string;
  compact?: boolean;
}

export default function NewSessionProviderPicker({ sessionId, compact }: Props) {
  const customProviders = useSettingsStore((s) => s.claude.customProviders) ?? [];
  const activeProvider = useSettingsStore((s) => s.claude.activeProvider) ?? { kind: 'anthropic' as const };
  const override = useSessionProviderOverride(sessionId);

  const options = useMemo(
    () => [...BUILTIN_PRESETS, ...customProviders],
    [customProviders],
  );

  const defaultId =
    activeProvider.kind === 'custom' ? activeProvider.providerId : 'anthropic';
  const value = override ?? defaultId;

  const handleChange = (next: string) => {
    if (next === defaultId) {
      setSessionProviderOverride(sessionId, null);
    } else {
      setSessionProviderOverride(sessionId, next);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        color: 'var(--text-secondary)',
        opacity: 0.85,
      }}
      title={override ? 'Per-session override active' : 'Using global default'}
    >
      {!compact && <span>Provider:</span>}
      <select
        className="settings-select"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          fontSize: 10,
          padding: '2px 6px',
          height: 22,
          background: override ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
          border: `1px solid ${override ? 'rgba(var(--accent-rgb), 0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 4,
          color: 'var(--text-primary)',
        }}
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.id === defaultId ? ' · default' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
