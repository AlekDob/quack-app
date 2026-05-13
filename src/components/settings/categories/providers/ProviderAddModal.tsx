// Brain: 037-anthropic-compatible-providers
import { useState } from 'react';
import { addCustomProvider } from '../../../../services/providerService';
import type { CustomProvider } from '../../../../types/providers';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Partial<CustomProvider>;
}

interface FormState {
  name: string;
  baseUrl: string;
  sonnetModel: string;
  haikuModel: string;
  defaultModel: string;
  contextWindow: string;
  notes: string;
}

const URL_REGEX = /^https?:\/\/.+/;

function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug || 'custom'}-${suffix}`;
}

function validate(form: FormState): string | null {
  if (!form.name.trim()) return 'Name is required';
  if (!URL_REGEX.test(form.baseUrl.trim())) return 'Base URL must start with http:// or https://';
  if (!form.sonnetModel.trim()) return 'Sonnet model is required';
  if (!form.haikuModel.trim()) return 'Haiku model is required';
  const ctx = Number(form.contextWindow);
  if (!Number.isFinite(ctx) || ctx < 4096) return 'Context window must be ≥ 4096';
  return null;
}

export default function ProviderAddModal({ open, onClose, initial }: Props) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? '',
    baseUrl: initial?.baseUrl ?? '',
    sonnetModel: initial?.sonnetModel ?? '',
    haikuModel: initial?.haikuModel ?? '',
    defaultModel: initial?.defaultModel ?? '',
    contextWindow: String(initial?.contextWindow ?? 200000),
    notes: initial?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const handleSubmit = () => {
    const err = validate(form);
    if (err) {
      setError(err);
      return;
    }
    addCustomProvider({
      id: makeId(form.name),
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      sonnetModel: form.sonnetModel.trim(),
      haikuModel: form.haikuModel.trim(),
      defaultModel: form.defaultModel.trim() || undefined,
      contextWindow: Number(form.contextWindow),
      notes: form.notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          background: 'var(--bg-secondary, #1a1a1a)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Add custom provider
        </div>

        <Field label="Name" value={form.name} onChange={(v) => update('name', v)} placeholder="My company proxy" />
        <Field label="Base URL" value={form.baseUrl} onChange={(v) => update('baseUrl', v)} placeholder="https://api.example.com" />
        <Field label="Sonnet model" value={form.sonnetModel} onChange={(v) => update('sonnetModel', v)} placeholder="claude-sonnet-4-5" />
        <Field label="Haiku model" value={form.haikuModel} onChange={(v) => update('haikuModel', v)} placeholder="claude-haiku-4-5" />
        <Field label="Default model (optional)" value={form.defaultModel} onChange={(v) => update('defaultModel', v)} placeholder="" />
        <Field label="Context window" value={form.contextWindow} onChange={(v) => update('contextWindow', v)} placeholder="200000" />
        <Field label="Notes (optional)" value={form.notes} onChange={(v) => update('notes', v)} placeholder="" />

        {error && (
          <div style={{ fontSize: 11, color: '#ff6b6b', padding: '4px 0' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid rgba(var(--accent-rgb), 0.5)',
              background: 'rgba(var(--accent-rgb), 0.18)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Add provider
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function Field({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.8 }}>{label}</span>
      <input
        className="settings-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: 12 }}
      />
    </label>
  );
}
