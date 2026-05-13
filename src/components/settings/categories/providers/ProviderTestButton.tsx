// Brain: 037-anthropic-compatible-providers
import { useState } from 'react';
import { testConnection } from '../../../../services/providerService';
import type { TestConnectionResult } from '../../../../types/providers';

interface Props {
  providerId: string;
  disabled?: boolean;
}

export default function ProviderTestButton({ providerId, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestConnectionResult | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await testConnection(providerId);
      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const tint = result?.ok ? 'rgba(0, 217, 255, 0.5)' : result ? 'rgba(255, 68, 68, 0.5)' : 'transparent';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={handleTest}
        disabled={disabled || loading}
        className="settings-button"
        style={{
          padding: '4px 10px',
          fontSize: 11,
          borderRadius: 6,
          background: 'rgba(var(--accent-rgb), 0.12)',
          border: `1px solid ${tint}`,
          color: 'var(--text-primary)',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {loading ? 'Testing…' : 'Test connection'}
      </button>
      {result && (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 360 }}>
          {result.ok
            ? `OK · ${result.latencyMs}ms${result.modelEcho ? ` · ${result.modelEcho}` : ''}`
            : `Error${result.statusCode ? ` ${result.statusCode}` : ''}: ${result.error ?? 'unknown'}`}
        </span>
      )}
    </div>
  );
}
