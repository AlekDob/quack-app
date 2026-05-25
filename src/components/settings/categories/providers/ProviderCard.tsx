// Brain: 037-anthropic-compatible-providers
import { useEffect, useState } from 'react';
import { saveProviderToken, getProviderToken, fetchProviderModels } from '../../../../services/providerService';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { ProviderEntry } from '../../../../types/providers';
import ProviderTestButton from './ProviderTestButton';

interface Props {
  provider: ProviderEntry;
  isActive: boolean;
  onSetDefault: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export default function ProviderCard({ provider, isActive, onSetDefault, onDelete, onDuplicate }: Props) {
  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const cachedEntry = useSettingsStore(s => s.claude.providerModelCache?.[provider.id]);
  const cachedModels = cachedEntry?.models ?? [];
  const fetchedAt = cachedEntry?.fetchedAt;

  useEffect(() => {
    let cancelled = false;
    getProviderToken(provider.id).then((t) => {
      if (cancelled) return;
      setSavedToken(t);
      setToken(t ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [provider.id]);

  const handleSave = async () => {
    await saveProviderToken(provider.id, token);
    setSavedToken(token);
    setDirty(false);
  };

  const handleRefreshModels = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const result = await fetchProviderModels(provider.id);
      if (!result.ok) {
        setRefreshError(result.error ?? `HTTP ${result.statusCode ?? '?'}`);
      } else if (result.models.length === 0) {
        setRefreshError('Provider returned 0 models');
      }
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const isAnthropicPreset = provider.id === 'anthropic';
  const hasToken = (savedToken ?? '').length > 0;
  // Brain: 037-anthropic-compatible-providers
  // Always allow "Set as default" — the user knows they need a key to actually run sessions.
  // A "needs API key" pill (below) signals the missing token without blocking the flow.
  const needsKeyWarning = !isAnthropicPreset && !hasToken;

  return (
    <div
      style={{
        border: `1px solid ${isActive ? 'rgba(var(--accent-rgb), 0.5)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10,
        padding: 12,
        background: isActive ? 'rgba(var(--accent-rgb), 0.06)' : 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {provider.name}
            {provider.isBuiltIn ? null : (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6, fontWeight: 400 }}>
                custom
              </span>
            )}
          </span>
          {provider.baseUrl ? (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
              {provider.baseUrl}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.7 }}>
              SDK default endpoint
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isActive && (
            <button
              type="button"
              onClick={onSetDefault}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                background: 'rgba(var(--accent-rgb), 0.1)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              title={needsKeyWarning ? 'You can set it as default, but sessions will fail until you add an API key' : undefined}
            >
              Set as default
            </button>
          )}
          {isActive && (
            <span
              style={{
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 6,
                background: 'rgba(var(--accent-rgb), 0.18)',
                color: 'var(--text-primary)',
              }}
            >
              Active
            </span>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicate as custom"
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Duplicate
            </button>
          )}
          {onDelete && !provider.isBuiltIn && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255,68,68,0.3)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {!isAnthropicPreset && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
            <span style={{ opacity: 0.85, fontWeight: 500 }}>API key</span>
            {needsKeyWarning && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 8,
                  background: 'rgba(255, 180, 80, 0.14)',
                  color: '#ffba6c',
                  border: '1px solid rgba(255, 180, 80, 0.3)',
                }}
              >
                Needs API key
              </span>
            )}
            {'docsUrl' in provider && provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  textDecoration: 'underline',
                  opacity: 0.7,
                }}
              >
                Get key
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              className="settings-input"
              placeholder={`Paste your ${provider.name} API key`}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setDirty(e.target.value !== (savedToken ?? ''));
              }}
              style={{ flex: 1, fontSize: 12 }}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              style={{
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                background: dirty ? 'rgba(var(--accent-rgb), 0.15)' : 'transparent',
                color: 'var(--text-primary)',
                cursor: dirty ? 'pointer' : 'not-allowed',
                opacity: dirty ? 1 : 0.5,
              }}
            >
              Save
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ProviderTestButton providerId={provider.id} disabled={!hasToken && !dirty} />
            <button
              type="button"
              onClick={handleRefreshModels}
              disabled={refreshing || !hasToken}
              title={!hasToken ? 'Save an API key first' : 'Fetch the latest models from /v1/models'}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: refreshing || !hasToken ? 'not-allowed' : 'pointer',
                opacity: refreshing || !hasToken ? 0.5 : 1,
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh models'}
            </button>
            {cachedModels.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>
                {cachedModels.length} model{cachedModels.length === 1 ? '' : 's'}
                {fetchedAt ? ` · ${new Date(fetchedAt).toLocaleString()}` : ''}
              </span>
            )}
            {refreshError && (
              <span style={{ fontSize: 10, color: '#ff8a8a' }}>{refreshError}</span>
            )}
          </div>
          {cachedModels.length > 0 && (
            <div style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              opacity: 0.7,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}>
              {cachedModels.slice(0, 12).map((m) => (
                <span key={m} style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>{m}</span>
              ))}
              {cachedModels.length > 12 && (
                <span style={{ opacity: 0.5 }}>+{cachedModels.length - 12} more</span>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
